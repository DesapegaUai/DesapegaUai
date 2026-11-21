// Sempre passe os valores pelo ?, nunca juntando texto na SQL (evita SQL injection):
//   const [linhas] = await db.query('SELECT * FROM anuncio WHERE id = ?', [id])
import mysql from 'mysql2/promise'
import { env } from './env.js'

export const db = mysql.createPool({
  host: env.db.host,
  port: env.db.porta,
  user: env.db.usuario,
  password: env.db.senha,
  database: env.db.nome,
  decimalNumbers: true, // preço volta como número (780, e não "780.00")
  timezone: 'Z', // datas sempre em UTC, em qualquer servidor
  waitForConnections: true,
  connectionLimit: 10,
})

// o NOW() do banco também em UTC, para bater com o timezone acima
db.pool.on('connection', (conexao) => conexao.query("SET time_zone = '+00:00'"))
