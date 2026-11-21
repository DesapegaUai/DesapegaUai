// Coordenada -> endereço aproximado (cidade, bairro, rua e CEP) e CEP -> local.
// Fonte principal: a base da Zona da Mata no banco (CNEFE/IBGE). Para saber em qual rua a pessoa
// está, consulta também o Nominatim (OpenStreetMap), com cache e no máximo 1 pedido por segundo,
// como a política de uso dele exige. Sem rede, funciona só com o banco.
import { env } from '../config/env.js'
import * as localRepository from '../repositories/localRepository.js'
import { erroHttp } from '../utils/erroHttp.js'
import { distanciaKm, municipioDoPonto } from '../utils/geo.js'
import { registrar } from '../utils/log.js'

const normalizar = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// ---------------------------------------------------------------- Nominatim

const cache = new Map() // chave: coordenada com 4 casas (~11 m)
const CACHE_MAX = 2000
const CACHE_MS = 60 * 60 * 1000
let filaNominatim = Promise.resolve()
let ultimoPedido = 0

async function consultarNominatim(lat, lng) {
  if (!env.geocodificacaoExterna) return null
  const chave = `${lat.toFixed(4)},${lng.toFixed(4)}`
  const guardado = cache.get(chave)
  if (guardado && Date.now() - guardado.em < CACHE_MS) return guardado.dados

  // fila: um pedido por vez, com 1,1 s entre eles
  const pedido = filaNominatim.then(async () => {
    const espera = ultimoPedido + 1100 - Date.now()
    if (espera > 0) await new Promise((ok) => setTimeout(ok, espera))
    ultimoPedido = Date.now()
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.search = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '18', addressdetails: '1', 'accept-language': 'pt-BR' })
    const resposta = await fetch(url, { headers: { 'User-Agent': env.nominatimUserAgent }, signal: AbortSignal.timeout(4000) })
    if (!resposta.ok) throw new Error(`Nominatim respondeu ${resposta.status}`)
    const json = await resposta.json()
    const a = json.address ?? {}
    return {
      rua: a.road ?? a.pedestrian ?? a.footway ?? a.residential ?? null,
      bairro: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? null,
      cep: /^\d{5}-?\d{3}$/.test(a.postcode ?? '') ? a.postcode.replace('-', '') : null,
    }
  })
  filaNominatim = pedido.catch(() => {})

  try {
    const dados = await pedido
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
    cache.set(chave, { em: Date.now(), dados })
    return dados
  } catch (erro) {
    // sem coordenadas no log (LGPD)
    registrar('geocodificacao.nominatim_indisponivel', { motivo: erro.name === 'TimeoutError' ? 'tempo esgotado' : erro.message })
    return null
  }
}

// ---------------------------------------------------------------- reverso

/**
 * Endereço aproximado de um ponto da Zona da Mata.
 * precisao: 'rua' (achou a rua a até 150 m), 'bairro' ou 'cidade'.
 */
export async function enderecoDoPonto(lat, lng) {
  let codigoIbge = municipioDoPonto(lat, lng)
  let cidade = codigoIbge ? await localRepository.buscarCidadePorIbge(codigoIbge) : null

  // perto da divisa (tolerância do GPS): fica com a cidade cuja sede é a mais próxima
  if (!cidade) {
    const cidades = await localRepository.listarCidades()
    cidade = cidades.reduce((perto, c) => {
      const d = distanciaKm(lat, lng, Number(c.latitude), Number(c.longitude))
      return !perto || d < perto.d ? { ...c, d } : perto
    }, null)
    codigoIbge = cidade.codigo_ibge
  }

  const [ruas, osm] = await Promise.all([
    localRepository.ruasProximas(lat, lng, { raioKm: 0.4, limite: 8, cidadeId: cidade.id }),
    consultarNominatim(lat, lng),
  ])

  // 1º: a rua que o OpenStreetMap indicou, no trecho (CEP) mais perto; 2º: o trecho do Censo mais perto
  let rua = null
  if (osm?.rua) {
    const alvo = normalizar(osm.rua)
    rua = ruas.find((r) => normalizar(r.nome) === alvo) ?? null
    if (!rua) {
      const mesmaRua = await localRepository.buscarRuas(cidade.id, { busca: osm.rua, limite: 50 })
      const candidatas = mesmaRua.filter((r) => normalizar(r.nome) === alvo)
      if (candidatas.length) {
        const proximas = await localRepository.ruasProximas(lat, lng, { raioKm: 3, limite: 50, cidadeId: cidade.id })
        rua = proximas.find((p) => candidatas.some((c) => c.id === p.id)) ?? null
      }
    }
  }
  const ruaDoCenso = ruas[0] && ruas[0].distancia_m <= 150 ? ruas[0] : null
  rua ??= ruaDoCenso

  let bairro = null
  if (rua?.bairro_id) bairro = await localRepository.buscarBairro(rua.bairro_id)
  if (!bairro) {
    const proximo = await localRepository.bairroMaisProximo(cidade.id, lat, lng)
    bairro = proximo ? await localRepository.buscarBairro(proximo.id) : null
  }

  const nomeRua = rua?.nome ?? osm?.rua ?? null
  const cep = rua?.cep ?? osm?.cep ?? cidade.cep_geral ?? null
  const fonteRua = rua ? 'ibge' : osm?.rua ? 'openstreetmap' : null

  return {
    dentro_da_area: municipioDoPonto(lat, lng) !== null,
    precisao: nomeRua ? 'rua' : bairro ? 'bairro' : 'cidade',
    cidade: { id: cidade.id, nome: cidade.nome, uf: cidade.uf, codigo_ibge: Number(codigoIbge) },
    bairro: bairro ? { id: bairro.id, nome: bairro.nome, distrito: bairro.distrito, rural: bairro.rural } : null,
    rua: nomeRua,
    cep,
    fonte: { rua: fonteRua, bairro: bairro ? 'ibge' : null },
  }
}

// ---------------------------------------------------------------- CEP

export async function localDoCep(cep) {
  const local = await localRepository.buscarPorCep(cep)
  if (!local) {
    const erro = erroHttp(404, 'Esse CEP não é de uma cidade da Zona da Mata mineira ou não existe.')
    erro.codigo = 'CEP_NAO_ENCONTRADO'
    throw erro
  }
  return {
    cep: local.cep,
    cep_de_rua: local.cep_de_rua,
    rua: local.rua,
    bairro: local.bairro_id ? { id: local.bairro_id, nome: local.bairro } : null,
    cidade: { id: local.cidade_id, nome: local.cidade, uf: local.uf },
    latitude: Number(local.latitude),
    longitude: Number(local.longitude),
  }
}
