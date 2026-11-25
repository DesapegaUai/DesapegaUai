// Mensagens programadas do chat. Só quem programou lê e apaga (toda consulta filtra por remetente_id).
import { db } from '../config/db.js'

const COLUNAS = 'id, conversa_id, texto, enviar_em, criada_em'

export async function listar(conversaId, remetenteId) {
  const [linhas] = await db.query(
    `SELECT ${COLUNAS} FROM mensagem_programada WHERE conversa_id = ? AND remetente_id = ? ORDER BY enviar_em, id`,
    [conversaId, remetenteId],
  )
  return linhas
}

export async function contar(conversaId, remetenteId) {
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM mensagem_programada WHERE conversa_id = ? AND remetente_id = ?',
    [conversaId, remetenteId],
  )
  return Number(total)
}

export async function buscar(id, conversaId, remetenteId) {
  const [linhas] = await db.query(
    `SELECT ${COLUNAS}, remetente_id FROM mensagem_programada WHERE id = ? AND conversa_id = ? AND remetente_id = ?`,
    [id, conversaId, remetenteId],
  )
  return linhas[0] ?? null
}

export async function criar({ conversaId, remetenteId, texto, enviarEm }) {
  const [resultado] = await db.query(
    'INSERT INTO mensagem_programada (conversa_id, remetente_id, texto, enviar_em) VALUES (?, ?, ?, ?)',
    [conversaId, remetenteId, texto, enviarEm],
  )
  const [linhas] = await db.query(`SELECT ${COLUNAS} FROM mensagem_programada WHERE id = ?`, [resultado.insertId])
  return linhas[0]
}

export async function apagar(id, conversaId, remetenteId) {
  const [resultado] = await db.query(
    'DELETE FROM mensagem_programada WHERE id = ? AND conversa_id = ? AND remetente_id = ?',
    [id, conversaId, remetenteId],
  )
  return resultado.affectedRows > 0
}

// as que já passaram da hora (as mais antigas primeiro)
export async function vencidas(limite = 50) {
  const [linhas] = await db.query(
    `SELECT id, conversa_id, remetente_id, texto FROM mensagem_programada
      WHERE enviar_em <= UTC_TIMESTAMP() ORDER BY enviar_em, id LIMIT ?`,
    [limite],
  )
  return linhas
}

// quando a conversa não deixa mais enviar (excluída), a programada sai da fila
export async function descartar(id) {
  await db.query('DELETE FROM mensagem_programada WHERE id = ?', [id])
}
