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

// "v" é a versão das sessões da conta (usuario.versao_sessao) na hora do login
export function gerarToken(usuarioId, versao = 0) {
  return jwt.sign({ v: versao }, env.jwtSegredo, {
    subject: String(usuarioId),
    expiresIn: VALIDADE_EM_SEGUNDOS,
    algorithm: 'HS256',
  })
}

// devolve { usuarioId, versao }, ou null se o token faltar, for falso ou tiver vencido
export function lerToken(token) {
  if (typeof token !== 'string' || token === '') return null
  try {
    const { sub, v } = jwt.verify(token, env.jwtSegredo, { algorithms: ['HS256'] }) // recusa token sem assinatura
    const id = Number(sub)
    const versao = Number(v ?? 0) // token de antes da versão vale como versão 0
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(versao) || versao < 0) return null
    return { usuarioId: id, versao }
  } catch {
    return null
  }
}

// só o id do usuário (a assinatura e a validade); se a sessão ainda vale, quem confere é o autenticacao.js
export const verificarToken = (token) => lerToken(token)?.usuarioId ?? null

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

export function gravarCookieDeLogin(res, usuarioId, versao = 0) {
  res.cookie(NOME_DO_COOKIE, gerarToken(usuarioId, versao), {
    ...OPCOES_DO_COOKIE,
    maxAge: VALIDADE_EM_SEGUNDOS * 1000,
  })
}

export function apagarCookieDeLogin(res) {
  res.clearCookie(NOME_DO_COOKIE, OPCOES_DO_COOKIE)
}
