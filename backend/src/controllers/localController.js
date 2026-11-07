import * as localModel from '../models/localModel.js'
import { erroHttp } from '../utils/erroHttp.js'
import { lerId } from '../utils/validacao.js'

// GET /api/cidades
export async function listarCidades(req, res) {
  res.json(await localModel.listarCidades())
}

// GET /api/cidades/:id/bairros
export async function listarBairros(req, res) {
  const cidadeId = lerId(req.params.id, 'id da cidade')
  if (!(await localModel.cidadeExiste(cidadeId))) throw erroHttp(404, 'Cidade não encontrada.')
  res.json(await localModel.listarBairros(cidadeId))
}
