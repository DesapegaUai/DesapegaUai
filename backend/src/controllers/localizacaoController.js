// /api/localizacao
import * as geocodificacao from '../services/geocodificacaoService.js'
import * as localizacao from '../services/localizacaoService.js'
import { lerId } from '../utils/validacao.js'
import * as v from '../validations/localizacaoValidation.js'

const usuarioDe = (req) => req.usuario?.id ?? null

// POST /api/localizacao/atual
export async function registrarAtual(req, res) {
  const resultado = await localizacao.salvarLocalizacaoAtual(req.usuario.id, req.body ?? {})
  res.status(resultado.criada ? 201 : 200).json(resultado)
}

// GET /api/localizacao/atual
export async function consultarAtual(req, res) {
  res.json({ localizacao: await localizacao.consultarLocalizacaoAtual(req.usuario.id) })
}

// PATCH /api/localizacao/atual
export async function atualizarAtual(req, res) {
  res.json(await localizacao.salvarLocalizacaoAtual(req.usuario.id, req.body ?? {}, { exigirExistente: true }))
}

// DELETE /api/localizacao/atual
export async function removerAtual(req, res) {
  await localizacao.removerLocalizacaoAtual(req.usuario.id)
  res.status(204).end()
}

// GET e PUT /api/localizacao/preferencias
export async function consultarPreferencias(req, res) {
  res.json(await localizacao.consultarPreferencias(req.usuario.id))
}
export async function salvarPreferencias(req, res) {
  res.json(await localizacao.salvarPreferencias(req.usuario.id, req.body ?? {}))
}

// GET /api/localizacao/proximos
export async function proximos(req, res) {
  res.json(await localizacao.buscarProximos(req.query, usuarioDe(req)))
}

// GET /api/localizacao/mapa
export async function mapa(req, res) {
  res.json(await localizacao.marcadoresDoMapa(req.query))
}

// GET /api/localizacao/distancia
export async function distancia(req, res) {
  res.json(await localizacao.calcularDistancia(req.query, usuarioDe(req)))
}

// GET /api/localizacao/endereco
export async function enderecoDoPonto(req, res) {
  const ponto = v.lerCoordenadas(req.query.latitude, req.query.longitude, { obrigatorio: true })
  res.json(await geocodificacao.enderecoDoPonto(ponto.latitude, ponto.longitude))
}

// GET /api/localizacao/sugestoes
export async function sugestoes(req, res) {
  res.json(await localizacao.sugerirRegioes(req.query, usuarioDe(req)))
}

// GET /api/localizacao/raios
export function raios(req, res) {
  res.json(localizacao.raiosDisponiveis())
}

// GET /api/localizacao/cep/:cep
export async function cep(req, res) {
  res.json(await geocodificacao.localDoCep(v.lerCep(req.params.cep, 'cep') ?? ''))
}

// GET /api/localizacao/anuncios/:id
export async function localDoAnuncio(req, res) {
  res.json(await localizacao.localizacaoDoAnuncio(lerId(req.params.id, 'id do anúncio'), usuarioDe(req)))
}

// POST /api/localizacao/anuncios/:id
export async function registrarLocalDoAnuncio(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')
  res.status(201).json(await localizacao.definirLocalizacaoDoAnuncio(id, req.usuario.id, req.body ?? {}, { criar: true }))
}

// PATCH /api/localizacao/anuncios/:id
export async function atualizarLocalDoAnuncio(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')
  res.json(await localizacao.definirLocalizacaoDoAnuncio(id, req.usuario.id, req.body ?? {}, { criar: false }))
}
