import { db } from '../config/db.js'

// GET /api/saude
export async function verificar(req, res) {
  try {
    await db.query('SELECT 1')
    res.json({ api: 'ok', banco: 'ok' })
  } catch (erro) {
    res.status(503).json({ api: 'ok', banco: 'sem conexão', motivo: erro.code ?? erro.message })
  }
}
