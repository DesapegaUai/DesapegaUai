import { db } from '../config/db.js'

export async function criar(dados) {
  const [resultado] = await db.execute(
    `INSERT INTO foto_anuncio (anuncio_id, arquivo, ordem)
     VALUES (?, ?, ?)`,
    [dados.anuncio_id, dados.arquivo, dados.ordem]
  )

  return resultado.insertId
}

export async function listarPorAnuncio(anuncioId) {
  const [linhas] = await db.execute(
    `SELECT id, anuncio_id, arquivo, ordem
     FROM foto_anuncio
     WHERE anuncio_id = ?
     ORDER BY ordem ASC, id ASC`,
    [anuncioId]
  )

  return linhas
}

export async function buscarPorId(id, anuncioId) {
  const [linhas] = await db.execute(
    `SELECT id, anuncio_id, arquivo, ordem
     FROM foto_anuncio
     WHERE id = ? AND anuncio_id = ?`,
    [id, anuncioId]
  )

  return linhas[0] ?? null
}

export async function proximaOrdem(anuncioId) {
  const [linhas] = await db.execute(
    `SELECT COALESCE(MAX(ordem), -1) + 1 AS proxima
     FROM foto_anuncio
     WHERE anuncio_id = ?`,
    [anuncioId]
  )

  return linhas[0].proxima
}

export async function excluir(id, anuncioId) {
  const [resultado] = await db.execute(
    `DELETE FROM foto_anuncio
     WHERE id = ? AND anuncio_id = ?`,
    [id, anuncioId]
  )

  return resultado.affectedRows > 0
}