import multer from 'multer'
import { erroHttp } from '../utils/erroHttp.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 8,
  },
  fileFilter(req, file, callback) {
    const tiposPermitidos = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
    ]

    if (!tiposPermitidos.includes(file.mimetype)) {
      return callback(erroHttp(400, 'Envie somente imagens JPG, PNG, WEBP ou AVIF.'))
    }

    callback(null, true)
  },
})

export function receberFotos(req, res, next) {
  upload.array('fotos', 8)(req, res, (erro) => {
    if (erro) {
      if (erro.code === 'LIMIT_FILE_SIZE') {
        return next(erroHttp(400, 'Cada foto pode ter no máximo 8 MB.'))
      }

      if (erro.code === 'LIMIT_FILE_COUNT') {
        return next(erroHttp(400, 'Você pode enviar no máximo 8 fotos por vez.'))
      }

      if (erro.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(erroHttp(400, 'Campo de fotos inválido. Use o campo fotos.'))
      }

      return next(erro)
    }

    next()
  })
}