// Validação das entradas do módulo de localização. Dado inválido vira erro HTTP com código.
import { erroHttp } from '../utils/erroHttp.js'
import { municipioDoPonto, pontoNaArea, RAIO_MAXIMO_KM, RAIO_MINIMO_KM } from '../utils/geo.js'
import { lerId } from '../utils/validacao.js'

function erroCampo(mensagem, campo, codigo = 'DADOS_INVALIDOS', status = 400) {
  const erro = erroHttp(status, mensagem)
  erro.codigo = codigo
  erro.campos = [campo]
  return erro
}

const vazio = (valor) => valor === undefined || valor === null || valor === ''

function lerNumeroDecimal(valor, campo) {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) throw erroCampo(`O campo ${campo} precisa ser um número.`, campo)
    return valor
  }
  if (typeof valor !== 'string' || !/^-?\d{1,3}(\.\d{1,12})?$/.test(valor.trim())) {
    throw erroCampo(`O campo ${campo} precisa ser um número com ponto decimal.`, campo)
  }
  return Number(valor.trim())
}

/**
 * Lê latitude e longitude (as duas ou nenhuma).
 * Latitude de -90 a 90, longitude de -180 a 180, nada de (0, 0) e, por padrão, só pontos da
 * Zona da Mata mineira (com 5 km de tolerância na divisa, pelo erro do GPS).
 * Devolve { latitude, longitude, codigoIbge } ou null quando nenhuma das duas veio.
 */
export function lerCoordenadas(lat, lng, { obrigatorio = false, dentroDaArea = true, campos = ['latitude', 'longitude'] } = {}) {
  if (vazio(lat) && vazio(lng)) {
    if (obrigatorio) throw erroCampo(`Envie ${campos[0]} e ${campos[1]}.`, campos[0])
    return null
  }
  if (vazio(lat) || vazio(lng)) throw erroCampo(`Envie ${campos[0]} e ${campos[1]} juntas.`, vazio(lat) ? campos[0] : campos[1])

  const latitude = lerNumeroDecimal(lat, campos[0])
  const longitude = lerNumeroDecimal(lng, campos[1])
  if (latitude < -90 || latitude > 90) throw erroCampo(`A ${campos[0]} precisa estar entre -90 e 90.`, campos[0])
  if (longitude < -180 || longitude > 180) throw erroCampo(`A ${campos[1]} precisa estar entre -180 e 180.`, campos[1])
  if (latitude === 0 && longitude === 0) throw erroCampo('Coordenadas inválidas (0, 0).', campos[0])

  if (dentroDaArea && !pontoNaArea(latitude, longitude)) {
    throw erroCampo(
      'Essa localização fica fora da Zona da Mata mineira. O DesapegaUai atende só os municípios da região.',
      campos[0], 'FORA_DA_AREA', 422,
    )
  }
  return { latitude, longitude, codigoIbge: municipioDoPonto(latitude, longitude) }
}

// precisão do GPS em metros: opcional, de 0 a 100 km
export function lerPrecisao(valor, campo = 'precisao_m') {
  if (vazio(valor)) return null
  const numero = typeof valor === 'number' || typeof valor === 'string' ? Number(valor) : NaN
  if (!Number.isFinite(numero) || numero < 0 || numero > 100_000) {
    throw erroCampo('A precisão precisa ser um número de metros entre 0 e 100000.', campo)
  }
  return Math.round(numero * 100) / 100
}

// quando o aparelho mediu: ISO 8601 ou milissegundos (o timestamp do GPS); sem ele, agora
export function lerMomento(valor, campo = 'capturada_em') {
  if (vazio(valor)) return new Date()
  if (typeof valor !== 'number' && typeof valor !== 'string') throw erroCampo('A data da localização é inválida.', campo)
  const ehNumero = typeof valor === 'number' || /^\d{10,13}$/.test(String(valor))
  const data = ehNumero ? new Date(Number(valor)) : new Date(String(valor))
  if (Number.isNaN(data.getTime())) throw erroCampo('A data da localização é inválida.', campo)
  if (data.getTime() > Date.now() + 5 * 60 * 1000) throw erroCampo('A data da localização está no futuro.', campo)
  if (data.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    throw erroCampo('A localização foi medida há mais de 24 horas. Atualize a localização.', campo)
  }
  return data
}

// raio em km: um dos sugeridos ou outro número inteiro de 1 a 300
export function lerRaio(valor, { padrao = null, campo = 'raio_km' } = {}) {
  if (vazio(valor)) return padrao
  const texto = typeof valor === 'number' || typeof valor === 'string' ? String(valor).trim() : ''
  if (!/^\d{1,3}$/.test(texto)) throw erroCampo(`O raio precisa ser um número inteiro de ${RAIO_MINIMO_KM} a ${RAIO_MAXIMO_KM} km.`, campo)
  const raio = Number(texto)
  if (raio < RAIO_MINIMO_KM || raio > RAIO_MAXIMO_KM) {
    throw erroCampo(`O raio precisa ser de ${RAIO_MINIMO_KM} a ${RAIO_MAXIMO_KM} km.`, campo)
  }
  return raio
}

export function lerOrigem(valor, opcoes, campo = 'origem') {
  if (vazio(valor)) return null
  if (!opcoes.includes(valor)) throw erroCampo(`O campo ${campo} precisa ser: ${opcoes.join(', ')}.`, campo)
  return valor
}

export function lerCep(valor, campo = 'cep') {
  if (vazio(valor)) return null
  if (typeof valor !== 'string' && typeof valor !== 'number') throw erroCampo('O CEP precisa ter 8 números.', campo)
  const digitos = String(valor).replace(/\D/g, '')
  if (!/^\d{8}$/.test(digitos)) throw erroCampo('O CEP precisa ter 8 números.', campo)
  return digitos
}

export function lerIdOpcional(valor, campo) {
  if (vazio(valor)) return null
  try {
    return lerId(valor, campo)
  } catch (erro) {
    erro.campos = [campo]
    throw erro
  }
}

// página e quantidade por página (máximo de 50 por requisição)
export const POR_PAGINA_MAXIMO = 50
export function lerPaginacao(query, { padrao = 12 } = {}) {
  const pagina = lerIdOpcional(query.pagina, 'pagina') ?? 1
  const porPagina = Math.min(lerIdOpcional(query.por_pagina, 'por_pagina') ?? padrao, POR_PAGINA_MAXIMO)
  if (pagina > 10_000) throw erroCampo('A página pedida é grande demais.', 'pagina')
  return { pagina, porPagina }
}

// área visível do mapa: bbox=lng_min,lat_min,lng_max,lat_max (como no GeoJSON)
export function lerCaixa(valor, campo = 'bbox') {
  if (vazio(valor)) return null
  if (typeof valor !== 'string') throw erroCampo('Envie bbox=lng_min,lat_min,lng_max,lat_max.', campo)
  const partes = valor.split(',').map((parte) => parte.trim())
  if (partes.length !== 4) throw erroCampo('Envie bbox=lng_min,lat_min,lng_max,lat_max.', campo)
  const [minLng, minLat, maxLng, maxLat] = partes.map((parte) => lerNumeroDecimal(parte, campo))
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180 || minLat >= maxLat || minLng >= maxLng) {
    throw erroCampo('A bbox precisa ter lng_min < lng_max e lat_min < lat_max, dentro do planeta.', campo)
  }
  if (maxLat - minLat > 5 || maxLng - minLng > 5) throw erroCampo('A área do mapa é grande demais (máximo de 5 graus).', campo)
  return { minLat, maxLat, minLng, maxLng }
}

// texto curto de busca (nomes de cidade, bairro ou rua)
export function lerTextoBusca(valor, campo = 'busca', { min = 2, max = 60 } = {}) {
  if (vazio(valor)) return null
  if (typeof valor !== 'string') throw erroCampo(`O campo ${campo} precisa ser um texto.`, campo)
  const texto = valor.trim().replace(/\s+/g, ' ')
  if ([...texto].length < min) throw erroCampo(`Digite pelo menos ${min} letras em ${campo}.`, campo)
  if ([...texto].length > max) throw erroCampo(`O campo ${campo} pode ter no máximo ${max} caracteres.`, campo)
  return texto
}
