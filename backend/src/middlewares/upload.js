// Fotos do anúncio (M1): o multer guarda em memória e o controller converte com o sharp.
import multer from 'multer'
import { erroHttp } from '../utils/erroHttp.js'

export const MAXIMO_DE_FOTOS = 8

// só JPG, PNG e WebP: o sharp instalado pelo npm não lê HEIC
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']

const armazenamentoEmMemoria = multer.memoryStorage()
const filtroDeImagem = (req, file, callback) => {
  if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
    return callback(erroHttp(400, 'Envie somente fotos JPG, PNG ou WebP.'))
  }

  callback(null, true)
}

const upload = multer({
  storage: armazenamentoEmMemoria,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: MAXIMO_DE_FOTOS,
  },
  fileFilter: filtroDeImagem,
})

const uploadFotoPerfil = multer({
  storage: armazenamentoEmMemoria,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: filtroDeImagem,
}).single('foto')

const MENSAGENS_DO_MULTER = {
  LIMIT_FILE_SIZE: 'Cada foto pode ter no máximo 8 MB.',
  LIMIT_FILE_COUNT: `Você pode enviar no máximo ${MAXIMO_DE_FOTOS} fotos.`,
  LIMIT_UNEXPECTED_FILE: 'Envie as fotos no campo fotos.',
}

export function receberFotos(req, res, next) {
  upload.array('fotos', MAXIMO_DE_FOTOS)(req, res, (erro) => {
    if (!erro) return next()

    // erro do multer ou envio quebrado também é culpa do pedido: 400, e não 500
    if (!erro.status) {
      return next(
        erroHttp(
          400,
          MENSAGENS_DO_MULTER[erro.code] ??
            'Não foi possível ler o envio. Mande como multipart/form-data, com as fotos no campo fotos.',
        ),
      )
    }

    next(erro)
  })
}

// Fotos mandadas no chat: até 5 por envio, no campo fotos
export const MAXIMO_DE_FOTOS_NO_CHAT = 5

const uploadFotosDoChat = multer({
  storage: armazenamentoEmMemoria,
  limits: { fileSize: 8 * 1024 * 1024, files: MAXIMO_DE_FOTOS_NO_CHAT },
  fileFilter: filtroDeImagem,
}).array('fotos', MAXIMO_DE_FOTOS_NO_CHAT)

export function receberFotosDoChat(req, res, next) {
  uploadFotosDoChat(req, res, (erro) => {
    if (!erro) return next()

    if (!erro.status) {
      const mensagens = {
        LIMIT_FILE_SIZE: 'Cada foto pode ter no máximo 8 MB.',
        LIMIT_FILE_COUNT: `Você pode enviar no máximo ${MAXIMO_DE_FOTOS_NO_CHAT} fotos por vez.`,
        LIMIT_UNEXPECTED_FILE: `Envie até ${MAXIMO_DE_FOTOS_NO_CHAT} fotos no campo fotos.`,
      }
      return next(
        erroHttp(400, mensagens[erro.code] ?? 'Não foi possível ler o envio. Mande como multipart/form-data, com as fotos no campo fotos.'),
      )
    }

    next(erro)
  })
}

export function receberFotoPerfil(req, res, next) {
  uploadFotoPerfil(req, res, (erro) => {
    if (!erro) return next()

    if (!erro.status) {
      const mensagem =
        erro.code === 'LIMIT_FILE_SIZE'
          ? 'A foto de perfil pode ter no máximo 5 MB.'
          : 'Envie uma foto no campo foto, em JPG, PNG ou WebP.'
      return next(erroHttp(400, mensagem))
    }

    next(erro)
  })
}
