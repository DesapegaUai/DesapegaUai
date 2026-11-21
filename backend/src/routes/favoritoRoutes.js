import { Router } from 'express'
import * as favorito from '../controllers/favoritoController.js'
import { exigirLogin } from '../middlewares/autenticacao.js'
import { limiteGravacao } from '../middlewares/limites.js'

export const favoritoRoutes = Router()

favoritoRoutes.use(exigirLogin)
favoritoRoutes.get('/', favorito.listar)
favoritoRoutes.post('/:anuncioId', limiteGravacao, favorito.favoritar)
favoritoRoutes.delete('/:anuncioId', limiteGravacao, favorito.desfavoritar)
