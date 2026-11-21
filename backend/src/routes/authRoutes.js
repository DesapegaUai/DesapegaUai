import { Router } from 'express'
import * as auth from '../controllers/authController.js'
import { identificarUsuario } from '../middlewares/autenticacao.js'
import { limiteLogin } from '../middlewares/limites.js'

export const authRoutes = Router()

authRoutes.post('/google', limiteLogin, auth.entrarComGoogle)
authRoutes.get('/sessao', identificarUsuario, auth.sessao)
authRoutes.post('/logout', identificarUsuario, auth.sair)
authRoutes.post('/teste', auth.entrarTeste)
