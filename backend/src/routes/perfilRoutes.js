import { Router } from 'express'
import * as perfil from '../controllers/perfilController.js'
import { exigirLogin } from '../middlewares/autenticacao.js'
import { limiteGravacao } from '../middlewares/limites.js'
import { receberFotoPerfil } from '../middlewares/upload.js'

export const perfilRoutes = Router()

perfilRoutes.use(exigirLogin)
perfilRoutes.get('/', perfil.verPerfil)
perfilRoutes.put('/', limiteGravacao, perfil.editarPerfil)
perfilRoutes.put('/foto', limiteGravacao, receberFotoPerfil, perfil.atualizarFoto)
perfilRoutes.delete('/foto', limiteGravacao, perfil.removerFoto)
perfilRoutes.delete('/', limiteGravacao, perfil.excluirConta)
