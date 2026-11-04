import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js'
import { rotas } from './routes/index.js'

export const app = express()

app.use(helmet()) // cabeçalhos de segurança
app.use(cors({ origin: env.frontendUrl, credentials: true })) // só o front-end pode chamar a API
app.use(express.json()) // lê o corpo das requisições em JSON

app.use('/api', rotas) // todas as rotas da API começam com /api

app.use(rotaNaoEncontrada)
app.use(tratarErros)
