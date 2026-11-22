import { Router } from 'express'
import * as conversa from '../controllers/conversaController.js'
import * as comparecimento from '../controllers/comparecimentoController.js'
import * as denuncia from '../controllers/denunciaController.js'
import { exigirLogin } from '../middlewares/autenticacao.js'
import { limiteGravacao, limiteMensagens } from '../middlewares/limites.js'
import { receberFotosDoChat, receberVideoDoChat } from '../middlewares/upload.js'

export const conversaRoutes = Router()

conversaRoutes.use(exigirLogin)
conversaRoutes.post('/', limiteGravacao, conversa.abrir)
conversaRoutes.get('/', conversa.listar)
conversaRoutes.get('/nao-lidas', conversa.contarNaoLidas)
conversaRoutes.get('/:id/mensagens', conversa.verMensagens)
conversaRoutes.post('/:id/mensagens', limiteMensagens, conversa.enviarMensagem)
conversaRoutes.patch('/:id/mensagens/:mensagemId', limiteMensagens, conversa.editarMensagem)
conversaRoutes.delete('/:id/mensagens/:mensagemId', limiteGravacao, conversa.apagarMensagem)
conversaRoutes.post('/:id/fotos', limiteMensagens, receberFotosDoChat, conversa.enviarFotos)
conversaRoutes.get('/:id/fotos/:arquivo', conversa.verFoto)
conversaRoutes.post('/:id/videos', limiteMensagens, receberVideoDoChat, conversa.enviarVideo)
conversaRoutes.get('/:id/videos/:arquivo', conversa.verVideo)
conversaRoutes.get('/:id/denuncia', denuncia.ver)
conversaRoutes.post('/:id/denuncia', limiteGravacao, denuncia.criar)
conversaRoutes.get('/:id/comparecimento', comparecimento.ver)
conversaRoutes.post('/:id/comparecimento', limiteGravacao, comparecimento.responder)
conversaRoutes.delete('/:id', limiteGravacao, conversa.excluir)
