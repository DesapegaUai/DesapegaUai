import { Router } from 'express'
import * as lista from '../controllers/listaDeComprasController.js'
import { exigirLogin } from '../middlewares/autenticacao.js'
import { limiteBuscaGeografica, limiteGravacao } from '../middlewares/limites.js'

export const listaDeComprasRoutes = Router()

listaDeComprasRoutes.use(exigirLogin)
listaDeComprasRoutes.get('/', limiteBuscaGeografica, lista.listar)
listaDeComprasRoutes.post('/', limiteGravacao, lista.criar)
listaDeComprasRoutes.patch('/:id', limiteGravacao, lista.atualizar)
listaDeComprasRoutes.delete('/:id', limiteGravacao, lista.excluir)
