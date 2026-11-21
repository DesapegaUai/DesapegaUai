// O que acontece quando o MySQL cai: a API não derruba o processo e responde no formato padrão.
import assert from 'node:assert/strict'
import { after, test } from 'node:test'

process.env.DB_HOST = '127.0.0.1'
process.env.DB_PORT = '1' // porta sem MySQL: toda conexão é recusada
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const base = `http://127.0.0.1:${servidor.address().port}/api`

after(async () => {
  servidor.closeAllConnections()
  servidor.close()
  await db.end().catch(() => {})
})

test('a rota de saúde avisa que o banco está fora (503)', async () => {
  const r = await fetch(`${base}/saude`)
  assert.equal(r.status, 503)
  const dados = await r.json()
  assert.equal(dados.api, 'ok')
  assert.equal(dados.banco, 'sem conexão')
})

test('as rotas respondem 500 no formato padrão, sem pilha nem SQL, e a API continua no ar', async () => {
  const erroOriginal = console.error
  console.error = () => {}
  try {
    for (const caminho of ['/localizacao/proximos?cidade_id=1&raio_km=5', '/cidades', '/anuncios/1']) {
      const r = await fetch(base + caminho)
      assert.equal(r.status, 500, caminho)
      const dados = await r.json()
      assert.equal(dados.erro, 'Erro interno no servidor.')
      assert.equal(dados.codigo, 'ERRO_INTERNO')
      assert.ok(!JSON.stringify(dados).includes('SELECT'))
      assert.ok(!('stack' in dados))
    }
  } finally {
    console.error = erroOriginal
  }
  const deNovo = await fetch(`${base}/localizacao/raios`)
  assert.equal(deNovo.status, 200, 'o que não usa o banco continua funcionando')
})
