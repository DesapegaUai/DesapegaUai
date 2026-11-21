import { Router } from 'express'
import * as procura from '../controllers/procuraController.js'
import { exigirLogin, identificarUsuario } from '../middlewares/autenticacao.js'
import { limiteGravacao } from '../middlewares/limites.js'

export const procuraRoutes = Router()

procuraRoutes.get('/', identificarUsuario, procura.listar)
procuraRoutes.post('/', exigirLogin, limiteGravacao, procura.criar)
procuraRoutes.delete('/:id', exigirLogin, limiteGravacao, procura.excluir)
