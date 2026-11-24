// Fotos dos anúncios: uploads/anuncios/<id do anúncio>/<arquivo>-400.webp (e -800, -1600)
import os from 'node:os'
import path from 'node:path'

// Nos testes automáticos (node --test) as fotos vão para uma pasta temporária, separada das fotos do
// site: teste nenhum grava nem apaga em backend/uploads. PASTA_UPLOADS e PASTA_UPLOADS_PRIVADOS no
// ambiente trocam o lugar (os testes de navegador usam isso).
const PASTA_DOS_TESTES = process.env.NODE_TEST_CONTEXT ? path.join(os.tmpdir(), 'desapegauai-testes') : null
const pastaDe = (variavel, nome) => {
  if (process.env[variavel]) return path.resolve(process.env[variavel])
  return PASTA_DOS_TESTES ? path.join(PASTA_DOS_TESTES, nome) : path.join(import.meta.dirname, '..', '..', nome)
}

export const PASTA_UPLOADS = pastaDe('PASTA_UPLOADS', 'uploads')
export const LARGURAS_FOTO = [400, 800, 1600]
const NOME_DA_LARGURA = { 400: 'pequena', 800: 'media', 1600: 'grande' }

// mesma regra do ck_foto_anuncio_arquivo no schema: nada de "..", "/" ou "\" no nome
const ARQUIVO_SEGURO = /^[A-Za-z0-9_-]{1,64}$/

function conferirId(anuncioId) {
  const id = Number(anuncioId)
  if (!Number.isSafeInteger(id) || id < 1) throw new Error(`Id de anúncio inválido: ${anuncioId}`)
  return id
}

function conferirArquivo(arquivo) {
  if (typeof arquivo !== 'string' || !ARQUIVO_SEGURO.test(arquivo)) {
    throw new Error(`Nome de foto inválido: ${arquivo}`)
  }
  return arquivo
}

export function pastaDoAnuncio(anuncioId) {
  return path.join(PASTA_UPLOADS, 'anuncios', String(conferirId(anuncioId)))
}

export function caminhoDaFoto(anuncioId, arquivo, largura) {
  if (!LARGURAS_FOTO.includes(largura)) throw new Error(`Largura de foto inválida: ${largura}`)
  return path.join(pastaDoAnuncio(anuncioId), `${conferirArquivo(arquivo)}-${largura}.webp`)
}

export function pastaDoPerfil(usuarioId) {
  return path.join(PASTA_UPLOADS, 'perfis', String(conferirId(usuarioId)))
}

export function caminhoDaFotoDePerfil(usuarioId, arquivo) {
  if (typeof arquivo !== 'string' || !/^[a-f0-9]{32}\.webp$/.test(arquivo)) {
    throw new Error(`Nome de foto de perfil inválido: ${arquivo}`)
  }
  return path.join(pastaDoPerfil(usuarioId), arquivo)
}

// { pequena, media, grande }
export function urlsDaFoto(anuncioId, arquivo) {
  const id = conferirId(anuncioId)
  conferirArquivo(arquivo)
  const urls = {}
  for (const largura of LARGURAS_FOTO) {
    urls[NOME_DA_LARGURA[largura]] = `/api/uploads/anuncios/${id}/${arquivo}-${largura}.webp`
  }
  return urls
}

// { id, ordem, pequena, media, grande }, ou null quando o anúncio não tem foto
export function formatarFoto(anuncioId, foto) {
  if (!foto?.arquivo) return null
  return { id: foto.id, ordem: foto.ordem, ...urlsDaFoto(anuncioId, foto.arquivo) }
}

// ---------------------------------------------------------------- fotos do chat
// Ficam fora da pasta uploads (que é pública): só quem participa da conversa pode ver,
// então elas são entregues por uma rota com login (GET /api/conversas/:id/fotos/:arquivo).
// Caminho: uploads-privados/conversas/<id da conversa>/<foto>-480.webp (e -1600)
export const PASTA_PRIVADA = pastaDe('PASTA_UPLOADS_PRIVADOS', 'uploads-privados')
export const LARGURAS_FOTO_DO_CHAT = [480, 1600]
const NOME_DA_LARGURA_DO_CHAT = { 480: 'pequena', 1600: 'grande' }
const FOTO_DO_CHAT = /^[a-f0-9]{32}$/
const ARQUIVO_DO_CHAT = /^([a-f0-9]{32})-(480|1600)\.webp$/

export function pastaDaConversa(conversaId) {
  return path.join(PASTA_PRIVADA, 'conversas', String(conferirId(conversaId)))
}

export function caminhoDaFotoDoChat(conversaId, foto, largura) {
  if (!LARGURAS_FOTO_DO_CHAT.includes(largura)) throw new Error(`Largura de foto inválida: ${largura}`)
  if (typeof foto !== 'string' || !FOTO_DO_CHAT.test(foto)) throw new Error(`Nome de foto inválido: ${foto}`)
  return path.join(pastaDaConversa(conversaId), `${foto}-${largura}.webp`)
}

// "<foto>-480.webp" vindo da URL -> caminho no disco, ou null se o nome não for de uma foto do chat
export function caminhoDoArquivoDoChat(conversaId, arquivo) {
  const partes = typeof arquivo === 'string' ? arquivo.match(ARQUIVO_DO_CHAT) : null
  if (!partes) return null
  return caminhoDaFotoDoChat(conversaId, partes[1], Number(partes[2]))
}

// vídeos do chat: "<32 letras e números>.<mp4|webm|mov>", na mesma pasta privada das fotos da conversa
const VIDEO_DO_CHAT = /^[a-f0-9]{32}\.(mp4|webm|mov)$/

export function caminhoDoVideoDoChat(conversaId, video) {
  if (typeof video !== 'string' || !VIDEO_DO_CHAT.test(video)) return null
  return path.join(pastaDaConversa(conversaId), video)
}

// { url, tipo }, ou null quando a mensagem não tem vídeo
export function formatarVideoDoChat(conversaId, video) {
  if (!video) return null
  return { url: `/api/conversas/${conferirId(conversaId)}/videos/${video}` }
}

// áudios do chat: "<32 letras e números>.m4a" (todo áudio é convertido para M4A), na mesma pasta privada
export const AUDIO_DO_CHAT = /^[a-f0-9]{32}\.m4a$/

export function caminhoDoAudioDoChat(conversaId, audio) {
  if (typeof audio !== 'string' || !AUDIO_DO_CHAT.test(audio)) return null
  return path.join(pastaDaConversa(conversaId), audio)
}

// { url, segundos, ondas }, ou null quando a mensagem não tem áudio.
// ondas: um caractere por barrinha, de "0" (silêncio, reto) a "v" (fala alta)
export function formatarAudioDoChat(conversaId, audio, segundos, ondas) {
  if (!audio) return null
  return { url: `/api/conversas/${conferirId(conversaId)}/audios/${audio}`, segundos: Number(segundos) || null, ondas: ondas ?? '' }
}

// { pequena, grande }, ou null quando a mensagem não tem foto
export function formatarFotoDoChat(conversaId, foto) {
  if (!foto) return null
  const id = conferirId(conversaId)
  const urls = {}
  for (const largura of LARGURAS_FOTO_DO_CHAT) {
    urls[NOME_DA_LARGURA_DO_CHAT[largura]] = `/api/conversas/${id}/fotos/${foto}-${largura}.webp`
  }
  return urls
}
