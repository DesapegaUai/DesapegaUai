import * as favoritoModel from '../models/favoritoModel.js'
import * as anuncioModel from '../models/anuncioModel.js'
import * as fotoModel from '../models/fotoModel.js'

import { erroHttp } from '../utils/erroHttp.js'
import { lerId } from '../utils/validacao.js'
import { formatarFoto } from '../utils/fotos.js'

// GET /api/favoritos
export async function listar(req, res) {
  const usuarioId = req.usuario.id

  const anuncios = await favoritoModel.listarPorUsuario(usuarioId)

  const resultado = await Promise.all(
    anuncios.map(async (anuncio) => {
      const fotos = await fotoModel.listarPorAnuncio(anuncio.id)

      return {
        ...anuncio,
        fotos: fotos.map((foto) => formatarFoto(anuncio.id, foto)),
      }
    })
  )

  res.json(resultado)
}

// POST /api/favoritos/:anuncioId
export async function favoritar(req, res) {
  const usuarioId = req.usuario.id
  const anuncioId = lerId(req.params.anuncioId, 'id do anúncio')

  const anuncio = await anuncioModel.buscarPorId(anuncioId)

  if (!anuncio) {
    throw erroHttp(404, 'Anúncio não encontrado.')
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
  const usuarioId = req.usuario.id
  const anuncioId = lerId(req.params.anuncioId, 'id do anúncio')

  await favoritoModel.excluir(usuarioId, anuncioId)

  res.json({
    mensagem: 'Anúncio removido dos favoritos.',
  })
}