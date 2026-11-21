import * as usuarioModel from '../models/usuarioModel.js'
import { erroHttp } from '../utils/erroHttp.js'
import { apagarCookieDeLogin, lerToken, lerTokenDoCookie } from '../utils/token.js'

// Dono do cookie: o token tem que ser verdadeiro, de uma conta que existe e da sessão atual
// (sair da conta aumenta a versão, e os tokens de antes deixam de valer). Devolve o id ou null.
// No Socket.IO: usuarioDoCookie(socket.handshake.headers.cookie)
export async function usuarioDoCookie(cabecalhoCookie) {
  const token = lerToken(lerTokenDoCookie(cabecalhoCookie))
  if (!token) return null
  const versao = await usuarioModel.versaoDaSessao(token.usuarioId)
  return versao !== null && versao === token.versao ? token.usuarioId : null
}

// sem login, responde 401; com login, o id fica em req.usuario.id
export async function exigirLogin(req, res, next) {
  const usuarioId = await usuarioDoCookie(req.headers.cookie)
  if (!usuarioId) {
    // token bom de uma conta que não existe mais, ou de antes de sair da conta
    if (lerTokenDoCookie(req.headers.cookie)) apagarCookieDeLogin(res)
    throw erroHttp(401, 'Faça login para continuar.')
  }
  req.usuario = { id: usuarioId }
  next()
}

// login opcional: sem login, req.usuario fica null
export async function identificarUsuario(req, res, next) {
  const usuarioId = await usuarioDoCookie(req.headers.cookie)
  req.usuario = usuarioId ? { id: usuarioId } : null
  next()
}
