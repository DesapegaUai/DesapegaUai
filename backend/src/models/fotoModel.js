import { db } from '../config/db.js'

// o último parâmetro (conexao) é para usar dentro de uma transação (anuncioModel.emTransacao)

export async function criar(dados, conexao = db) {
  const [resultado] = await conexao.query(
    'INSERT INTO foto_anuncio (anuncio_id, arquivo, ordem) VALUES (?, ?, ?)',
    [dados.anuncio_id, dados.arquivo, dados.ordem],
  )

  return resultado.insertId
}

// ordem 0 é a capa
export async function listarPorAnuncio(anuncioId, conexao = db) {
  const [linhas] = await conexao.query(
    `SELECT id, arquivo, ordem
       FROM foto_anuncio
      WHERE anuncio_id = ?
      ORDER BY ordem, id`,
    [anuncioId],
  )

  return linhas
}

export async function mudarOrdem(id, ordem, conexao = db) {
  await conexao.query('UPDATE foto_anuncio SET ordem = ? WHERE id = ?', [ordem, id])
}

export async function excluir(id, anuncioId, conexao = db) {
  const [resultado] = await conexao.query(
    'DELETE FROM foto_anuncio WHERE id = ? AND anuncio_id = ?',
    [id, anuncioId],
  )

  return resultado.affectedRows > 0
}
