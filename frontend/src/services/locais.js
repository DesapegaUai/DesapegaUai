import { api, parametros } from './api.js'

// Cidades, bairros, ruas e CEPs da Zona da Mata mineira (vêm da API, base do IBGE).

let cidades = null
const bairros = new Map()

export async function listarCidades() {
  cidades ??= api.get('/cidades').catch((erro) => {
    cidades = null
    throw erro
  })
  return cidades
}

export async function bairrosDaCidade(cidadeId) {
  if (!cidadeId) return []
  if (!bairros.has(cidadeId)) {
    bairros.set(cidadeId, api.get(`/cidades/${cidadeId}/bairros`).catch((erro) => {
      bairros.delete(cidadeId)
      throw erro
    }))
  }
  return bairros.get(cidadeId)
}

export const buscarRuas = (cidadeId, busca, bairroId) =>
  api.get(`/cidades/${cidadeId}/ruas${parametros({ busca, bairro_id: bairroId, limite: 15 })}`)

export const localDoCep = (cep) => api.get(`/localizacao/cep/${String(cep).replace(/\D/g, '')}`)

export const enderecoDoPonto = (latitude, longitude) => api.get(`/localizacao/endereco${parametros({ latitude, longitude })}`)

export const sugerirRegioes = (busca) => api.get(`/localizacao/sugestoes${parametros({ busca })}`)

// "Silvestre (distrito)" ou "Córrego do Paiol (zona rural)"
export function nomeDoBairro(bairro) {
  if (!bairro) return ''
  if (bairro.rural) return `${bairro.nome} (zona rural)`
  if (bairro.distrito && bairro.distrito !== bairro.nome) return `${bairro.nome} (distrito de ${bairro.distrito})`
  return bairro.nome
}

// compara sem acento e sem maiúscula
export const simplificar = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
