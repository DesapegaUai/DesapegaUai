import { Router } from 'express'
import * as notificacao from '../controllers/notificacaoController.js'
import { exigirLogin } from '../middlewares/autenticacao.js'

export const notificacaoRoutes = Router()

notificacaoRoutes.get('/push/chave', notificacao.chavePush)
notificacaoRoutes.get('/', exigirLogin, notificacao.listar)
notificacaoRoutes.patch('/lidas', exigirLogin, notificacao.marcarLidas)
notificacaoRoutes.get('/preferencias', exigirLogin, notificacao.consultarPreferencias)
notificacaoRoutes.put('/preferencias', exigirLogin, notificacao.salvarPreferencias)
notificacaoRoutes.post('/push', exigirLogin, notificacao.inscreverAparelho)
notificacaoRoutes.delete('/push', exigirLogin, notificacao.removerAparelho)
