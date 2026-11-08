import { db } from '../config/db.js'
import { montarCard, sqlDoCard } from './anuncioModel.js'

// true se favoritou agora, false se já era favorito
export async function adicionar(usuarioId, anuncioId) {
  try {
    await db.query('INSERT INTO favorito (usuario_id, anuncio_id) VALUES (?, ?)', [
      usuarioId,
      anuncioId,
    ])
    return true
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') return false
    throw erro
  }
}

export async function existe(usuarioId, anuncioId) {
  const [linhas] = await db.query(
    'SELECT 1 FROM favorito WHERE usuario_id = ? AND anuncio_id = ?',
    [usuarioId, anuncioId],
  )
  return linhas.length > 0
}

// cards, salvos mais recentemente primeiro; categoriaId null traz todas
export async function listarCards(usuarioId, { categoriaId, pagina, porPagina }) {
  const filtro = categoriaId ? 'AND a.categoria_id = ?' : ''
  const valores = categoriaId ? [usuarioId, categoriaId] : [usuarioId]

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
       FROM favorito fav
       JOIN anuncio a ON a.id = fav.anuncio_id
      WHERE fav.usuario_id = ? ${filtro}`,
    valores,
  )

  const [linhas] = await db.query(
    `${sqlDoCard()}
       JOIN favorito fav ON fav.anuncio_id = a.id
      WHERE fav.usuario_id = ? ${filtro}
      ORDER BY fav.criado_em DESC, a.id DESC
      LIMIT ? OFFSET ?`,
    [...valores, porPagina, (pagina - 1) * porPagina],
  )

  return { itens: linhas.map((linha) => montarCard(linha, true)), total }
}

export async function excluir(usuarioId, anuncioId) {
  const [resultado] = await db.query(
    'DELETE FROM favorito WHERE usuario_id = ? AND anuncio_id = ?',
    [usuarioId, anuncioId],
  )

  return resultado.affectedRows > 0
}
