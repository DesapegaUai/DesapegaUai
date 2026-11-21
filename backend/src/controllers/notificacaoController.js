// /api/notificacoes: o sininho (histórico e preferências) e os aparelhos com push.
import * as notificacoes from '../services/notificacaoService.js'
import { chavePublica } from '../services/pushService.js'

export async function listar(req, res) {
  res.json(await notificacoes.listar(req.usuario.id, req.query))
}

export async function marcarLidas(req, res) {
  res.json(await notificacoes.marcarLidas(req.usuario.id, req.body ?? {}))
}

export async function consultarPreferencias(req, res) {
  res.json(await notificacoes.consultarPreferencias(req.usuario.id))
}

export async function salvarPreferencias(req, res) {
  res.json(await notificacoes.salvarPreferencias(req.usuario.id, req.body ?? {}))
}

export function chavePush(req, res) {
  res.json({ chave_publica: chavePublica() })
}

export async function inscreverAparelho(req, res) {
  await notificacoes.inscreverAparelho(req.usuario.id, req.body ?? {})
  res.status(201).json({ inscrito: true })
}

export async function removerAparelho(req, res) {
  await notificacoes.removerAparelho(req.usuario.id, req.body ?? {})
  res.status(204).end()
}
