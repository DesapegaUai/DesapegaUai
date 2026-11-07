// Cookie "token" com um JWT de 7 dias (httpOnly, sameSite lax e, em produção, só por HTTPS).
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

const NOME_DO_COOKIE = 'token'
const VALIDADE_EM_SEGUNDOS = 7 * 24 * 60 * 60

// sem um segredo forte daria para forjar login, então a API nem sobe
if (env.jwtSegredo.length < 32) {
  throw new Error(
    'Falta o JWT_SEGREDO no backend/.env (mínimo de 32 caracteres). Gere um com:\n' +
      `  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
  )
}

export function gerarToken(usuarioId) {
  return jwt.sign({}, env.jwtSegredo, {
    subject: String(usuarioId),
    expiresIn: VALIDADE_EM_SEGUNDOS,
    algorithm: 'HS256',
  })
}

// devolve o id do usuário, ou null se o token faltar, for falso ou tiver vencido
export function verificarToken(token) {
  if (typeof token !== 'string' || token === '') return null
  try {
    const { sub } = jwt.verify(token, env.jwtSegredo, { algorithms: ['HS256'] }) // recusa token sem assinatura
    const id = Number(sub)
    return Number.isSafeInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

// no Socket.IO: lerTokenDoCookie(socket.handshake.headers.cookie)
export function lerTokenDoCookie(cabecalhoCookie) {
  if (typeof cabecalhoCookie !== 'string') return null
  for (const parte of cabecalhoCookie.split(';')) {
    const igual = parte.indexOf('=')
    if (igual !== -1 && parte.slice(0, igual).trim() === NOME_DO_COOKIE) {
      return parte.slice(igual + 1).trim() || null
    }
  }
  return null
}

const OPCOES_DO_COOKIE = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.producao,
  path: '/',
}

export function gravarCookieDeLogin(res, usuarioId) {
  res.cookie(NOME_DO_COOKIE, gerarToken(usuarioId), {
    ...OPCOES_DO_COOKIE,
    maxAge: VALIDADE_EM_SEGUNDOS * 1000,
  })
}

export function apagarCookieDeLogin(res) {
  res.clearCookie(NOME_DO_COOKIE, OPCOES_DO_COOKIE)
}
