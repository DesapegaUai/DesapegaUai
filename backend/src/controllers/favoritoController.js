import * as favoritoModel from '../models/favoritoModel.js'
import * as anuncioModel from '../models/anuncioModel.js'

import { erroHttp } from '../utils/erroHttp.js'
import { lerId } from '../utils/validacao.js'

const POR_PAGINA_PADRAO = 12
const POR_PAGINA_MAXIMO = 50

// parâmetro opcional da URL: vazio usa o padrão
function lerNumeroOpcional(valor, nome, padrao) {
  if (valor === undefined || valor === '') {
    return padrao
  }

  return lerId(valor, nome)
}

// GET /api/favoritos?categoria_id=&pagina=&por_pagina=
export async function listar(req, res) {
  const categoriaId = lerNumeroOpcional(req.query.categoria_id, 'categoria_id', null)
  const pagina = lerNumeroOpcional(req.query.pagina, 'número da página', 1)
  const porPagina = Math.min(
    lerNumeroOpcional(req.query.por_pagina, 'tamanho da página', POR_PAGINA_PADRAO),
    POR_PAGINA_MAXIMO,
  )

  const { itens, total } = await favoritoModel.listarCards(req.usuario.id, {
    categoriaId,
    pagina,
    porPagina,
  })

  res.json({
    itens,
    pagina,
    por_pagina: porPagina,
    total,
    total_paginas: Math.ceil(total / porPagina),
  })
}

// POST /api/favoritos/:anuncioId
export async function favoritar(req, res) {
  const usuarioId = req.usuario.id
  const anuncioId = lerId(req.params.anuncioId, 'id do anúncio')

  const anuncio = await anuncioModel.buscarPorId(anuncioId)

  if (!anuncio) {
    throw erroHttp(404, 'Anúncio não encontrado.')
  }

  if (Number(anuncio.usuario_id) === Number(usuarioId)) {
    throw erroHttp(400, 'Você não pode favoritar o próprio anúncio.')
  }

  const adicionado = await favoritoModel.adicionar(usuarioId, anuncioId)

  res.status(adicionado ? 201 : 200).json({
    mensagem: adicionado
      ? 'Anúncio adicionado aos favoritos.'
      : 'Este anúncio já está nos seus favoritos.',
  })
}

// DELETE /api/favoritos/:anuncioId
export async function desfavoritar(req, res) {
  const anuncioId = lerId(req.params.anuncioId, 'id do anúncio')

  await favoritoModel.excluir(req.usuario.id, anuncioId)

  res.status(204).end()
}
