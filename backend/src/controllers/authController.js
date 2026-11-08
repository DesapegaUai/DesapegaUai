import { OAuth2Client } from 'google-auth-library'
import { env } from '../config/env.js'
import * as usuarioModel from '../models/usuarioModel.js'
import { erroHttp } from '../utils/erroHttp.js'
import { apagarCookieDeLogin, gravarCookieDeLogin } from '../utils/token.js'
import { lerId } from '../utils/validacao.js'

const clienteGoogle = new OAuth2Client()

// POST /api/auth/google
export async function entrarComGoogle(req, res) {
  if (!env.googleClientId) {
    throw erroHttp(503, 'Login com Google não configurado: falta o GOOGLE_CLIENT_ID no .env da API.')
  }

  const credential = req.body?.credential
  if (typeof credential !== 'string' || credential.trim() === '') {
    throw erroHttp(400, 'Envie o campo credential com o token do Google.')
  }

  let dadosGoogle
  try {
    const ticket = await clienteGoogle.verifyIdToken({ idToken: credential, audience: env.googleClientId })
    dadosGoogle = ticket.getPayload()
  } catch {
    throw erroHttp(401, 'Não foi possível confirmar o login com o Google. Tente de novo.')
  }

  if (!dadosGoogle?.sub || !dadosGoogle.email || dadosGoogle.email_verified !== true) {
    throw erroHttp(401, 'A conta Google precisa ter um e-mail verificado.')
  }

  const foto = dadosGoogle.picture
  const fotoUrl = typeof foto === 'string' && foto.length <= 500 ? foto : null
  const usuario = await usuarioModel.entrarComGoogle({
    googleId: dadosGoogle.sub,
    nome: (dadosGoogle.name || dadosGoogle.email.split('@')[0]).slice(0, 120),
    email: dadosGoogle.email,
    fotoUrl,
  })

  gravarCookieDeLogin(res, usuario.id)
  res.json({ usuario })
}

// GET /api/auth/sessao
export async function sessao(req, res) {
  if (!req.usuario) return res.json({ usuario: null })

  const usuario = await usuarioModel.buscarPorId(req.usuario.id)
  if (!usuario) {
    apagarCookieDeLogin(res) // usuário não existe mais no banco
    return res.json({ usuario: null })
  }
  res.json({ usuario })
}

// POST /api/auth/logout
export function sair(req, res) {
  apagarCookieDeLogin(res)
  res.status(204).end()
}

// POST /api/auth/teste (desligada, responde 404 como se nem existisse)
export async function entrarTeste(req, res) {
  if (!env.permitirLoginTeste) {
    throw erroHttp(404, `Rota não encontrada: ${req.method} ${req.originalUrl}`)
  }

  const usuarioId = lerId(req.body?.usuario_id, 'usuario_id')
  const usuario = await usuarioModel.buscarUsuarioDeTeste(usuarioId)
  if (!usuario) {
    throw erroHttp(404, 'Usuário de teste não encontrado. Use 1, 2 ou 3, e confira se rodou o npm run banco.')
  }

  await usuarioModel.registrarAcesso(usuario.id)
  gravarCookieDeLogin(res, usuario.id)
  res.json({ usuario })
}
