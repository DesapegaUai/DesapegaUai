// npm run banco: recria as tabelas e os dados de teste no banco do .env.
// Apaga tudo o que estiver no banco, então é só para desenvolvimento.
import fs from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { env } from '../src/config/env.js'

if (env.producao) {
  console.error('O npm run banco apaga todos os dados: ele não roda com NODE_ENV=production.')
  process.exit(1)
}

// o nome do banco vai direto na SQL, então só letras, números e _
if (!/^\w+$/.test(env.db.nome)) {
  console.error(`Nome de banco inválido no .env (DB_NAME): "${env.db.nome}"`)
  process.exit(1)
}

const arquivos = ['schema.sql', 'seed.sql']

let conexao
let etapa = 'conectar no MySQL'
try {
  conexao = await mysql.createConnection({
    host: env.db.host,
    port: env.db.porta,
    user: env.db.usuario,
    password: env.db.senha,
    charset: 'utf8mb4',
    multipleStatements: true, // só neste script
  })

  etapa = `criar o banco "${env.db.nome}"`
  await conexao.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.db.nome}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  await conexao.query(`USE \`${env.db.nome}\``)

  for (const arquivo of arquivos) {
    etapa = `rodar o ${arquivo}`
    const sql = await fs.readFile(path.join(import.meta.dirname, arquivo), 'utf8')
    // tira o USE dos arquivos: aqui vale o banco do .env
    await conexao.query(sql.replace(/^\s*USE\s+\S+\s*;\s*$/gim, ''))
    console.log(`OK: ${arquivo}`)
  }

  console.log(`Banco "${env.db.nome}" pronto.`)
} catch (erro) {
  console.error(`Não foi possível ${etapa}:`, erro.message || erro.code)
  if (etapa === 'conectar no MySQL') {
    console.error('Confira se o MySQL está ligado e o DB_HOST, DB_PORT, DB_USER e DB_PASSWORD do backend/.env.')
  }
  process.exitCode = 1
} finally {
  await conexao?.end()
}
