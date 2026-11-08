import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js'
import { rotas } from './routes/index.js'
import { PASTA_UPLOADS } from './utils/fotos.js'

export const app = express()

app.use(helmet())
app.use(cors({ origin: env.frontendUrl, credentials: true })) // só o front pode chamar a API
app.use(express.json())

// fotos dos anúncios; o helmet bloqueia imagem de outra origem, então aqui libera
app.use(
  '/api/uploads',
  (req, res, next) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin')
    next()
  },
  express.static(PASTA_UPLOADS, { index: false, maxAge: '30d', immutable: true }),
)

app.use('/api', rotas)

app.use(rotaNaoEncontrada)
app.use(tratarErros)
