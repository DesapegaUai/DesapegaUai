// Excluir conversa: some só para quem excluiu, volta quando chega mensagem nova e sem o histórico antigo.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const base = `http://127.0.0.1:${servidor.address().port}/api`

const CONVERSA = 1 // do seed: Larissa (2) comprando do Diego (1)
const TEXTO = 'Teste de excluir conversa'
let vendedor
let comprador
let outraPessoa

async function entrarComo(id) {
  const r = await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })
  return r.headers.get('set-cookie').split(';')[0]
}
const chamar = async (metodo, caminho, cookie, json) => {
  const r = await fetch(base + caminho, { method: metodo, headers: { ...(cookie ? { Cookie: cookie } : {}), 'Content-Type': 'application/json' }, body: json ? JSON.stringify(json) : undefined })
  return { status: r.status, dados: r.status === 204 ? null : await r.json() }
}
const naLista = async (cookie) => (await chamar('GET', '/conversas', cookie)).dados.itens.some((c) => c.id === CONVERSA)
// as horas são gravadas com precisão de 1 segundo: espera virar o segundo antes de mandar a próxima
const esperar = () => new Promise((ok) => setTimeout(ok, 1100))

before(async () => {
  vendedor = await entrarComo(1)
  comprador = await entrarComo(2)
  outraPessoa = await entrarComo(3)
})

after(async () => {
  await db.query('DELETE FROM mensagem WHERE conversa_id = ? AND texto LIKE ?', [CONVERSA, `${TEXTO}%`])
  await db.query('UPDATE conversa SET oculta_comprador_em = NULL, oculta_vendedor_em = NULL WHERE id = ?', [CONVERSA])
  await db.query('UPDATE conversa c SET c.atualizada_em = (SELECT MAX(m.enviada_em) FROM mensagem m WHERE m.conversa_id = c.id) WHERE c.id = ?', [CONVERSA])
  servidor.close()
  servidor.closeAllConnections()
  await db.end()
})

test('quem exclui deixa de ver a conversa; a outra pessoa continua vendo tudo', async () => {
  const antes = (await chamar('GET', `/conversas/${CONVERSA}/mensagens`, vendedor)).dados.mensagens.length
  assert.ok(antes > 0)
  assert.equal(await naLista(comprador), true)

  assert.equal((await chamar('DELETE', `/conversas/${CONVERSA}`, comprador)).status, 204)

  assert.equal(await naLista(comprador), false)
  assert.equal((await chamar('GET', '/conversas/nao-lidas', comprador)).dados.total, 0)
  assert.equal((await chamar('GET', `/conversas/${CONVERSA}/mensagens`, comprador)).dados.mensagens.length, 0)

  assert.equal(await naLista(vendedor), true)
  assert.equal((await chamar('GET', `/conversas/${CONVERSA}/mensagens`, vendedor)).dados.mensagens.length, antes)
})

test('chegou mensagem nova: a conversa volta para a lista, só com o que veio depois', async () => {
  await esperar()
  assert.equal((await chamar('POST', `/conversas/${CONVERSA}/mensagens`, vendedor, { texto: `${TEXTO}: ainda tem interesse?` })).status, 201)

  assert.equal(await naLista(comprador), true)
  const conversa = (await chamar('GET', '/conversas', comprador)).dados.itens.find((c) => c.id === CONVERSA)
  assert.equal(conversa.nao_lidas, 1)
  assert.match(conversa.ultima_mensagem.texto, /ainda tem interesse/)

  const { mensagens } = (await chamar('GET', `/conversas/${CONVERSA}/mensagens`, comprador)).dados
  assert.equal(mensagens.length, 1)
  assert.match(mensagens[0].texto, /ainda tem interesse/)
})

test('excluída e sem mensagem nova, abrir de novo pelo anúncio traz a conversa de volta, vazia', async () => {
  await esperar()
  assert.equal((await chamar('DELETE', `/conversas/${CONVERSA}`, comprador)).status, 204)
  assert.equal(await naLista(comprador), false)

  await esperar()
  const [[{ anuncio_id: anuncioId }]] = await db.query('SELECT anuncio_id FROM conversa WHERE id = ?', [CONVERSA])
  const reaberta = await chamar('POST', '/conversas', comprador, { anuncio_id: anuncioId })
  assert.equal(reaberta.status, 200)
  assert.equal(reaberta.dados.conversa.id, CONVERSA)

  assert.equal(await naLista(comprador), true)
  assert.equal((await chamar('GET', `/conversas/${CONVERSA}/mensagens`, comprador)).dados.mensagens.length, 0)
})

test('só quem participa pode excluir', async () => {
  assert.equal((await chamar('DELETE', `/conversas/${CONVERSA}`, null)).status, 401)
  assert.equal((await chamar('DELETE', `/conversas/${CONVERSA}`, outraPessoa)).status, 403)
  assert.equal((await chamar('DELETE', '/conversas/999999', comprador)).status, 404)
})
