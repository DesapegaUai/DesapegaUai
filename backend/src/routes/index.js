// Junta todas as rotas da API. Cada módulo ganha o seu arquivo nesta pasta
// (ex.: anuncioRoutes.js) e é ligado aqui com rotas.use('/anuncios', anuncioRoutes).
import { Router } from 'express'
import * as saude from '../controllers/saudeController.js'

export const rotas = Router()

rotas.get('/saude', saude.verificar) // GET /api/saude
