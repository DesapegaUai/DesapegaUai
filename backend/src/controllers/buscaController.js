// Anthony. Já pronto para usar: req.usuario (null sem login), lerId/lerTexto/lerOpcao
// (utils/validacao) e formatarFoto (utils/fotos) para a foto_capa do card.
import { listarAnunciosAtivos } from '../models/buscaModel.js'
import { lerTexto, lerId, lerOpcao } from '../utils/validacao.js'
import { erroHttp } from '../utils/erroHttp.js'

// Lê números como preço e distância.
function lerNumero(valor, nome) {
  if (valor === undefined) {
    return null
  }

  if (typeof valor !== 'string') {
    throw erroHttp(400, 'O campo ' + nome + ' precisa ser um número.')
  }

  const texto = valor.trim()

  // Aceita números positivos ou zero, com ponto nos decimais.
  if (!/^\d+(\.\d+)?$/.test(texto)) {
    throw erroHttp(
      400,
      'O campo ' + nome + ' precisa ser um número maior ou igual a zero.',
    )
  }

  const numero = Number(texto)

  if (!Number.isFinite(numero)) {
    throw erroHttp(400, 'O campo ' + nome + ' possui um valor inválido.')
  }

  return numero
}

// Lê listas como bairro_id=1,2.
function lerListaDeIds(valor, nome) {
  const ids = []

  if (valor === undefined) {
    return ids
  }

  const texto = lerTexto(valor, nome, {
    obrigatorio: true,
  })

  const partes = texto.split(',')

  for (const parte of partes) {
    const id = lerId(parte.trim(), nome)

    if (!ids.includes(id)) {
      ids.push(id)
    }
  }

  return ids
}

function lerCondicoes(valor) {
  const condicoes = []

  if (valor === undefined) {
    return condicoes
  }

  const texto = lerTexto(valor, 'condicao', {
    obrigatorio: true,
  })

  const partes = texto.split(',')

  for (const parte of partes) {
    const condicao = lerOpcao(
      parte.trim(),
      'condicao',
      ['novo', 'seminovo', 'usado'],
    )

    if (!condicoes.includes(condicao)) {
      condicoes.push(condicao)
    }
  }

  return condicoes
}

export async function pesquisar(req, res) {
  let usuarioId = null

  if (req.usuario) {
    usuarioId = req.usuario.id
  }

  const busca = lerTexto(req.query.busca, 'busca')

  let categoriaId = null

  if (req.query.categoria_id !== undefined) {
    categoriaId = lerId(req.query.categoria_id, 'id da categoria')
  }

  const subcategorias = lerListaDeIds(
    req.query.subcategoria_id,
    'id da subcategoria',
  )

  const bairros = lerListaDeIds(
    req.query.bairro_id,
    'id do bairro',
  )

  const condicoes = lerCondicoes(req.query.condicao)

  const precoMin = lerNumero(req.query.preco_min, 'preco_min')
  const precoMax = lerNumero(req.query.preco_max, 'preco_max')

  if (precoMin !== null && precoMax !== null) {
    if (precoMin > precoMax) {
      throw erroHttp(
        400,
        'O preço mínimo não pode ser maior que o preço máximo.',
      )
    }
  }

  let cidadeId = 1

  if (req.query.cidade_id !== undefined) {
    cidadeId = lerId(req.query.cidade_id, 'id da cidade')
  }

  const distanciaMax = lerNumero(
    req.query.distancia_max,
    'distancia_max',
  )

  let ordenar = 'recentes'

  if (req.query.ordenar !== undefined) {
    ordenar = lerOpcao(
      req.query.ordenar,
      'ordenar',
      ['recentes', 'menor_preco', 'maior_preco', 'proximos'],
    )
  }

  let pagina = 1

  if (req.query.pagina !== undefined) {
    pagina = lerId(req.query.pagina, 'número da página')
  }

  let porPagina = 12

  if (req.query.por_pagina !== undefined) {
    porPagina = lerId(req.query.por_pagina, 'quantidade por página')
  }

  if (porPagina > 50) {
    porPagina = 50
  }

  const filtros = {
    busca: busca,
    categoriaId: categoriaId,
    subcategorias: subcategorias,
    bairros: bairros,
    condicoes: condicoes,
    precoMin: precoMin,
    precoMax: precoMax,
    cidadeId: cidadeId,
    distanciaMax: distanciaMax,
    ordenar: ordenar,
    pagina: pagina,
    porPagina: porPagina,
  }

  const resultado = await listarAnunciosAtivos(usuarioId, filtros)

  res.json(resultado)
}