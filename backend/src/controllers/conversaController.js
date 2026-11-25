// Anthony. Já pronto para usar: req.usuario.id, erroHttp, lerId/lerTexto (utils/validacao)
// e, no Socket.IO, usuarioDoCookie (middlewares/autenticacao).
import { randomUUID } from 'node:crypto'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { abrirConversa, listarConversas, contarConversasNaoLidas, ocultarConversa } from '../models/conversaModel.js'
import { erroHttp } from '../utils/erroHttp.js'
import { LARGURAS_FOTO_DO_CHAT, caminhoDaFotoDoChat, caminhoDoArquivoDoChat, caminhoDoAudioDoChat, caminhoDoVideoDoChat, pastaDaConversa } from '../utils/fotos.js'
import { converterAudio } from '../services/audioDoChat.js'
import { conversasFixadas } from '../models/fixadasModel.js'
import * as fixadas from '../services/fixadasService.js'
import { exigirFotoPermitida, exigirVideoPermitido } from '../services/moderacaoDeImagem.js'
import { exigirTextoPermitido } from '../services/moderacaoDeTexto.js'
import { lerId, lerOpcao, lerTexto } from '../utils/validacao.js'
import { apagarParaMim, apagarParaTodos, buscarMensagens, editarMensagem as editarNoBanco, liberarMidiasQueNinguemVe, participantesDaConversa, salvarMensagem } from '../models/mensagemModel.js'
import { apagarDoDisco } from '../utils/arquivos.js'
import { avisarUsuarios, estaOnline, marcarEntregueSeOnline } from '../socket.js'
import { avisarMensagemNova } from '../services/notificacaoService.js'
import * as programadas from '../services/mensagemProgramadaService.js'

// GET /api/conversas/:id/programadas: as mensagens programadas de quem pediu (a outra pessoa não vê)
export async function listarProgramadas(req, res) {
  res.json({ programadas: await programadas.listar(req.params.id, req.usuario.id) })
}

// POST /api/conversas/:id/programadas { texto, enviar_em }: sai sozinha no horário (como no WhatsApp)
export async function programarMensagem(req, res) {
  res.status(201).json({ programada: await programadas.programar(req.params.id, req.usuario.id, req.body) })
}

// POST /api/conversas/:id/programadas/:programadaId/enviar: "Enviar agora"
export async function enviarProgramadaAgora(req, res) {
  const mensagem = await programadas.enviarAgora(req.params.id, req.params.programadaId, req.usuario.id)
  res.status(201).json({ mensagem: { ...mensagem, minha: true } })
}

// DELETE /api/conversas/:id/programadas/:programadaId: "Apagar" (antes de sair)
export async function apagarProgramada(req, res) {
  await programadas.apagar(req.params.id, req.params.programadaId, req.usuario.id)
  res.status(204).end()
}

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
  const fixadasDaPessoa = await conversasFixadas(req.usuario.id)

  // online agora: quem está com o site aberto (Socket.IO conectado); fixada: no topo da lista (até 3)
  resultado.itens = resultado.itens.map((conversa) => ({
    ...conversa,
    fixada: fixadasDaPessoa.has(conversa.id),
    fixada_em: fixadasDaPessoa.get(conversa.id) ?? null,
    outro_usuario: { ...conversa.outro_usuario, online: estaOnline(conversa.outro_usuario.id) },
  }))
  // as fixadas primeiro (a fixada por último no alto, como no WhatsApp); as outras na ordem de antes
  const quando = (conversa) => (conversa.fixada_em ? new Date(conversa.fixada_em).getTime() : 0)
  resultado.itens = [
    ...resultado.itens.filter((conversa) => conversa.fixada).sort((a, b) => quando(b) - quando(a)),
    ...resultado.itens.filter((conversa) => !conversa.fixada),
  ]

  res.json(resultado)
}

// PUT/DELETE /api/conversas/:id/fixar: fixar a conversa no topo da minha lista (até 3), ou desafixar
export async function fixarConversa(req, res) {
  res.json(await fixadas.fixarConversa(req.params.id, req.usuario.id))
}
export async function desafixarConversa(req, res) {
  res.json(await fixadas.desafixarConversa(req.params.id, req.usuario.id))
}

// GET /api/conversas/:id/mensagens-fixadas: as mensagens fixadas no topo da conversa (as duas pessoas veem)
export async function listarMensagensFixadas(req, res) {
  res.json(await fixadas.listarMensagensFixadas(req.params.id, req.usuario.id))
}

// PUT /api/conversas/:id/mensagens/:mensagemId/fixar { duracao: '24h' | '7d' | '30d', substituir? }; DELETE desafixa
export async function fixarMensagem(req, res) {
  res.json(await fixadas.fixarMensagem(req.params.id, req.params.mensagemId, req.usuario.id, req.body))
}
export async function desafixarMensagem(req, res) {
  res.json(await fixadas.desafixarMensagem(req.params.id, req.params.mensagemId, req.usuario.id))
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

  await marcarEntregueSeOnline(resultado.mensagem, resultado.participantes)
  avisarUsuarios(
    resultado.participantes,
    'nova_mensagem',
    resultado.mensagem,
  )
  avisarMensagemNova(resultado.mensagem, resultado.participantes) // notificação no aparelho (não trava a resposta)

  res.status(201).json({
    mensagem: { ...resultado.mensagem, minha: true },
  })
}

// PATCH /api/conversas/:id/mensagens/:mensagemId  { texto }
// Editar a própria mensagem até 15 minutos depois de enviar (como no WhatsApp).
export async function editarMensagem(req, res) {
  const resultado = await editarNoBanco(req.params.id, req.params.mensagemId, req.usuario.id, req.body?.texto)
  avisarUsuarios(resultado.participantes, 'mensagem_editada', resultado.mensagem)
  res.json({ mensagem: { ...resultado.mensagem, minha: true } })
}

// DELETE /api/conversas/:id/mensagens/:mensagemId?para=mim|todos
// "para=todos": a própria mensagem, até 2 dias depois; texto e foto saem para as duas pessoas.
// "para=mim" (padrão): qualquer mensagem da conversa some só para quem apagou.
export async function apagarMensagem(req, res) {
  const para = req.query.para === undefined ? 'mim' : lerOpcao(req.query.para, 'para', ['mim', 'todos'])
  const usuarioId = req.usuario.id

  if (para === 'mim') {
    const resultado = await apagarParaMim(req.params.id, req.params.mensagemId, usuarioId)
    // os outros aparelhos da mesma pessoa também tiram a mensagem da tela
    avisarUsuarios([usuarioId], 'mensagem_oculta', { conversa_id: resultado.conversaId, id: resultado.mensagemId })
    await apagarArquivosQueNinguemVe(resultado.conversaId) // a outra pessoa também já tinha apagado: o arquivo sai
    return res.status(204).end()
  }

  const resultado = await apagarParaTodos(req.params.id, req.params.mensagemId, usuarioId)
  if (resultado.fotoAntiga) {
    for (const largura of LARGURAS_FOTO_DO_CHAT) {
      await apagarDoDisco(caminhoDaFotoDoChat(resultado.mensagem.conversa_id, resultado.fotoAntiga, largura), {
        tipo: 'foto_chat',
        conversa_id: resultado.mensagem.conversa_id,
        mensagem_id: resultado.mensagem.id,
      })
    }
  }
  if (resultado.videoAntigo) {
    const caminho = caminhoDoVideoDoChat(resultado.mensagem.conversa_id, resultado.videoAntigo)
    if (caminho) await apagarDoDisco(caminho, { tipo: 'video_chat', conversa_id: resultado.mensagem.conversa_id, mensagem_id: resultado.mensagem.id })
  }
  if (resultado.audioAntigo) {
    const caminho = caminhoDoAudioDoChat(resultado.mensagem.conversa_id, resultado.audioAntigo)
    if (caminho) await apagarDoDisco(caminho, { tipo: 'audio_chat', conversa_id: resultado.mensagem.conversa_id, mensagem_id: resultado.mensagem.id })
  }
  avisarUsuarios(resultado.participantes, 'mensagem_apagada', resultado.mensagem)
  await fixadas.aoApagarParaTodos(resultado.mensagem, resultado.participantes) // apagada não fica fixada
  res.json({ mensagem: { ...resultado.mensagem, minha: true } })
}

// ---------------------------------------------------------------- vídeo no chat

// Descobre pelo começo do arquivo se é mesmo um vídeo (não confia no nome nem no tipo que o navegador
// mandou). MP4 e MOV começam com uma "caixa" (ftyp, moov...) nos bytes 4 a 8; WebM começa com 1A 45 DF A3.
// Devolve a extensão para guardar, ou null se não for vídeo.
function extensaoDoVideo(buffer) {
  if (!buffer || buffer.length < 12) return null
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'webm'
  const caixa = buffer.toString('latin1', 4, 8)
  if (caixa === 'ftyp') return buffer.toString('latin1', 8, 12) === 'qt  ' ? 'mov' : 'mp4'
  if (['moov', 'wide', 'free', 'mdat', 'skip'].includes(caixa)) return 'mov' // QuickTime antigo, sem ftyp
  return null
}

// POST /api/conversas/:id/videos (multipart: video = um MP4, MOV ou WebM de até 25 MB, texto = legenda opcional)
export async function enviarVideo(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  const usuarioId = req.usuario.id
  if (!req.file) throw erroHttp(400, 'Envie o vídeo no campo video.')
  const legenda = lerTexto(req.body?.texto, 'texto', { max: 1000 })
  exigirTextoPermitido({ legenda }, { onde: 'chat', usuarioId })
  await exigirParticipante(conversaId, usuarioId)

  const extensao = extensaoDoVideo(req.file.buffer)
  if (!extensao) throw erroHttp(400, 'O arquivo não é um vídeo válido. Envie um vídeo MP4, MOV ou WebM.')

  const arquivo = `${randomUUID().replaceAll('-', '')}.${extensao}`
  const caminho = caminhoDoVideoDoChat(conversaId, arquivo)
  await mkdir(pastaDaConversa(conversaId), { recursive: true })
  await writeFile(caminho, req.file.buffer)

  // a IA confere quadros espalhados pelo vídeo: nudez ou conteúdo sexual não entra (e o arquivo sai do disco)
  try {
    await exigirVideoPermitido(caminho, { usuarioId })
  } catch (erro) {
    await rm(caminho, { force: true }).catch(() => {})
    throw erro
  }

  let resultado
  try {
    resultado = await salvarMensagem(conversaId, usuarioId, legenda, null, arquivo)
  } catch (erro) {
    await rm(caminho, { force: true }).catch(() => {})
    throw erro
  }

  await marcarEntregueSeOnline(resultado.mensagem, resultado.participantes)
  avisarUsuarios(resultado.participantes, 'nova_mensagem', resultado.mensagem)
  avisarMensagemNova(resultado.mensagem, resultado.participantes)
  res.status(201).json({ mensagem: { ...resultado.mensagem, minha: true } })
}

const TIPO_DO_VIDEO = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/mp4' } // MOV é da mesma família do MP4: assim toca também no Chrome

// GET /api/conversas/:id/videos/:arquivo (só quem participa). O sendFile atende pedidos de pedaço
// (Range), e é isso que deixa avançar o vídeo sem baixar tudo, inclusive no iPhone.
export async function verVideo(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  await exigirParticipante(conversaId, req.usuario.id)

  const caminho = caminhoDoVideoDoChat(conversaId, req.params.arquivo)
  if (!caminho) throw erroHttp(404, 'Vídeo não encontrado.')
  try {
    await access(caminho)
  } catch {
    throw erroHttp(404, 'Vídeo não encontrado.')
  }

  res.set('Cache-Control', 'private, max-age=2592000, immutable')
  res.set('Cross-Origin-Resource-Policy', 'same-site')
  res.type(TIPO_DO_VIDEO[req.params.arquivo.split('.').pop()])
  res.sendFile(caminho)
}

// ---------------------------------------------------------------- áudio no chat

// POST /api/conversas/:id/audios (multipart: audio = o áudio gravado no navegador, até 5 MB e 2 minutos).
// O servidor converte para M4A, mede a duração e desenha as ondas (services/audioDoChat.js).
export async function enviarAudio(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  const usuarioId = req.usuario.id
  if (!req.file) throw erroHttp(400, 'Envie o áudio no campo audio.')
  await exigirParticipante(conversaId, usuarioId)

  const { m4a, segundos, ondas } = await converterAudio(req.file.buffer)
  const arquivo = `${randomUUID().replaceAll('-', '')}.m4a`
  const caminho = caminhoDoAudioDoChat(conversaId, arquivo)
  await mkdir(pastaDaConversa(conversaId), { recursive: true })
  await writeFile(caminho, m4a)

  let resultado
  try {
    resultado = await salvarMensagem(conversaId, usuarioId, '', null, null, { arquivo, segundos, ondas })
  } catch (erro) {
    await rm(caminho, { force: true }).catch(() => {})
    throw erro
  }

  await marcarEntregueSeOnline(resultado.mensagem, resultado.participantes)
  avisarUsuarios(resultado.participantes, 'nova_mensagem', resultado.mensagem)
  avisarMensagemNova(resultado.mensagem, resultado.participantes)
  res.status(201).json({ mensagem: { ...resultado.mensagem, minha: true } })
}

// GET /api/conversas/:id/audios/:arquivo (só quem participa). Aceita pedidos de pedaço (Range): é o que
// deixa tocar e avançar o áudio no iPhone.
export async function verAudio(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  await exigirParticipante(conversaId, req.usuario.id)

  const caminho = caminhoDoAudioDoChat(conversaId, req.params.arquivo)
  if (!caminho) throw erroHttp(404, 'Áudio não encontrado.')
  try {
    await access(caminho)
  } catch {
    throw erroHttp(404, 'Áudio não encontrado.')
  }

  res.set('Cache-Control', 'private, max-age=2592000, immutable')
  res.set('Cross-Origin-Resource-Policy', 'same-site')
  res.type('audio/mp4')
  res.sendFile(caminho)
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
// que é como a foto tirada com o celular vem; o WebP gerado sai sem a localização da foto).
// Antes, a IA confere a foto: nudez ou conteúdo sexual é recusado (422).
async function converterFotoDoChat(buffer, { usuarioId = null, posicao = 1, total = 1 } = {}) {
  let formato
  try {
    formato = (await sharp(buffer, { limitInputPixels: MAXIMO_DE_PIXELS }).metadata()).format
  } catch {
    throw erroHttp(400, 'A foto não é válida. Envie uma imagem JPG, PNG ou WebP.')
  }
  if (!FORMATOS_DE_FOTO.includes(formato)) throw erroHttp(400, 'Envie somente fotos JPG, PNG ou WebP.')
  await exigirFotoPermitida(buffer, { onde: 'chat', usuarioId, posicao, total })

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
  // a legenda vai na última foto: confere antes, senão as primeiras sairiam e a última não
  exigirTextoPermitido({ legenda }, { onde: 'chat', usuarioId })
  await exigirParticipante(conversaId, usuarioId)

  // converte (e a IA confere) tudo antes de gravar: se uma foto for inválida ou proibida, nenhuma é enviada
  const fotos = []
  for (const [i, arquivo] of arquivos.entries()) {
    const tamanhos = await converterFotoDoChat(arquivo.buffer, { usuarioId, posicao: i + 1, total: arquivos.length })
    fotos.push({ nome: randomUUID().replaceAll('-', ''), tamanhos })
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
      for (const mensagem of mensagens) {
        avisarUsuarios(participantes, 'nova_mensagem', mensagem)
        avisarMensagemNova(mensagem, participantes)
      }
      throw erro
    }
  }

  for (const mensagem of mensagens) {
    avisarUsuarios(participantes, 'nova_mensagem', mensagem)
    avisarMensagemNova(mensagem, participantes)
  }

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
  await fixadas.aoExcluirConversa(conversaId, req.usuario.id) // excluída não fica fixada
  // as outras abas e aparelhos da mesma pessoa tiram a conversa da lista na hora
  avisarUsuarios([req.usuario.id], 'conversa_excluida', { conversa_id: conversaId })
  await apagarArquivosQueNinguemVe(conversaId) // a outra pessoa também já tinha excluído: as fotos e os vídeos saem
  res.status(204).end()
}

// Foto ou vídeo que nenhuma das duas pessoas consegue mais ver (cada uma apagou "para mim" ou excluiu a
// conversa depois que ele chegou) não serve para mais ninguém: sai do banco e do disco, para não ocupar espaço.
async function apagarArquivosQueNinguemVe(conversaId) {
  const liberadas = await liberarMidiasQueNinguemVe(conversaId)
  for (const mensagem of liberadas) {
    const detalhes = { conversa_id: conversaId, mensagem_id: mensagem.id }
    if (mensagem.foto) {
      for (const largura of LARGURAS_FOTO_DO_CHAT) {
        await apagarDoDisco(caminhoDaFotoDoChat(conversaId, mensagem.foto, largura), { tipo: 'foto_chat', ...detalhes })
      }
    }
    const video = mensagem.video ? caminhoDoVideoDoChat(conversaId, mensagem.video) : null
    if (video) await apagarDoDisco(video, { tipo: 'video_chat', ...detalhes })
    const audio = mensagem.audio ? caminhoDoAudioDoChat(conversaId, mensagem.audio) : null
    if (audio) await apagarDoDisco(audio, { tipo: 'audio_chat', ...detalhes })
  }
}
