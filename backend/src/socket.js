// Tempo real (Socket.IO em /api/socket.io).
// - Visitante: conecta sem login e só recebe o feed público (anúncio publicado, alterado, removido).
// - Logado: entra na sala usuario:<id> e recebe mensagens, leituras, "digitando", avisos do
//   sininho, avaliações e atualizações do perfil. A localização das pessoas nunca passa por aqui.
import { Server } from 'socket.io'
import { env } from './config/env.js'
import { listarParceirosDeConversa, marcarComoLidas, participantesDaConversa, salvarMensagem, marcarComoEntregues } from './models/mensagemModel.js'
import * as usuarioModel from './models/usuarioModel.js'
import { registrar } from './utils/log.js'
import { usuarioDoCookie } from './middlewares/autenticacao.js'
import { lerId } from './utils/validacao.js'

let io = null
const conexoesPorUsuario = new Map() // id -> quantas abas/aparelhos conectados
const ultimoRegistroDeAcesso = new Map() // id -> ms do último UPDATE de ultimo_acesso
const REGISTRO_DE_ACESSO_MS = 60 * 1000

export const estaOnline = (usuarioId) => (conexoesPorUsuario.get(Number(usuarioId)) ?? 0) > 0

// limite simples por conexão: no máximo `maximo` eventos a cada `janelaMs`
function criarLimitador(maximo, janelaMs) {
  let inicio = Date.now()
  let contagem = 0
  return () => {
    const agora = Date.now()
    if (agora - inicio > janelaMs) { inicio = agora; contagem = 0 }
    contagem++
    return contagem <= maximo
  }
}

const erroDoSocket = (erro, padrao) => (erro.status >= 400 && erro.status < 500 ? erro.message : padrao)

// grava o último acesso (no máximo 1 vez por minuto por pessoa) e avisa as abas dela
export async function registrarAcessoAgora(usuarioId) {
  const agora = Date.now()
  if (agora - (ultimoRegistroDeAcesso.get(usuarioId) ?? 0) < REGISTRO_DE_ACESSO_MS) return
  ultimoRegistroDeAcesso.set(usuarioId, agora)
  await usuarioModel.registrarAcesso(usuarioId)
  const perfil = await usuarioModel.buscarUltimoAcesso(usuarioId)
  avisarUsuarios([usuarioId], 'ultimo_acesso_atualizado', perfil)
}

async function avisarPresenca(usuarioId, online) {
  const parceiros = await listarParceirosDeConversa(usuarioId)
  if (!parceiros.length) return
  const perfil = await usuarioModel.buscarUltimoAcesso(usuarioId)
  avisarUsuarios(parceiros, 'presenca', { usuario_id: usuarioId, online, ultimo_acesso: perfil?.ultimo_acesso ?? null })
}

export function iniciarSocket(servidor) {
  io = new Server(servidor, {
    path: '/api/socket.io',
    cors: { origin: env.origensDoFront, credentials: true },
    maxHttpBufferSize: 64 * 1024,
    // WebSocket não passa pelo CORS: confere a origem aqui (sem Origin = ferramenta ou teste)
    allowRequest: (req, aceitar) => {
      const origem = req.headers.origin
      aceitar(null, !origem || env.origensDoFront.includes(origem))
    },
  })

  // identifica quem conectou; sem login também entra (só ouve o feed público)
  io.use(async (socket, next) => {
    try {
      socket.data.usuarioId = await usuarioDoCookie(socket.handshake.headers.cookie)
      next()
    } catch (erro) {
      next(new Error('Não foi possível conectar ao tempo real.'))
    }
  })

  io.on('connection', (socket) => {
    const usuarioId = socket.data.usuarioId
    socket.join('publico')
    if (!usuarioId) return

    socket.join(`usuario:${usuarioId}`)
    const antes = conexoesPorUsuario.get(usuarioId) ?? 0
    conexoesPorUsuario.set(usuarioId, antes + 1)
    registrarAcessoAgora(usuarioId).catch((erro) => console.error('Erro ao registrar acesso:', erro.message))
    // abriu o site: o que chegou enquanto estava fora passa a "entregue" (dois tiques para quem enviou)
    entregarPendentes(usuarioId).catch((erro) => console.error('Erro ao marcar mensagens como entregues:', erro.message))
    if (antes === 0) avisarPresenca(usuarioId, true).catch(() => {})

    socket.on('disconnect', () => {
      const restantes = (conexoesPorUsuario.get(usuarioId) ?? 1) - 1
      if (restantes > 0) return conexoesPorUsuario.set(usuarioId, restantes)
      conexoesPorUsuario.delete(usuarioId)
      avisarPresenca(usuarioId, false).catch(() => {})
    })

    const podeMandarMensagem = criarLimitador(20, 10_000)
    const podeAvisarDigitando = criarLimitador(30, 10_000)
    const podeMarcarLidas = criarLimitador(60, 10_000)

    socket.on('enviar_mensagem', async (dados, responder) => {
      if (typeof responder !== 'function') return
      if (!podeMandarMensagem()) return responder({ ok: false, erro: 'Muitas mensagens em pouco tempo. Aguarde alguns segundos.' })
      try {
        const resultado = await salvarMensagem(dados?.conversa_id, usuarioId, dados?.texto)
        await marcarEntregueSeOnline(resultado.mensagem, resultado.participantes)
        avisarUsuarios(resultado.participantes, 'nova_mensagem', resultado.mensagem)
        responder({ ok: true, mensagem: resultado.mensagem })
      } catch (erro) {
        if (!(erro.status < 500)) console.error('Erro ao enviar mensagem pelo socket:', erro)
        responder({ ok: false, erro: erroDoSocket(erro, 'Não foi possível enviar a mensagem.') })
      }
    })

    // quem está com a conversa aberta avisa que leu; o outro lado vê os dois tiques
    socket.on('marcar_lidas', async (dados, responder) => {
      const responda = typeof responder === 'function' ? responder : () => {}
      if (!podeMarcarLidas()) return responda({ ok: false, erro: 'Muitos pedidos em pouco tempo.' })
      try {
        const resultado = await marcarComoLidas(dados?.conversa_id, usuarioId)
        if (resultado.marcadas > 0) {
          avisarUsuarios(resultado.participantes, 'mensagens_lidas', { conversa_id: resultado.conversaId, leitor_id: usuarioId, ate_id: resultado.ateId })
        }
        responda({ ok: true, marcadas: resultado.marcadas })
      } catch (erro) {
        responda({ ok: false, erro: erroDoSocket(erro, 'Não foi possível marcar como lida.') })
      }
    })

    socket.on('digitando', async (dados) => {
      if (!podeAvisarDigitando()) return
      try {
        const conversaId = lerId(dados?.conversa_id, 'id da conversa')
        const participantes = await participantesDaConversa(conversaId)
        if (!participantes.includes(usuarioId)) return
        avisarUsuarios(participantes.filter((id) => id !== usuarioId), 'digitando', { conversa_id: conversaId, usuario_id: usuarioId })
      } catch {
        // pedido inválido: ignora em silêncio (é só um aviso visual)
      }
    })
  })

  registrar('socket.iniciado', { caminho: '/api/socket.io' })
}

export async function encerrarSocket() {
  if (!io) return
  const atual = io
  io = null
  conexoesPorUsuario.clear()
  await new Promise((resolver) => atual.close(resolver))
}

// manda um evento para as abas/aparelhos dessas pessoas (o REST funciona mesmo sem o socket)
// marca como entregue o que chegou para essa pessoa e avisa cada remetente (os dois tiques cinza)
export async function entregarPendentes(usuarioId, opcoes) {
  const entregues = await marcarComoEntregues(usuarioId, opcoes)
  for (const { conversaId, remetenteId, ateId } of entregues) {
    avisarUsuarios([remetenteId], 'mensagens_entregues', { conversa_id: conversaId, ate_id: ateId })
  }
  return entregues
}

// mensagem nova: se quem recebe está com o site aberto, ela já chega como entregue
export async function marcarEntregueSeOnline(mensagem, participantes) {
  const destinatario = participantes.find((id) => id !== mensagem.remetente_id)
  if (destinatario && estaOnline(destinatario)) {
    await marcarComoEntregues(destinatario, { mensagemId: mensagem.id })
    mensagem.entregue = true
  }
  return mensagem
}

export function avisarUsuarios(ids, evento, dados) {
  if (!io || !ids?.length) return
  io.to([...new Set(ids)].map((id) => `usuario:${id}`)).emit(evento, dados)
}

// feed público: todo mundo conectado, com ou sem login
export function publicarParaTodos(evento, dados) {
  if (!io) return
  io.to('publico').emit(evento, dados)
}
