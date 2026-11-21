import { db } from '../config/db.js'
import { listarAnunciosPorDistancia } from '../repositories/localizacaoRepository.js'
import { erroHttp } from '../utils/erroHttp.js'

// distância calculada no MySQL a partir do ponto público de cada anúncio (localizacao_anuncio),
// a mesma consulta de GET /api/localizacao/proximos
export async function listarAnunciosAtivos(usuarioId, filtros) {
  let origem = filtros.origem

  if (!origem) {
    const [cidades] = await db.query(
      'SELECT id, latitude, longitude FROM cidade WHERE id = ?',
      [filtros.cidadeId],
    )

    if (cidades.length === 0) {
      throw erroHttp(404, 'Cidade não encontrada.')
    }

    origem = { latitude: Number(cidades[0].latitude), longitude: Number(cidades[0].longitude) }
  }

  const { total, itens } = await listarAnunciosPorDistancia({
    origem,
    raioKm: filtros.distanciaMax === null ? null : Math.max(filtros.distanciaMax, 0.001),
    filtros: {
      busca: filtros.busca,
      categoriaId: filtros.categoriaId,
      subcategorias: filtros.subcategorias,
      bairros: filtros.bairros,
      condicoes: filtros.condicoes,
      precoMin: filtros.precoMin,
      precoMax: filtros.precoMax,
    },
    ordenar: filtros.ordenar,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    usuarioId,
  })

  return {
    itens: itens.map(({ distancia_m, ...anuncio }) => ({
      ...anuncio,
      // Arredonda só para exibir na resposta.
      distancia_km: Number((distancia_m / 1000).toFixed(1)),
    })),
    pagina: filtros.pagina,
    por_pagina: filtros.porPagina,
    total,
    total_paginas: Math.ceil(total / filtros.porPagina),
  }
}
