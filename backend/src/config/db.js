// Conexão com o MySQL, usada pelos models:
//   const [linhas] = await db.query('SELECT * FROM categoria WHERE id = ?', [id])
// Passe sempre os valores pelo ? (placeholder). Nunca monte a SQL juntando texto
// que veio do usuário, porque isso abre brecha para SQL Injection.
import mysql from 'mysql2/promise'
import { env } from './env.js'

export const db = mysql.createPool({
  host: env.db.host,
  port: env.db.porta,
  user: env.db.usuario,
  password: env.db.senha,
  database: env.db.nome,
  waitForConnections: true,
  connectionLimit: 10,
})
