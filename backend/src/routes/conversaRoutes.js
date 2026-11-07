import { Router } from 'express'
import * as conversa from '../controllers/conversaController.js'
import { exigirLogin } from '../middlewares/autenticacao.js'

export const conversaRoutes = Router()

conversaRoutes.use(exigirLogin)
conversaRoutes.post('/', conversa.abrir)
conversaRoutes.get('/', conversa.listar)
conversaRoutes.get('/nao-lidas', conversa.contarNaoLidas)
conversaRoutes.get('/:id/mensagens', conversa.verMensagens)
conversaRoutes.post('/:id/mensagens', conversa.enviarMensagem)
