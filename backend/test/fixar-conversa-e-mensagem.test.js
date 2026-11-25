// Fixar conversa (até 3, só quem fixou vê, no topo da lista) e fixar mensagem (até 3 por conversa, as duas
// pessoas veem, por 24 horas, 7 dias ou 30 dias; a 4ª só entra substituindo a mais antiga), como no WhatsApp.
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { io as conectarSocket } from 'socket.io-client'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { encerrarSocket, iniciarSocket } = await import('../src/socket.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
iniciarSocket(servidor)
const origem = `http://127.0.0.1:${servidor.address().port}`
const base = `${origem}/api`
const CONVERSA = 1 // do seed: Larissa (2) conversa com o Diego (1) sobre a air fryer
const MARCA = 'Fixar teste'
let diego
let larissa
let outraPessoa
const conversasCriadas = []
const mensagensCriadas = [] // pelo id: a apagada para todos fica sem texto
const sockets = []

async function chamar(metodo, caminho, { cookie, json } = {}) {
  const r = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) },
    body: json ? JSON.stringify(json) : undefined,
  })
  const texto = await r.text()
  return { status: r.status, dados: texto ? JSON.parse(texto) : null }
}
const entrar = async (id) => (await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })).headers.getSetCookie()[0].split(';')[0]
async function enviar(cookie, texto) {
  const id = (await chamar('POST', `/conversas/${CONVERSA}/mensagens`, { cookie, json: { texto } })).dados.mensagem.id
  mensagensCriadas.push(id)
  return id
}
const fixadasDe = async (cookie, conversa = CONVERSA) => (await chamar('GET', `/conversas/${conversa}/mensagens-fixadas`, { cookie })).dados.fixadas
const listaDe = async (cookie) => (await chamar('GET', '/conversas', { cookie })).dados.itens

before(async () => {
  diego = await entrar(1)
  larissa = await entrar(2)
  outraPessoa = await entrar(3)
  await db.query('DELETE FROM conversa_fixada WHERE usuario_id IN (1, 2, 3)')
  await db.query('DELETE FROM mensagem_fixada WHERE conversa_id = ?', [CONVERSA])
  // mais 3 conversas da Larissa com o Diego (anúncios 1, 2 e 3 do seed): ela fica com 4
  for (const anuncioId of [1, 2, 3]) {
    const r = await chamar('POST', '/conversas', { cookie: larissa, json: { anuncio_id: anuncioId } })
    assert.ok([200, 201].includes(r.status), JSON.stringify(r.dados))
    if (r.status === 201) conversasCriadas.push(r.dados.conversa.id)
  }
})

after(async () => {
  for (const s of sockets) s.disconnect()
  await db.query('DELETE FROM conversa_fixada WHERE usuario_id IN (1, 2, 3)')
  await db.query('DELETE FROM mensagem_fixada WHERE conversa_id = ?', [CONVERSA])
  if (mensagensCriadas.length) await db.query('DELETE FROM mensagem WHERE id IN (?)', [mensagensCriadas])
  if (conversasCriadas.length) await db.query('DELETE FROM conversa WHERE id IN (?)', [conversasCriadas])
  await encerrarSocket()
  servidor.closeAllConnections()
  await db.end()
})

describe('Fixar conversa', () => {
  test('até 3, as fixadas vêm primeiro (a última fixada no alto), só para quem fixou; a 4ª é recusada', async () => {
    const [a, b, c] = conversasCriadas
    assert.equal((await chamar('PUT', `/conversas/${CONVERSA}/fixar`, { cookie: larissa })).status, 200)
    assert.equal((await chamar('PUT', `/conversas/${a}/fixar`, { cookie: larissa })).status, 200)
    assert.equal((await chamar('PUT', `/conversas/${b}/fixar`, { cookie: larissa })).status, 200)
    assert.equal((await chamar('PUT', `/conversas/${CONVERSA}/fixar`, { cookie: larissa })).status, 200) // já fixada: continua
    const quarta = await chamar('PUT', `/conversas/${c}/fixar`, { cookie: larissa })
    assert.equal(quarta.status, 409)
    assert.equal(quarta.dados.codigo, 'LIMITE_DE_FIXADAS')
    assert.match(quarta.dados.erro, /até 3 conversas/)

    const lista = await listaDe(larissa)
    assert.deepEqual(lista.slice(0, 3).map((x) => x.id), [b, a, CONVERSA])
    assert.deepEqual(lista.slice(0, 3).map((x) => x.fixada), [true, true, true])
    assert.equal(lista.find((x) => x.id === c).fixada, false)
    // o Diego participa das mesmas conversas, mas para ele nenhuma está fixada
    assert.equal((await listaDe(diego)).some((x) => x.fixada), false)
  })

  test('desafixar libera a vaga; excluir a conversa tira da fixação; quem não participa não fixa', async () => {
    const [a, , c] = conversasCriadas
    assert.equal((await chamar('DELETE', `/conversas/${a}/fixar`, { cookie: larissa })).dados.fixada, false)
    assert.equal((await chamar('PUT', `/conversas/${c}/fixar`, { cookie: larissa })).status, 200)
    assert.equal((await listaDe(larissa)).find((x) => x.id === c).fixada, true)
    assert.equal((await chamar('DELETE', `/conversas/${c}`, { cookie: larissa })).status, 204)
    const [linhas] = await db.query('SELECT 1 FROM conversa_fixada WHERE usuario_id = 2 AND conversa_id = ?', [c])
    assert.equal(linhas.length, 0)
    assert.equal((await chamar('PUT', `/conversas/${CONVERSA}/fixar`, { cookie: outraPessoa })).status, 403)
    assert.equal((await chamar('PUT', '/conversas/999999/fixar', { cookie: larissa })).status, 404)
    assert.equal((await chamar('PUT', `/conversas/${CONVERSA}/fixar`)).status, 401)
  })
})

describe('Fixar mensagem', () => {
  test('as duas pessoas veem, na hora; prazo de 24 h, 7 dias (padrão) ou 30 dias; a 4ª só entra substituindo a mais antiga', async () => {
    const socketDoDiego = conectarSocket(origem, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { Cookie: diego }, reconnection: false })
    sockets.push(socketDoDiego)
    await new Promise((ok, falha) => { socketDoDiego.once('connect', ok); socketDoDiego.once('connect_error', falha) })
    const aviso = new Promise((ok) => socketDoDiego.once('mensagens_fixadas_mudaram', ok))

    const m1 = await enviar(larissa, `${MARCA} 1`)
    const m2 = await enviar(larissa, `${MARCA} 2`)
    const m3 = await enviar(larissa, `${MARCA} 3`)
    const d1 = await enviar(diego, `${MARCA} do Diego`)

    const antes = Date.now()
    const r1 = await chamar('PUT', `/conversas/${CONVERSA}/mensagens/${m1}/fixar`, { cookie: larissa, json: { duracao: '24h' } })
    assert.equal(r1.status, 200)
    assert.deepEqual(await aviso, { conversa_id: CONVERSA }) // o Diego fica sabendo na hora
    const expira = new Date(r1.dados.fixadas[0].expira_em).getTime()
    assert.ok(Math.abs(expira - (antes + 24 * 3600 * 1000)) < 60_000, 'prazo de 24 horas')
    assert.equal(r1.dados.fixadas[0].mensagem.texto, `${MARCA} 1`)

    const r2 = await chamar('PUT', `/conversas/${CONVERSA}/mensagens/${d1}/fixar`, { cookie: diego }) // sem duração: 7 dias
    const expira2 = new Date(r2.dados.fixadas.find((f) => f.mensagem_id === d1).expira_em).getTime()
    assert.ok(Math.abs(expira2 - (Date.now() + 7 * 24 * 3600 * 1000)) < 60_000, 'padrão de 7 dias')
    assert.equal((await chamar('PUT', `/conversas/${CONVERSA}/mensagens/${m2}/fixar`, { cookie: larissa, json: { duracao: '30d' } })).status, 200)

    const quarta = await chamar('PUT', `/conversas/${CONVERSA}/mensagens/${m3}/fixar`, { cookie: larissa, json: { duracao: '7d' } })
    assert.equal(quarta.status, 409)
    assert.equal(quarta.dados.codigo, 'LIMITE_DE_FIXADAS')
    const substituiu = await chamar('PUT', `/conversas/${CONVERSA}/mensagens/${m3}/fixar`, { cookie: larissa, json: { duracao: '7d', substituir: true } })
    assert.equal(substituiu.status, 200)
    assert.equal(substituiu.dados.substituida, m1) // a mais antiga saiu
    assert.deepEqual(substituiu.dados.fixadas.map((f) => f.mensagem_id), [d1, m2, m3])

    // fixar de novo a que já está: renova o prazo, sem pedir para substituir
    assert.equal((await chamar('PUT', `/conversas/${CONVERSA}/mensagens/${d1}/fixar`, { cookie: larissa, json: { duracao: '30d' } })).status, 200)
    assert.deepEqual((await fixadasDe(diego)).map((f) => f.mensagem_id), [m2, m3, d1]) // a renovada passa a ser a mais nova
    assert.deepEqual((await fixadasDe(larissa)).map((f) => f.mensagem_id), [m2, m3, d1]) // as duas pessoas veem
  })

  test('dados inválidos, mensagem de outra conversa e quem não participa', async () => {
    const m = await enviar(larissa, `${MARCA} validação`)
    assert.equal((await chamar('PUT', `/conversas/${CONVERSA}/mensagens/${m}/fixar`, { cookie: larissa, json: { duracao: '1ano' } })).status, 400)
    assert.equal((await chamar('PUT', `/conversas/${CONVERSA}/mensagens/${m}/fixar`, { cookie: larissa, json: { substituir: 'sim' } })).status, 400)
    assert.equal((await chamar('PUT', `/conversas/${CONVERSA}/mensagens/999999999/fixar`, { cookie: larissa })).status, 404)
    assert.equal((await chamar('PUT', `/conversas/${conversasCriadas[0]}/mensagens/${m}/fixar`, { cookie: larissa })).status, 404)
    assert.equal((await chamar('PUT', `/conversas/${CONVERSA}/mensagens/${m}/fixar`, { cookie: outraPessoa })).status, 403)
    assert.equal((await chamar('GET', `/conversas/${CONVERSA}/mensagens-fixadas`, { cookie: outraPessoa })).status, 403)
    assert.equal((await chamar('DELETE', `/conversas/${CONVERSA}/mensagens/${m}/fixar`, { cookie: outraPessoa })).status, 403)
  })

  test('apagada para todos sai das fixadas; apagada "para mim" some só para quem apagou; vencida sai; qualquer um desafixa', async () => {
    const [m2, m3, d1] = (await fixadasDe(larissa)).map((f) => f.mensagem_id)
    // apagar para todos (a m3 é da Larissa)
    assert.equal((await chamar('DELETE', `/conversas/${CONVERSA}/mensagens/${m3}?para=todos`, { cookie: larissa })).status, 200)
    assert.deepEqual((await fixadasDe(diego)).map((f) => f.mensagem_id), [m2, d1])
    assert.equal((await chamar('PUT', `/conversas/${CONVERSA}/mensagens/${m3}/fixar`, { cookie: larissa })).status, 409) // apagada não se fixa

    // apagar para mim: o Diego não vê mais a d1 fixada; a Larissa continua vendo
    assert.equal((await chamar('DELETE', `/conversas/${CONVERSA}/mensagens/${d1}?para=mim`, { cookie: diego })).status, 204)
    assert.deepEqual((await fixadasDe(diego)).map((f) => f.mensagem_id), [m2])
    assert.deepEqual((await fixadasDe(larissa)).map((f) => f.mensagem_id), [m2, d1])

    // vencida: sai da lista (e do banco)
    await db.query('UPDATE mensagem_fixada SET expira_em = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE mensagem_id = ?', [d1])
    assert.deepEqual((await fixadasDe(larissa)).map((f) => f.mensagem_id), [m2])
    const [restantes] = await db.query('SELECT mensagem_id FROM mensagem_fixada WHERE conversa_id = ?', [CONVERSA])
    assert.deepEqual(restantes.map((r) => r.mensagem_id), [m2])

    // o Diego desafixa uma mensagem que a Larissa fixou
    assert.deepEqual((await chamar('DELETE', `/conversas/${CONVERSA}/mensagens/${m2}/fixar`, { cookie: diego })).dados.fixadas, [])
    assert.deepEqual(await fixadasDe(larissa), [])
  })
})
