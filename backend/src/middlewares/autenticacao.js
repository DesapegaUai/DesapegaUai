import { erroHttp } from '../utils/erroHttp.js'
import { lerTokenDoCookie, verificarToken } from '../utils/token.js'

// sem login, responde 401; com login, o id fica em req.usuario.id
export function exigirLogin(req, res, next) {
  const usuarioId = verificarToken(lerTokenDoCookie(req.headers.cookie))
  if (!usuarioId) throw erroHttp(401, 'Faça login para continuar.')
  req.usuario = { id: usuarioId }
  next()
}

// login opcional: sem login, req.usuario fica null
export function identificarUsuario(req, res, next) {
  const usuarioId = verificarToken(lerTokenDoCookie(req.headers.cookie))
  req.usuario = usuarioId ? { id: usuarioId } : null
  next()
}
