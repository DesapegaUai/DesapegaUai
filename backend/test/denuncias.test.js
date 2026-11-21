// Denúncia de usuário feita de dentro do chat.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const base = `http://127.0.0.1:${servidor.address().port}/api`

const CONVERSA = 1 // do seed: Larissa (2) conversa com o Diego (1) sobre a air fryer
let vendedor // Diego (1)
let comprador // Larissa (2)
let outraPessoa // Usuário Teste (3), que não participa da conversa

async function entrarComo(id) {
  const r = await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })
  return r.headers.get('set-cookie').split(';')[0]
}

const denunciar = (cookie, corpo, conversaId = CONVERSA) => fetch(`${base}/conversas/${conversaId}/denuncia`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(corpo),
})
const verDenuncia = (cookie, conversaId = CONVERSA) => fetch(`${base}/conversas/${conversaId}/denuncia`, { headers: { Cookie: cookie } })
const limpar = () => db.query('DELETE FROM denuncia WHERE conversa_id = ?', [CONVERSA])

before(async () => {
  vendedor = await entrarComo(1)
  comprador = await entrarComo(2)
  outraPessoa = await entrarComo(3)
  await limpar()
})

after(async () => {
  await limpar()
  servidor.close()
  servidor.closeAllConnections()
  await db.end()
})

test('quem participa da conversa denuncia a outra pessoa, e a denúncia fica guardada como aberta', async () => {
  assert.equal((await (await verDenuncia(comprador)).json()).denuncia, null)

  const resposta = await denunciar(comprador, { motivo: 'golpe', descricao: '  Pediu pagamento adiantado por Pix.  ' })
  assert.equal(resposta.status, 201, await resposta.clone().text())
  const { denuncia } = await resposta.json()
  assert.equal(denuncia.conversa_id, CONVERSA)
  assert.equal(denuncia.denunciado_id, 1) // a Larissa denunciou o Diego
  assert.equal(denuncia.motivo, 'golpe')
  assert.equal(denuncia.descricao, 'Pediu pagamento adiantado por Pix.')
  assert.equal(denuncia.situacao, 'aberta')

  const [[linha]] = await db.query('SELECT denunciante_id, denunciado_id FROM denuncia WHERE id = ?', [denuncia.id])
  assert.deepEqual({ ...linha }, { denunciante_id: 2, denunciado_id: 1 })

  // a tela consegue saber que essa pessoa já denunciou; o outro lado não vê a denúncia
  assert.equal((await (await verDenuncia(comprador)).json()).denuncia.id, denuncia.id)
  assert.equal((await (await verDenuncia(vendedor)).json()).denuncia, null)
})

test('não dá para denunciar a mesma conversa duas vezes, mas o outro lado também pode denunciar', async () => {
  const repetida = await denunciar(comprador, { motivo: 'spam' })
  assert.equal(repetida.status, 409)

  const doVendedor = await denunciar(vendedor, { motivo: 'ofensa' })
  assert.equal(doVendedor.status, 201)
  const { denuncia } = await doVendedor.json()
  assert.equal(denuncia.denunciado_id, 2)
  assert.equal(denuncia.descricao, null) // a descrição é opcional (menos no motivo "outro")
})

test('só quem está logado e participa da conversa pode denunciar', async () => {
  assert.equal((await denunciar(null, { motivo: 'golpe' })).status, 401)
  assert.equal((await denunciar(outraPessoa, { motivo: 'golpe' })).status, 403)
  assert.equal((await verDenuncia(outraPessoa)).status, 403)
  assert.equal((await denunciar(comprador, { motivo: 'golpe' }, 999999)).status, 404)
})

test('motivo inválido, "outro" sem descrição e descrição longa demais respondem 400', async () => {
  await limpar()
  assert.equal((await denunciar(comprador, {})).status, 400)
  assert.equal((await denunciar(comprador, { motivo: 'não gostei' })).status, 400)
  assert.equal((await denunciar(comprador, { motivo: 'outro' })).status, 400)
  assert.equal((await denunciar(comprador, { motivo: 'outro', descricao: '   ' })).status, 400)
  assert.equal((await denunciar(comprador, { motivo: 'golpe', descricao: 'a'.repeat(501) })).status, 400)

  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM denuncia WHERE conversa_id = ?', [CONVERSA])
  assert.equal(total, 0)

  assert.equal((await denunciar(comprador, { motivo: 'outro', descricao: 'Mandou link estranho.' })).status, 201)
})
