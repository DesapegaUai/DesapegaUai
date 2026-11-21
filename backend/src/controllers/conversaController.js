// Anthony. Já pronto para usar: req.usuario.id, erroHttp, lerId/lerTexto (utils/validacao)
// e, no Socket.IO, usuarioDoCookie (middlewares/autenticacao).
import { randomUUID } from 'node:crypto'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { abrirConversa, listarConversas, contarConversasNaoLidas, ocultarConversa } from '../models/conversaModel.js'
import { erroHttp } from '../utils/erroHttp.js'
import { LARGURAS_FOTO_DO_CHAT, caminhoDaFotoDoChat, caminhoDoArquivoDoChat, pastaDaConversa } from '../utils/fotos.js'
import { lerId, lerOpcao, lerTexto } from '../utils/validacao.js'
import { buscarMensagens, participantesDaConversa, salvarMensagem } from '../models/mensagemModel.js'
import { avisarUsuarios, estaOnline } from '../socket.js'

// POST /api/conversas (A2)
export async function abrir(req, res) {
  const anuncioId = lerId(req.body?.anuncio_id, 'id do anúncio')
  const compradorId = req.usuario.id

  const resultado = await abrirConversa(anuncioId, compradorId)

  let status = 200

  if (resultado.criada) {
    status = 201
    avisarUsuarios(resultado.participantes, 'perfil_contadores_atualizados', {})
    avisarUsuarios(resultado.participantes, 'conversa_criada', { conversa_id: resultado.conversa.id })
  }

  res.status(status).json({
    conversa: resultado.conversa,
  })
}

// GET /api/conversas (A2)
export async function listar(req, res) {
  let filtro = 'todas'

  if (req.query.filtro !== undefined) {
    if (
      typeof req.query.filtro !== 'string' ||
      req.query.filtro.trim() !== ''
    ) {
      filtro = lerOpcao(
        req.query.filtro,
        'filtro',
        ['todas', 'nao_lidas', 'vendendo', 'comprando'],
      )
    }
  }

  const resultado = await listarConversas(req.usuario.id, filtro)

  // online agora: quem está com o site aberto (Socket.IO conectado)
  resultado.itens = resultado.itens.map((conversa) => ({
    ...conversa,
    outro_usuario: { ...conversa.outro_usuario, online: estaOnline(conversa.outro_usuario.id) },
  }))

  res.json(resultado)
}

// GET /api/conversas/nao-lidas (A2)
export async function contarNaoLidas(req, res) {
  const total = await contarConversasNaoLidas(req.usuario.id)

  res.json({ total: total })
}

// GET /api/conversas/:id/mensagens (A3)
export async function verMensagens(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  const usuarioId = req.usuario.id

  const { marcadas, participantes, ...resultado } = await buscarMensagens(conversaId, usuarioId)

  // abriu a conversa: quem mandou vê os dois tiques na hora
  if (marcadas > 0) {
    avisarUsuarios(participantes, 'mensagens_lidas', { conversa_id: conversaId, leitor_id: usuarioId })
  }

  res.json({
    ...resultado,
    outro_usuario: resultado.outro_usuario && { ...resultado.outro_usuario, online: estaOnline(resultado.outro_usuario.id) },
  })
}

// POST /api/conversas/:id/mensagens (A3)
export async function enviarMensagem(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  const usuarioId = req.usuario.id

  const resultado = await salvarMensagem(
    conversaId,
    usuarioId,
    req.body?.texto,
  )

  avisarUsuarios(
    resultado.participantes,
    'nova_mensagem',
    resultado.mensagem,
  )

  res.status(201).json({
    mensagem: { ...resultado.mensagem, minha: true },
  })
}

// ---------------------------------------------------------------- fotos no chat

const FORMATOS_DE_FOTO = ['jpeg', 'png', 'webp']
const MAXIMO_DE_PIXELS = 40_000_000

// 404 se a conversa não existe, 403 se a pessoa não participa
async function exigirParticipante(conversaId, usuarioId) {
  const participantes = await participantesDaConversa(conversaId)
  if (!participantes.length) throw erroHttp(404, 'Conversa não encontrada.')
  if (!participantes.includes(usuarioId)) throw erroHttp(403, 'Você não participa desta conversa.')
}

// confere se o arquivo é mesmo uma imagem e gera os dois tamanhos em WebP (já girada pelo EXIF,
// que é como a foto tirada com o celular vem; o WebP gerado sai sem a localização da foto)
async function converterFotoDoChat(buffer) {
  let formato
  try {
    formato = (await sharp(buffer, { limitInputPixels: MAXIMO_DE_PIXELS }).metadata()).format
  } catch {
    throw erroHttp(400, 'A foto não é válida. Envie uma imagem JPG, PNG ou WebP.')
  }
  if (!FORMATOS_DE_FOTO.includes(formato)) throw erroHttp(400, 'Envie somente fotos JPG, PNG ou WebP.')

  try {
    const tamanhos = []
    for (const largura of LARGURAS_FOTO_DO_CHAT) {
      const imagem = await sharp(buffer, { limitInputPixels: MAXIMO_DE_PIXELS })
        .rotate()
        .resize(largura, largura, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
      tamanhos.push({ largura, imagem })
    }
    return tamanhos
  } catch {
    throw erroHttp(400, 'A foto não pôde ser processada. Tente outra imagem.')
  }
}

// POST /api/conversas/:id/fotos (multipart: fotos = até 5 imagens, texto = legenda opcional)
// Cada foto vira uma mensagem; a legenda vai junto com a última.
export async function enviarFotos(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  const usuarioId = req.usuario.id
  const arquivos = req.files ?? []

  if (arquivos.length === 0) throw erroHttp(400, 'Envie pelo menos uma foto no campo fotos.')
  const legenda = lerTexto(req.body?.texto, 'texto', { max: 1000 })
  await exigirParticipante(conversaId, usuarioId)

  // converte tudo antes de gravar: se uma foto for inválida, nenhuma é enviada
  const fotos = []
  for (const arquivo of arquivos) {
    fotos.push({ nome: randomUUID().replaceAll('-', ''), tamanhos: await converterFotoDoChat(arquivo.buffer) })
  }

  const apagar = (foto) => Promise.all(
    LARGURAS_FOTO_DO_CHAT.map((largura) => rm(caminhoDaFotoDoChat(conversaId, foto.nome, largura), { force: true })),
  ).catch((falha) => console.error('Não foi possível limpar a foto do chat:', falha.message))

  await mkdir(pastaDaConversa(conversaId), { recursive: true })
  const mensagens = []
  let participantes = []

  for (const [i, foto] of fotos.entries()) {
    try {
      for (const { largura, imagem } of foto.tamanhos) {
        await writeFile(caminhoDaFotoDoChat(conversaId, foto.nome, largura), imagem)
      }
      const texto = i === fotos.length - 1 ? legenda : null
      const resultado = await salvarMensagem(conversaId, usuarioId, texto, foto.nome)
      participantes = resultado.participantes
      mensagens.push(resultado.mensagem)
    } catch (erro) {
      await apagar(foto)
      // as fotos anteriores já foram enviadas: avisa o outro lado delas antes de devolver o erro
      for (const mensagem of mensagens) avisarUsuarios(participantes, 'nova_mensagem', mensagem)
      throw erro
    }
  }

  for (const mensagem of mensagens) avisarUsuarios(participantes, 'nova_mensagem', mensagem)

  res.status(201).json({
    mensagens: mensagens.map((mensagem) => ({ ...mensagem, minha: true })),
  })
}

// GET /api/conversas/:id/fotos/:arquivo (só quem participa da conversa)
export async function verFoto(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  await exigirParticipante(conversaId, req.usuario.id)

  const caminho = caminhoDoArquivoDoChat(conversaId, req.params.arquivo)
  if (!caminho) throw erroHttp(404, 'Foto não encontrada.')
  try {
    await access(caminho)
  } catch {
    throw erroHttp(404, 'Foto não encontrada.')
  }

  // privada: o navegador de quem viu pode guardar, mas nenhum cache no meio do caminho
  res.set('Cache-Control', 'private, max-age=2592000, immutable')
  res.set('Cross-Origin-Resource-Policy', 'same-site') // o front pode ficar em outro subdomínio
  res.type('image/webp')
  res.sendFile(caminho)
}

// DELETE /api/conversas/:id: tira a conversa da minha lista (a outra pessoa continua com a dela)
export async function excluir(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  await ocultarConversa(conversaId, req.usuario.id)
  // as outras abas e aparelhos da mesma pessoa tiram a conversa da lista na hora
  avisarUsuarios([req.usuario.id], 'conversa_excluida', { conversa_id: conversaId })
  res.status(204).end()
}
