import { Router } from 'express'
import * as auth from '../controllers/authController.js'
import { identificarUsuario } from '../middlewares/autenticacao.js'

export const authRoutes = Router()

authRoutes.post('/google', auth.entrarComGoogle)
authRoutes.get('/sessao', identificarUsuario, auth.sessao)
authRoutes.post('/logout', auth.sair)
authRoutes.post('/teste', auth.entrarTeste)
