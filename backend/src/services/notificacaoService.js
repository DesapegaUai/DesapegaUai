// Avisos: anúncio novo (para quem ativou no sininho), avaliação recebida e mensagem nova do chat.
// Cada aviso fica no banco (histórico do sininho), vai pelo Socket.IO para quem está com o site
// aberto e por push para os aparelhos inscritos (site fechado).
import * as repo from '../repositories/notificacaoRepository.js'
import { avisarUsuarios, estaComOSiteNaTela } from '../socket.js'
import { erroHttp } from '../utils/erroHttp.js'
import { registrar } from '../utils/log.js'
import { lerId } from '../utils/validacao.js'
import { lerPaginacao, lerRaio } from '../validations/localizacaoValidation.js'
import * as push from './pushService.js'

// as mesmas iniciais do avatar sem foto do site (primeira letra de até dois nomes)
const iniciais = (nome) => nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()

const formatarPreco = (preco) => Number(preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Chamado depois que um anúncio passa a ser ativo (publicado direto ou rascunho publicado).
 * Não trava a resposta de quem publicou: erros só vão para o log.
 */
export async function avisarAnuncioNovo(anuncio) {
  try {
    const texto = `${formatarPreco(anuncio.preco)} · ${[anuncio.bairro, anuncio.cidade].filter(Boolean).join(', ')}`.slice(0, 255)
    const avisos = await repo.criarAvisosDeAnuncioNovo({
      id: anuncio.id,
      usuarioId: anuncio.vendedor.id,
      titulo: anuncio.titulo.slice(0, 120),
      texto,
      latitude: anuncio.localizacao_aproximada.latitude,
      longitude: anuncio.localizacao_aproximada.longitude,
    })
    if (!avisos.length) return

    for (const aviso of avisos) avisarUsuarios([aviso.usuario_id], 'nova_notificacao', aviso)
    const { enviados } = await push.enviarPara(avisos.map((a) => a.usuario_id), {
      titulo: `Novo anúncio: ${anuncio.titulo}`.slice(0, 120),
      texto,
      url: `/anuncio/${anuncio.id}`,
      icone: anuncio.fotos?.[0]?.pequena ?? null,
      tag: `anuncio-${anuncio.id}`,
    })
    registrar('notificacao.anuncio_novo', { anuncio_id: anuncio.id, avisados: avisos.length, push_enviados: enviados })
  } catch (erro) {
    console.error('Não foi possível avisar sobre o anúncio novo:', erro.message)
  }
}

export async function avisarAvaliacaoRecebida(avaliacao) {
  try {
    const aviso = await repo.criarAviso({
      usuarioId: avaliacao.avaliado_id,
      tipo: 'nova_avaliacao',
      titulo: `Você recebeu ${avaliacao.nota} ${avaliacao.nota === 1 ? 'estrela' : 'estrelas'}`,
      texto: `${avaliacao.avaliador_nome} avaliou a negociação de ${avaliacao.anuncio_titulo}.`.slice(0, 255),
    })
    avisarUsuarios([avaliacao.avaliado_id], 'nova_notificacao', aviso)
    // quem desligou todos os avisos não recebe push; a avaliação continua no histórico do sininho
    const preferencias = await repo.buscarPreferencias(avaliacao.avaliado_id)
    if (!preferencias?.anuncios && !preferencias?.mensagens) return
    await push.enviarPara([avaliacao.avaliado_id], { titulo: aviso.titulo, texto: aviso.texto, url: '/perfil', tag: `avaliacao-${avaliacao.id}` })
  } catch (erro) {
    console.error('Não foi possível avisar sobre a avaliação:', erro.message)
  }
}

/**
 * Mensagem nova no chat: notificação no aparelho de quem recebe, sem precisar ativar nada no sininho
 * (basta o navegador ter permitido as notificações). Quem está com o site na tela não recebe, porque
 * a mensagem já aparece no próprio site. Só não chega para quem desligou "Avisar mensagens novas".
 * Não trava o envio da mensagem: erros só vão para o log.
 */
export async function avisarMensagemNova(mensagem, participantes) {
  if (!push.pushConfigurado) return
  try {
    const destinatarios = participantes.filter((id) => Number(id) !== Number(mensagem.remetente_id) && !estaComOSiteNaTela(id))
    if (!destinatarios.length) return
    const nome = mensagem.remetente?.nome ?? null
    const foto = mensagem.remetente?.foto_url ?? null
    const audio = mensagem.audio?.segundos ? `🎤 Áudio (${Math.floor(mensagem.audio.segundos / 60)}:${String(mensagem.audio.segundos % 60).padStart(2, '0')})` : null
    const texto = String(mensagem.texto ?? '') || (mensagem.foto ? '📷 Foto' : mensagem.video ? '🎥 Vídeo' : audio ?? 'Mensagem nova')
    for (const id of destinatarios) {
      const preferencias = await repo.buscarPreferencias(id)
      if (!preferencias?.mensagens) continue
      const { enviados } = await push.enviarPara([id], {
        titulo: (nome ?? 'Nova mensagem').slice(0, 120),
        texto: texto.length > 150 ? `${texto.slice(0, 150)}…` : texto,
        icone: foto,
        iniciais: foto || !nome ? null : iniciais(nome),
        url: `/conversas/${mensagem.conversa_id}`,
        tag: `conversa-${mensagem.conversa_id}`, // várias mensagens da mesma conversa ficam numa notificação só
      })
      registrar('notificacao.mensagem_nova', { conversa_id: mensagem.conversa_id, usuario_id: id, push_enviados: enviados })
    }
  } catch (erro) {
    console.error('Não foi possível avisar sobre a mensagem nova:', erro.message)
  }
}

// ---------------------------------------------------------------- rotas

export async function listar(usuarioId, query) {
  const { pagina, porPagina } = lerPaginacao(query, { padrao: 20 })
  const resultado = await repo.listar(usuarioId, { pagina, porPagina })
  return { ...resultado, pagina, por_pagina: porPagina, total_paginas: Math.ceil(resultado.total / porPagina) }
}

export async function marcarLidas(usuarioId, corpo) {
  let ids = null
  if (corpo?.ids !== undefined) {
    if (!Array.isArray(corpo.ids) || corpo.ids.length > 100) throw erroHttp(400, 'Envie ids como uma lista de até 100 números.')
    ids = corpo.ids.map((id) => lerId(id, 'id da notificação'))
  }
  await repo.marcarLidas(usuarioId, ids)
  const naoLidas = await repo.contarNaoLidas(usuarioId)
  avisarUsuarios([usuarioId], 'notificacoes_lidas', { nao_lidas: naoLidas })
  return { nao_lidas: naoLidas }
}

export async function consultarPreferencias(usuarioId) {
  const preferencias = await repo.buscarPreferencias(usuarioId)
  return {
    ...preferencias,
    push: { configurado: push.pushConfigurado, chave_publica: push.chavePublica(), aparelhos: await repo.contarInscricoes(usuarioId) },
  }
}

export async function salvarPreferencias(usuarioId, corpo) {
  const atual = await repo.buscarPreferencias(usuarioId)
  let { anuncios, mensagens } = atual
  let raioKm = atual.raio_km
  if ('anuncios' in (corpo ?? {})) {
    if (typeof corpo.anuncios !== 'boolean') throw erroHttp(400, 'O campo anuncios precisa ser true ou false.')
    anuncios = corpo.anuncios
  }
  if ('mensagens' in (corpo ?? {})) {
    if (typeof corpo.mensagens !== 'boolean') throw erroHttp(400, 'O campo mensagens precisa ser true ou false.')
    mensagens = corpo.mensagens
  }
  if ('raio_km' in (corpo ?? {})) raioKm = corpo.raio_km === null ? null : lerRaio(corpo.raio_km)

  // localidade dos avisos de anúncio: cidade_id (com ou sem bairro_id); cidade_id null volta para a distância
  let cidadeId = atual.cidade?.id ?? null
  let bairroId = atual.bairro?.id ?? null
  if ('cidade_id' in (corpo ?? {})) {
    cidadeId = corpo.cidade_id === null ? null : lerId(corpo.cidade_id, 'cidade_id')
    bairroId = null // trocou de cidade: o bairro antigo não vale mais
  }
  if ('bairro_id' in (corpo ?? {})) bairroId = corpo.bairro_id === null ? null : lerId(corpo.bairro_id, 'bairro_id')
  if (!cidadeId && bairroId) throw erroHttp(400, 'Para escolher o bairro, escolha também a cidade (cidade_id).')
  if (cidadeId) {
    const problema = await repo.conferirLocalidade(cidadeId, bairroId)
    if (problema === 'cidade') throw erroHttp(400, 'Cidade não encontrada.')
    if (problema === 'bairro') throw erroHttp(400, 'Esse bairro não é da cidade escolhida.')
  }

  await repo.salvarPreferencias(usuarioId, { anuncios, mensagens, raioKm, cidadeId, bairroId })
  // desligou os avisos de anúncio novo: os que já tinham chegado saem da caixinha, para não acumular
  // (os de avaliação ficam). Só acontece na hora em que a pessoa desliga.
  if (atual.anuncios && !anuncios) {
    const apagados = await repo.apagarAvisosDeAnuncioNovo(usuarioId)
    if (apagados > 0) avisarUsuarios([usuarioId], 'notificacoes_lidas', { nao_lidas: await repo.contarNaoLidas(usuarioId) })
  }
  registrar('notificacao.preferencias', { usuario_id: usuarioId, anuncios, mensagens, raio_km: raioKm, cidade_id: cidadeId, bairro_id: bairroId })
  return consultarPreferencias(usuarioId)
}

function lerInscricao(corpo) {
  const inscricao = corpo?.inscricao ?? corpo?.subscription ?? corpo
  const endpoint = inscricao?.endpoint
  const p256dh = inscricao?.keys?.p256dh
  const auth = inscricao?.keys?.auth
  let url
  try {
    url = new URL(endpoint)
  } catch {
    throw erroHttp(400, 'Inscrição de push inválida: falta o endpoint.')
  }
  if (url.protocol !== 'https:' || endpoint.length > 1000) throw erroHttp(400, 'Inscrição de push inválida: o endpoint precisa ser HTTPS.')
  if (typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{40,200}={0,2}$/.test(p256dh)) throw erroHttp(400, 'Inscrição de push inválida: chave p256dh.')
  if (typeof auth !== 'string' || !/^[A-Za-z0-9_-]{10,100}={0,2}$/.test(auth)) throw erroHttp(400, 'Inscrição de push inválida: chave auth.')
  return { endpoint, p256dh, auth }
}

export async function inscreverAparelho(usuarioId, corpo) {
  if (!push.pushConfigurado) {
    const e = erroHttp(503, 'As notificações push ainda não foram configuradas no servidor.')
    e.codigo = 'PUSH_NAO_CONFIGURADO'
    throw e
  }
  await repo.salvarInscricao(usuarioId, lerInscricao(corpo))
  registrar('push.aparelho_inscrito', { usuario_id: usuarioId })
}

export async function removerAparelho(usuarioId, corpo) {
  const endpoint = corpo?.endpoint ?? corpo?.inscricao?.endpoint
  if (typeof endpoint !== 'string' || !endpoint) throw erroHttp(400, 'Envie o endpoint do aparelho.')
  const apagou = await repo.apagarInscricao(usuarioId, endpoint)
  registrar('push.aparelho_removido', { usuario_id: usuarioId, existia: apagou })
}
