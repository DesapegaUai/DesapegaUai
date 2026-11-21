import * as localRepository from '../repositories/localRepository.js'
import { erroHttp } from '../utils/erroHttp.js'
import { lerId } from '../utils/validacao.js'
import { lerIdOpcional, lerTextoBusca } from '../validations/localizacaoValidation.js'

// GET /api/cidades: os 142 municípios da Zona da Mata mineira
export async function listarCidades(req, res) {
  res.json(await localRepository.listarCidades())
}

// GET /api/cidades/:id/bairros?busca=
export async function listarBairros(req, res) {
  const cidadeId = lerId(req.params.id, 'id da cidade')
  if (!(await localRepository.cidadeExiste(cidadeId))) throw erroHttp(404, 'Cidade não encontrada.')
  const busca = lerTextoBusca(req.query.busca, 'busca', { min: 1 })
  res.json(await localRepository.listarBairros(cidadeId, { busca }))
}

// GET /api/cidades/:id/ruas?busca=&bairro_id=&limite=: autocompletar rua (com CEP)
export async function listarRuas(req, res) {
  const cidadeId = lerId(req.params.id, 'id da cidade')
  if (!(await localRepository.cidadeExiste(cidadeId))) throw erroHttp(404, 'Cidade não encontrada.')
  const limite = Math.min(lerIdOpcional(req.query.limite, 'limite') ?? 20, 50)
  res.json(await localRepository.buscarRuas(cidadeId, {
    busca: lerTextoBusca(req.query.busca, 'busca'),
    bairroId: lerIdOpcional(req.query.bairro_id, 'bairro_id'),
    limite,
  }))
}
