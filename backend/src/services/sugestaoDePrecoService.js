// Sugestão automática de preço ao anunciar (IA própria do DesapegaUai, sem serviço pago): a IA entende o
// produto pelo título (o mesmo entendimento do comparador e da lista de compras), junta os anúncios
// parecidos perto de onde o produto está e sugere a faixa do meio dos preços (do 1º ao 3º quartil) e o
// preço do meio (mediana). Com o mesmo estado (novo, seminovo, usado), se houver o bastante.
// Só usa o que os anúncios mostram para todo mundo; os anúncios da própria pessoa não entram.
import * as comparacaoModel from '../models/comparacaoModel.js'
import { erroHttp } from '../utils/erroHttp.js'
import { lerId, lerOpcao, lerTexto } from '../utils/validacao.js'
import { combinaComItem, entenderItem, termosDeBusca } from './assistenteDeCompras.js'
import { anunciosPerto, paraAIA, referenciaDaBusca } from './comparacaoService.js'

export const MINIMO_DE_PARECIDOS = 3
const RAIO_MINIMO_KM = 30 // a região toda, para ter base de comparação
const CANDIDATOS = 150
const vazio = (valor) => valor === undefined || valor === null || String(valor).trim() === ''

// percentil com interpolação (os preços já em ordem)
function percentil(ordenados, p) {
  const posicao = (ordenados.length - 1) * p
  const baixo = Math.floor(posicao)
  const alto = Math.ceil(posicao)
  return ordenados[baixo] + (ordenados[alto] - ordenados[baixo]) * (posicao - baixo)
}

// preço "redondo", como as pessoas anunciam: de 10 em 10 acima de R$ 100, de 5 em 5 acima de R$ 20
export function arredondarPreco(valor) {
  const passo = valor >= 100 ? 10 : valor >= 20 ? 5 : 1
  return Math.max(passo, Math.round(valor / passo) * passo)
}

/** A sugestão a partir de uma lista de preços parecidos: { de, ate, preco, media } */
export function calcularSugestao(precos) {
  const ordenados = [...precos].map(Number).sort((a, b) => a - b)
  const preco = arredondarPreco(percentil(ordenados, 0.5))
  const de = Math.min(arredondarPreco(percentil(ordenados, 0.25)), preco)
  const ate = Math.max(arredondarPreco(percentil(ordenados, 0.75)), preco)
  const media = Math.round(ordenados.reduce((soma, v) => soma + v, 0) / ordenados.length)
  return { de, ate, preco, media }
}

/**
 * GET /api/comparacao/sugestao-de-preco?titulo=&condicao=&anuncio_id=&cidade_id|bairro_id|latitude,longitude
 * Devolve { tipo, total, mesmo_estado, sugestao } (sugestao null quando a IA não reconhece o produto
 * ou há menos de 3 parecidos).
 */
export async function sugerirPreco(query, usuarioId) {
  const titulo = lerTexto(query.titulo, 'titulo', { obrigatorio: true, min: 3, max: 80 })
  const condicao = vazio(query.condicao) ? null : lerOpcao(query.condicao, 'condicao', ['novo', 'seminovo', 'usado'])
  const anuncioId = vazio(query.anuncio_id) ? null : lerId(query.anuncio_id, 'anuncio_id') // editando: ele mesmo não entra

  const entendido = entenderItem(titulo)
  if (!entendido.tipo) return { tipo: null, total: 0, mesmo_estado: false, sugestao: null }
  const tipo = { nome: entendido.tipo.nome, plural: entendido.tipo.plural, genero: entendido.tipo.genero }
  // o título diz o produto; o estado e o preço vêm do formulário, não de palavras do título
  const produto = { ...entendido, condicao: null, precoMax: null }

  const referencia = await referenciaDaBusca(query, usuarioId)
  const candidatos = await anunciosPerto(
    { origem: referencia.origem, raioKm: Math.max(referencia.raioKm, RAIO_MINIMO_KM) },
    usuarioId,
    { buscaQualquer: termosDeBusca(entendido), ...(usuarioId ? { excluirUsuarioId: usuarioId } : {}) },
    CANDIDATOS,
  )
  const detalhes = await comparacaoModel.detalhesPublicos(candidatos.map((card) => card.id))
  const parecidos = candidatos
    .filter((card) => card.id !== anuncioId)
    .map((card) => paraAIA(card, detalhes.get(card.id)))
    .filter((anuncio) => combinaComItem(produto, anuncio))

  let grupo = parecidos
  let mesmoEstado = false
  if (condicao) {
    const mesmos = parecidos.filter((anuncio) => anuncio.condicao === condicao)
    if (mesmos.length >= MINIMO_DE_PARECIDOS) {
      grupo = mesmos
      mesmoEstado = true
    }
  }
  if (grupo.length < MINIMO_DE_PARECIDOS) return { tipo, total: grupo.length, mesmo_estado: false, sugestao: null }
  if (grupo.some((anuncio) => !(Number(anuncio.preco) > 0))) throw erroHttp(500, 'Preço inválido entre os anúncios parecidos.')

  return { tipo, total: grupo.length, mesmo_estado: mesmoEstado, sugestao: calcularSugestao(grupo.map((anuncio) => anuncio.preco)) }
}
