// Fotos dos anúncios: uploads/anuncios/<id do anúncio>/<arquivo>-400.webp (e -800, -1600)
import path from 'node:path'

export const PASTA_UPLOADS = path.join(import.meta.dirname, '..', '..', 'uploads')
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
