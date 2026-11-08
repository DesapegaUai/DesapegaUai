// Fotos do anúncio (M1): o multer guarda em memória e o controller converte com o sharp.
import multer from 'multer'
import { erroHttp } from '../utils/erroHttp.js'

export const MAXIMO_DE_FOTOS = 8

// só JPG, PNG e WebP: o sharp instalado pelo npm não lê HEIC
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: MAXIMO_DE_FOTOS,
  },
  fileFilter(req, file, callback) {
    if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
      return callback(erroHttp(400, 'Envie somente fotos JPG, PNG ou WebP.'))
    }

    callback(null, true)
  },
})

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
