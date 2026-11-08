import { Router } from 'express'
import * as perfil from '../controllers/perfilController.js'
import { exigirLogin } from '../middlewares/autenticacao.js'

export const perfilRoutes = Router()

perfilRoutes.use(exigirLogin)
perfilRoutes.get('/', perfil.verPerfil)
perfilRoutes.put('/', perfil.editarPerfil)
