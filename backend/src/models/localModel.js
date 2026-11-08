import { db } from '../config/db.js'

export async function listarCidades() {
  const [linhas] = await db.query('SELECT id, nome, uf FROM cidade ORDER BY nome')
  return linhas
}

export async function cidadeExiste(id) {
  const [linhas] = await db.query('SELECT 1 FROM cidade WHERE id = ?', [id])
  return linhas.length > 0
}

export async function listarBairros(cidadeId) {
  const [linhas] = await db.query(
    'SELECT id, nome FROM bairro WHERE cidade_id = ? ORDER BY nome',
    [cidadeId],
  )
  return linhas
}
