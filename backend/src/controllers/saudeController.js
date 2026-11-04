import { db } from '../config/db.js'

// GET /api/saude: mostra se a API está no ar e se ela conseguiu falar com o banco.
export async function verificar(req, res) {
  try {
    await db.query('SELECT 1')
    res.json({ api: 'ok', banco: 'ok' })
  } catch (erro) {
    res.status(503).json({ api: 'ok', banco: 'sem conexão', motivo: erro.code ?? erro.message })
  }
}
