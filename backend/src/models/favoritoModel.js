import { db } from '../config/db.js'

export async function adicionar(usuarioId, anuncioId) {
  const [resultado] = await db.execute(
    `INSERT IGNORE INTO favorito (usuario_id, anuncio_id)
     VALUES (?, ?)`,
    [usuarioId, anuncioId]
  )

  return resultado.affectedRows > 0
}

export async function listarPorUsuario(usuarioId) {
  const [linhas] = await db.execute(
    `SELECT
       a.*,
       f.criado_em AS favoritado_em
     FROM favorito f
     INNER JOIN anuncio a ON a.id = f.anuncio_id
     WHERE f.usuario_id = ?
     ORDER BY f.criado_em DESC`,
    [usuarioId]
  )

  return linhas
}

export async function excluir(usuarioId, anuncioId) {
  const [resultado] = await db.execute(
    `DELETE FROM favorito
     WHERE usuario_id = ? AND anuncio_id = ?`,
    [usuarioId, anuncioId]
  )

  return resultado.affectedRows > 0
}