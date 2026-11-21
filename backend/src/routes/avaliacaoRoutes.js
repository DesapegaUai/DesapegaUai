import { Router } from 'express'
import * as avaliacao from '../controllers/avaliacaoController.js'
import { exigirLogin } from '../middlewares/autenticacao.js'
import { limiteGravacao } from '../middlewares/limites.js'

export const avaliacaoRoutes = Router()

avaliacaoRoutes.get('/usuarios/:id', avaliacao.listarUsuario)
avaliacaoRoutes.get('/minhas', exigirLogin, avaliacao.listarMinhas)
avaliacaoRoutes.post('/conversas/:id', exigirLogin, limiteGravacao, avaliacao.criar)
