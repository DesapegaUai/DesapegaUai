import { Router } from 'express'
import * as favorito from '../controllers/favoritoController.js'
import { exigirLogin } from '../middlewares/autenticacao.js'

export const favoritoRoutes = Router()

favoritoRoutes.use(exigirLogin)
favoritoRoutes.get('/', favorito.listar)
favoritoRoutes.post('/:anuncioId', favorito.favoritar)
favoritoRoutes.delete('/:anuncioId', favorito.desfavoritar)
