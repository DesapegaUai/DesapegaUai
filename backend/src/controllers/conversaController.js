// Anthony. Já pronto para usar: req.usuario.id, erroHttp, lerId/lerTexto (utils/validacao)
// e, no Socket.IO, lerTokenDoCookie e verificarToken (utils/token).
import { erroHttp } from '../utils/erroHttp.js'

function naoImplementado() {
  throw erroHttp(501, 'Ainda não implementado.')
}

// POST /api/conversas (A2)
export async function abrir(req, res) {
  naoImplementado()
}

// GET /api/conversas (A2)
export async function listar(req, res) {
  naoImplementado()
}

// GET /api/conversas/nao-lidas (A2)
export async function contarNaoLidas(req, res) {
  naoImplementado()
}

// GET /api/conversas/:id/mensagens (A3)
export async function verMensagens(req, res) {
  naoImplementado()
}

// POST /api/conversas/:id/mensagens (A3)
export async function enviarMensagem(req, res) {
  naoImplementado()
}
