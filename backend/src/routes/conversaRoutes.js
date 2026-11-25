import { Router } from 'express'
import * as conversa from '../controllers/conversaController.js'
import * as comparecimento from '../controllers/comparecimentoController.js'
import * as denuncia from '../controllers/denunciaController.js'
import { exigirLogin } from '../middlewares/autenticacao.js'
import { limiteGravacao, limiteMensagens, limiteMidia } from '../middlewares/limites.js'
import { receberAudioDoChat, receberFotosDoChat, receberVideoDoChat } from '../middlewares/upload.js'

export const conversaRoutes = Router()

conversaRoutes.use(exigirLogin)
conversaRoutes.post('/', limiteGravacao, conversa.abrir)
conversaRoutes.get('/', conversa.listar)
conversaRoutes.get('/nao-lidas', conversa.contarNaoLidas)
conversaRoutes.get('/:id/mensagens', conversa.verMensagens)
conversaRoutes.post('/:id/mensagens', limiteMensagens, conversa.enviarMensagem)
conversaRoutes.patch('/:id/mensagens/:mensagemId', limiteMensagens, conversa.editarMensagem)
conversaRoutes.delete('/:id/mensagens/:mensagemId', limiteGravacao, conversa.apagarMensagem)
conversaRoutes.post('/:id/fotos', limiteMensagens, limiteMidia, receberFotosDoChat, conversa.enviarFotos)
conversaRoutes.get('/:id/fotos/:arquivo', conversa.verFoto)
conversaRoutes.post('/:id/videos', limiteMensagens, limiteMidia, receberVideoDoChat, conversa.enviarVideo)
conversaRoutes.get('/:id/videos/:arquivo', conversa.verVideo)
conversaRoutes.post('/:id/audios', limiteMensagens, limiteMidia, receberAudioDoChat, conversa.enviarAudio)
conversaRoutes.get('/:id/audios/:arquivo', conversa.verAudio)
conversaRoutes.get('/:id/denuncia', denuncia.ver)
conversaRoutes.post('/:id/denuncia', limiteGravacao, denuncia.criar)
conversaRoutes.get('/:id/programadas', conversa.listarProgramadas)
conversaRoutes.post('/:id/programadas', limiteMensagens, conversa.programarMensagem)
conversaRoutes.post('/:id/programadas/:programadaId/enviar', limiteMensagens, conversa.enviarProgramadaAgora)
conversaRoutes.delete('/:id/programadas/:programadaId', limiteGravacao, conversa.apagarProgramada)
conversaRoutes.get('/:id/comparecimento', comparecimento.ver)
conversaRoutes.post('/:id/comparecimento', limiteGravacao, comparecimento.responder)
// fixar (como no WhatsApp): até 3 conversas no topo da minha lista; até 3 mensagens no topo da conversa
conversaRoutes.put('/:id/fixar', limiteGravacao, conversa.fixarConversa)
conversaRoutes.delete('/:id/fixar', limiteGravacao, conversa.desafixarConversa)
conversaRoutes.get('/:id/mensagens-fixadas', conversa.listarMensagensFixadas)
conversaRoutes.put('/:id/mensagens/:mensagemId/fixar', limiteGravacao, conversa.fixarMensagem)
conversaRoutes.delete('/:id/mensagens/:mensagemId/fixar', limiteGravacao, conversa.desafixarMensagem)
conversaRoutes.delete('/:id', limiteGravacao, conversa.excluir)
