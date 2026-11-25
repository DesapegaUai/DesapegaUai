// Lista de compras (precisa de login; cada pessoa só vê e muda a própria lista).
import * as lista from '../services/listaDeComprasService.js'
import { lerId } from '../utils/validacao.js'

// GET /api/lista-compras?cidade_id=1&raio_km=5 (a mesma referência de local da busca por proximidade)
export async function listar(req, res) {
  res.json(await lista.listar(req.usuario.id, req.query))
}

// POST /api/lista-compras { texto, cidade_id }
export async function criar(req, res) {
  res.status(201).json(await lista.criar(req.usuario.id, req.body))
}

// PATCH /api/lista-compras/:id { comprado }
export async function atualizar(req, res) {
  res.json(await lista.atualizar(req.usuario.id, lerId(req.params.id, 'id do item'), req.body))
}

// DELETE /api/lista-compras/:id
export async function excluir(req, res) {
  await lista.excluir(req.usuario.id, lerId(req.params.id, 'id do item'))
  res.status(204).end()
}
