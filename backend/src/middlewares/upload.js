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

// Vídeo mandado no chat: um por envio, no campo video, até 25 MB (MP4, MOV do iPhone ou WebM)
export const MAXIMO_DO_VIDEO_MB = 25
const TIPOS_DE_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']

const uploadVideoDoChat = multer({
  storage: armazenamentoEmMemoria,
  limits: { fileSize: MAXIMO_DO_VIDEO_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!TIPOS_DE_VIDEO.includes(file.mimetype)) return callback(erroHttp(400, 'Envie um vídeo MP4, MOV ou WebM.'))
    callback(null, true)
  },
}).single('video')

export function receberVideoDoChat(req, res, next) {
  uploadVideoDoChat(req, res, (erro) => {
    if (!erro) return next()
    if (!erro.status) {
      const mensagens = {
        LIMIT_FILE_SIZE: `O vídeo pode ter no máximo ${MAXIMO_DO_VIDEO_MB} MB.`,
        LIMIT_FILE_COUNT: 'Envie um vídeo por vez.',
        LIMIT_UNEXPECTED_FILE: 'Envie o vídeo no campo video.',
      }
      return next(erroHttp(400, mensagens[erro.code] ?? 'Não foi possível ler o envio. Mande como multipart/form-data, com o vídeo no campo video.'))
    }
    next(erro)
  })
}

// Áudio gravado no chat: um por envio, no campo audio, até 5 MB (2 minutos cabem com folga).
// O tipo que o navegador diz só serve de primeira peneira: quem decide é o começo do arquivo, na conversão.
const MAXIMO_DO_AUDIO_MB = 5
const TIPOS_DE_AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'video/webm', 'video/mp4', 'application/octet-stream']

const uploadAudioDoChat = multer({
  storage: armazenamentoEmMemoria,
  limits: { fileSize: MAXIMO_DO_AUDIO_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!TIPOS_DE_AUDIO.includes(file.mimetype.split(';')[0].trim())) return callback(erroHttp(400, 'Envie um áudio gravado pelo chat.'))
    callback(null, true)
  },
}).single('audio')

export function receberAudioDoChat(req, res, next) {
  uploadAudioDoChat(req, res, (erro) => {
    if (!erro) return next()
    if (!erro.status) {
      const mensagens = {
        LIMIT_FILE_SIZE: `O áudio pode ter no máximo ${MAXIMO_DO_AUDIO_MB} MB.`,
        LIMIT_FILE_COUNT: 'Envie um áudio por vez.',
        LIMIT_UNEXPECTED_FILE: 'Envie o áudio no campo audio.',
      }
      return next(erroHttp(400, mensagens[erro.code] ?? 'Não foi possível ler o envio. Mande como multipart/form-data, com o áudio no campo audio.'))
    }
    next(erro)
  })
}

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
