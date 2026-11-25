// Comparação de anúncios parecidos (busca e página "Comparar"), com a IA do DesapegaUai.
// Cada pedido calcula tudo de novo com os anúncios como estão agora: preço novo, vendido ou excluído
// já entram (ou saem) na hora. A IA recebe só dados públicos do anúncio (veja paraAIA).
// A referência de local e o raio são os mesmos da busca por proximidade (GPS, bairro, cidade ou o guardado).
import * as comparacaoModel from '../models/comparacaoModel.js'
import { listarAnunciosPorDistancia, listarAnunciosPorIds } from '../repositories/localizacaoRepository.js'
import { erroHttp } from '../utils/erroHttp.js'
import { metrosParaKm } from '../utils/regrasLocalizacao.js'
import { avaliarGrupo, descobrirTipo, separarParecidos } from './assistenteDeCompras.js'
import { lerFiltros, raioDaBusca, resolverOrigem } from './localizacaoService.js'

const MAXIMO_NA_BUSCA = 40 // anúncios mais perto que a IA olha para achar os parecidos
export const MAXIMO_PARA_COMPARAR = 4

/**
 * O que a IA recebe de cada anúncio: só o que qualquer pessoa vê no anúncio. Nada do vendedor
 * (nome, e-mail, telefone) e nada de quem está buscando (a distância já vem calculada).
 */
export function paraAIA(card, detalhe) {
  return {
    id: card.id,
    titulo: card.titulo,
    descricao: detalhe?.descricao ?? '',
    preco: Number(card.preco),
    condicao: card.condicao,
    categoria_id: card.categoria_id,
    total_fotos: detalhe?.total_fotos ?? 0,
    distancia_km: card.distancia_km ?? null,
  }
}

// o que sai para a tela: o card, os dados públicos e o que a IA concluiu
function montar(avaliado, card, detalhe) {
  return {
    id: card.id,
    titulo: card.titulo,
    preco: Number(card.preco),
    condicao: card.condicao,
    status: card.status,
    categoria_slug: card.categoria_slug,
    bairro: card.bairro,
    cidade: card.cidade,
    uf: card.uf,
    foto_capa: card.foto_capa,
    favoritado: card.favoritado,
    distancia_km: card.distancia_km ?? null,
    total_fotos: detalhe?.total_fotos ?? 0,
    descricao_completa: (detalhe?.descricao ?? '').trim().length >= 120,
    localizacao: detalhe?.localizacao ?? null,
    forma_entrega: detalhe?.forma_entrega ?? null,
    transporte: detalhe?.transporte ?? null,
    vendedor: detalhe?.vendedor ?? null,
    caracteristicas: avaliado.caracteristicas,
    atencao: avaliado.atencao,
    faixa: avaliado.faixa,
    partes: avaliado.partes,
    nota: avaliado.nota,
    motivo: avaliado.motivo,
    melhor: avaliado.melhor,
  }
}

export const ordenarPorNota = (anuncios) =>
  [...anuncios].sort((a, b) => b.nota - a.nota || a.preco - b.preco || (a.distancia_km ?? 99) - (b.distancia_km ?? 99))

const vazio = (tipo = null, total = 0, fora = []) => ({ tipo, precos: null, total, anuncios: [], fora })

// de onde medir e até onde buscar, como na busca por proximidade (resolvido uma vez por pedido)
export async function referenciaDaBusca(query, usuarioId) {
  return { origem: await resolverOrigem(query, usuarioId), raioKm: await raioDaBusca(query, usuarioId) }
}

// anúncios perto da referência, com a distância em km
export async function anunciosPerto({ origem, raioKm }, usuarioId, filtros, porPagina) {
  const { itens } = await listarAnunciosPorDistancia({ origem, raioKm, filtros, ordenar: 'proximos', pagina: 1, porPagina, usuarioId })
  return itens.map(({ distancia_m, ...item }) => ({ ...item, distancia_km: metrosParaKm(distancia_m) }))
}

/** Os parecidos da busca, comparados (só quando há pelo menos 2). Mesmos filtros e mesmo raio da busca. */
export async function compararBusca(query, usuarioId) {
  const filtros = lerFiltros(query)
  if (!filtros.busca) return vazio()
  const itens = await anunciosPerto(await referenciaDaBusca(query, usuarioId), usuarioId, filtros, MAXIMO_NA_BUSCA)
  if (itens.length < 2) return vazio()

  const detalhes = await comparacaoModel.detalhesPublicos(itens.map((card) => card.id))
  const cards = new Map(itens.map((card) => [card.id, card]))
  const { tipo, parecidos, fora } = separarParecidos(filtros.busca, itens.map((card) => paraAIA(card, detalhes.get(card.id))))
  if (parecidos.length < 2) return vazio(tipo, parecidos.length, fora)

  const { precos, anuncios } = avaliarGrupo(parecidos)
  return {
    tipo,
    precos,
    total: anuncios.length,
    anuncios: ordenarPorNota(anuncios).map((a) => montar(a, cards.get(a.id), detalhes.get(a.id))),
    fora,
  }
}

/**
 * Os anúncios escolhidos (de 2 a 4), na ordem pedida. Vendido ou excluído não entra.
 * A distância sai da mesma referência da busca; sem referência nenhuma, a comparação vem sem distância.
 */
export async function compararIds(ids, query, usuarioId) {
  let origem = null
  try {
    origem = await resolverOrigem(query, usuarioId)
  } catch (erro) {
    if (erro.codigo !== 'LOCALIZACAO_OBRIGATORIA') throw erro
  }
  const itens = await listarAnunciosPorIds({ ids, origem, usuarioId })
  if (itens.length < 2) throw erroHttp(404, 'Para comparar, escolha pelo menos 2 anúncios que ainda estejam à venda.')

  const detalhes = await comparacaoModel.detalhesPublicos(itens.map((card) => card.id))
  const cards = new Map(itens.map((card) => [card.id, card]))
  const paraIA = itens.map((card) => paraAIA(card, detalhes.get(card.id)))
  const { precos, anuncios } = avaliarGrupo(paraIA)

  // o nome no título ("Comparar bicicletas") quando todos são do mesmo tipo
  const tipos = paraIA.map((a) => descobrirTipo(a.titulo).tipo)
  const tipo = tipos[0] && tipos.every((t) => t === tipos[0]) ? { nome: tipos[0].nome, plural: tipos[0].plural, genero: tipos[0].genero, variante: null } : null

  const ordem = new Map(ids.map((id, i) => [id, i]))
  return {
    tipo,
    precos,
    total: anuncios.length,
    anuncios: [...anuncios].sort((a, b) => ordem.get(a.id) - ordem.get(b.id)).map((a) => montar(a, cards.get(a.id), detalhes.get(a.id))),
    fora: ids.filter((id) => !cards.has(id)).map((id) => ({ id, titulo: null, motivo: 'não está mais à venda' })),
  }
}
