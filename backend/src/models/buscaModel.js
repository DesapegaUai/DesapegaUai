import { db } from '../config/db.js'
import { sqlDoCard, montarCard } from './anuncioModel.js'
import { erroHttp } from '../utils/erroHttp.js'

export async function listarAnunciosAtivos(usuarioId, filtros) {

  const [cidades] = await db.query(
    'SELECT id, latitude, longitude FROM cidade WHERE id = ?',
    [filtros.cidadeId],
  )

  if (cidades.length === 0) {
    throw erroHttp(404, 'Cidade não encontrada.')
  }

  const cidade = cidades[0]

  let consulta = sqlDoCard(`
    , ST_Distance_Sphere(
        POINT(?, ?),
        POINT(b.longitude, b.latitude)
      ) / 1000 AS distancia_km
    , EXISTS (
        SELECT 1
        FROM favorito
        WHERE favorito.anuncio_id = a.id
          AND favorito.usuario_id = ?
      ) AS favoritado
  `)

  const valores = [
    cidade.longitude,
    cidade.latitude,
    usuarioId,
  ]

  consulta += ' WHERE a.status = ?'
  valores.push('ativo')

  if (filtros.busca) {
    let textoBusca = filtros.busca

    // Escapa o próprio ! antes dos caracteres especiais do LIKE.
    textoBusca = textoBusca.replaceAll('!', '!!')
    textoBusca = textoBusca.replaceAll('%', '!%')
    textoBusca = textoBusca.replaceAll('_', '!_')

    consulta += " AND (a.titulo LIKE ? ESCAPE '!'"
    consulta += " OR a.descricao LIKE ? ESCAPE '!')"

    valores.push('%' + textoBusca + '%')
    valores.push('%' + textoBusca + '%')
  }

  if (filtros.categoriaId !== null) {
    consulta += ' AND a.categoria_id = ?'
    valores.push(filtros.categoriaId)
  }

  if (filtros.subcategorias.length > 0) {
    consulta += ' AND a.subcategoria_id IN (?)'
    valores.push(filtros.subcategorias)
  }

  if (filtros.bairros.length > 0) {
    consulta += ' AND a.bairro_id IN (?)'
    valores.push(filtros.bairros)
  }

  if (filtros.condicoes.length > 0) {
    consulta += ' AND a.condicao IN (?)'
    valores.push(filtros.condicoes)
  }

  if (filtros.precoMin !== null) {
    consulta += ' AND a.preco >= ?'
    valores.push(filtros.precoMin)
  }

  if (filtros.precoMax !== null) {
    consulta += ' AND a.preco <= ?'
    valores.push(filtros.precoMax)
  }

  let consultaFiltrada = 'SELECT * FROM (' + consulta + ') AS anuncios'

  if (filtros.distanciaMax !== null) {
    consultaFiltrada += ' WHERE distancia_km <= ?'
    valores.push(filtros.distanciaMax)
  }

  const consultaTotal =
    'SELECT COUNT(*) AS total FROM (' +
    consultaFiltrada +
    ') AS resultados'

  const [contagem] = await db.query(consultaTotal, valores)
  const total = Number(contagem[0].total)

  let ordem = 'data_publicacao DESC, id DESC'

  if (filtros.ordenar === 'menor_preco') {
    ordem = 'preco ASC, id DESC'
  } else if (filtros.ordenar === 'maior_preco') {
    ordem = 'preco DESC, id DESC'
  } else if (filtros.ordenar === 'proximos') {
    ordem = 'distancia_km ASC, id DESC'
  }

  const consultaPagina =
    consultaFiltrada +
    ' ORDER BY ' + ordem +
    ' LIMIT ? OFFSET ?'

  const deslocamento = (filtros.pagina - 1) * filtros.porPagina

  const valoresPagina = valores.slice()
  valoresPagina.push(filtros.porPagina)
  valoresPagina.push(deslocamento)

  const [resultados] = await db.query(
    consultaPagina,
    valoresPagina,
  )

  const anuncios = []

  for (const resultado of resultados) {
    const favoritado = Number(resultado.favoritado) === 1
    const anuncio = montarCard(resultado, favoritado)

    // Arredonda só para exibir na resposta.
    anuncio.distancia_km = Number(anuncio.distancia_km.toFixed(1))

    anuncios.push(anuncio)
  }

  const totalPaginas = Math.ceil(total / filtros.porPagina)

  return {
    itens: anuncios,
    pagina: filtros.pagina,
    por_pagina: filtros.porPagina,
    total: total,
    total_paginas: totalPaginas,
  }
}