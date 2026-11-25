// Programar mensagem no chat (como no WhatsApp): só quem participa da conversa programa, só quem programou
// vê e apaga, e na hora certa a mensagem sai uma vez só, mesmo com "Enviar agora" e a fila ao mesmo tempo.
// Conversa 1 do seed: Larissa (2) comprando do Diego (1); o usuário 3 não participa.
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const programadas = await import('../src/services/mensagemProgramadaService.js')
const servidor = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)) })
const base = `http://127.0.0.1:${servidor.address().port}/api`
let larissa, diego, terceiro
const marca = `programada-teste-${Date.now()}`

async function chamar(metodo, caminho, { cookie, json } = {}) {
  const headers = cookie ? { Cookie: cookie } : {}
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(base + caminho, { method: metodo, headers, body: json !== undefined ? JSON.stringify(json) : undefined })
  const t = await r.text()
  return { status: r.status, dados: t ? JSON.parse(t) : null, texto: t }
}
const entrar = async (id) => (await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })).headers.getSetCookie()[0].split(';')[0]
const daqui = (minutos) => new Date(Date.now() + minutos * 60 * 1000).toISOString()
const mensagensCom = async (texto) => (await db.query('SELECT id, remetente_id FROM mensagem WHERE conversa_id = 1 AND texto = ?', [texto]))[0]
const programar = (texto, enviar_em = daqui(60), cookie = larissa) => chamar('POST', '/conversas/1/programadas', { cookie, json: { texto, enviar_em } })
// uma programada que já passou da hora, direto no banco (como se o servidor tivesse ficado desligado)
async function vencida(texto) {
  const [r] = await db.query('INSERT INTO mensagem_programada (conversa_id, remetente_id, texto, enviar_em) VALUES (1, 2, ?, UTC_TIMESTAMP() - INTERVAL 1 MINUTE)', [texto])
  return r.insertId
}

before(async () => {
  larissa = await entrar(2); diego = await entrar(1); terceiro = await entrar(3)
  await db.query('DELETE FROM mensagem_programada')
})
after(async () => {
  await db.query('DELETE FROM mensagem_programada')
  await db.query('DELETE FROM mensagem WHERE conversa_id = 1 AND texto LIKE ?', [`${marca}%`])
  servidor.close(); servidor.closeAllConnections(); await db.end()
})

describe('Programar mensagem', () => {
  test('precisa de login', async () => {
    assert.equal((await chamar('GET', '/conversas/1/programadas')).status, 401)
    assert.equal((await chamar('POST', '/conversas/1/programadas', { json: { texto: 'oi', enviar_em: daqui(5) } })).status, 401)
    assert.equal((await chamar('DELETE', '/conversas/1/programadas/1')).status, 401)
    assert.equal((await chamar('POST', '/conversas/1/programadas/1/enviar')).status, 401)
  })

  test('confere o texto e o horário (no futuro, até 30 dias)', async () => {
    for (const [texto, enviar_em] of [
      [undefined, daqui(5)], ['', daqui(5)], ['   ', daqui(5)], ['x'.repeat(1001), daqui(5)], [123, daqui(5)],
      [`${marca} a`, undefined], [`${marca} a`, ''], [`${marca} a`, 'amanhã de manhã'], [`${marca} a`, 1767225600000],
      [`${marca} a`, daqui(-1)], [`${marca} a`, new Date().toISOString()], [`${marca} a`, daqui(31 * 24 * 60)],
    ]) {
      const r = await chamar('POST', '/conversas/1/programadas', { cookie: larissa, json: { texto, enviar_em } })
      assert.equal(r.status, 400, `${String(texto).slice(0, 20)} / ${enviar_em}: ${r.texto}`)
    }
    assert.equal((await programar(`${marca} dia 30`, daqui(30 * 24 * 60 - 5))).status, 201)
  })

  test('só quem participa da conversa programa; conversa que não existe é 404', async () => {
    assert.equal((await programar(`${marca} b`, daqui(10), terceiro)).status, 403)
    assert.equal((await chamar('POST', '/conversas/999999/programadas', { cookie: larissa, json: { texto: 'oi', enviar_em: daqui(10) } })).status, 404)
    assert.equal((await chamar('POST', '/conversas/abc/programadas', { cookie: larissa, json: { texto: 'oi', enviar_em: daqui(10) } })).status, 400)
  })

  test('programa no minuto escolhido e só quem programou vê', async () => {
    const r = await programar(`${marca} c`, '2030-01-01T10:30:45.123Z')
    assert.equal(r.status, 400) // mais de 30 dias
    const ok = await programar(`${marca} c`, daqui(120))
    assert.equal(ok.status, 201, ok.texto)
    assert.equal(new Date(ok.dados.programada.enviar_em).getUTCSeconds(), 0)
    assert.deepEqual(Object.keys(ok.dados.programada).sort(), ['conversa_id', 'criada_em', 'enviar_em', 'id', 'texto'])
    const minhas = (await chamar('GET', '/conversas/1/programadas', { cookie: larissa })).dados.programadas
    assert.ok(minhas.some((p) => p.id === ok.dados.programada.id))
    assert.deepEqual((await chamar('GET', '/conversas/1/programadas', { cookie: diego })).dados.programadas, []) // a outra pessoa não vê
    assert.equal((await chamar('GET', '/conversas/1/programadas', { cookie: terceiro })).status, 403)
    assert.equal((await mensagensCom(`${marca} c`)).length, 0) // ainda não saiu
  })

  test('a outra pessoa não apaga nem envia a programada; quem programou apaga', async () => {
    const { programada } = (await programar(`${marca} d`, daqui(30))).dados
    assert.equal((await chamar('DELETE', `/conversas/1/programadas/${programada.id}`, { cookie: diego })).status, 404)
    assert.equal((await chamar('POST', `/conversas/1/programadas/${programada.id}/enviar`, { cookie: diego })).status, 404)
    assert.equal((await chamar('DELETE', `/conversas/1/programadas/${programada.id}`, { cookie: terceiro })).status, 403)
    assert.equal((await chamar('DELETE', `/conversas/1/programadas/${programada.id}`, { cookie: larissa })).status, 204)
    assert.equal((await chamar('DELETE', `/conversas/1/programadas/${programada.id}`, { cookie: larissa })).status, 404)
    assert.equal((await mensagensCom(`${marca} d`)).length, 0)
  })

  test('"Enviar agora" manda na hora, para os dois, e tira da lista', async () => {
    const { programada } = (await programar(`${marca} e`, daqui(45))).dados
    const r = await chamar('POST', `/conversas/1/programadas/${programada.id}/enviar`, { cookie: larissa })
    assert.equal(r.status, 201, r.texto)
    assert.equal(r.dados.mensagem.texto, `${marca} e`)
    assert.equal(r.dados.mensagem.minha, true)
    const doDiego = (await chamar('GET', '/conversas/1/mensagens', { cookie: diego })).dados
    assert.ok(JSON.stringify(doDiego).includes(`${marca} e`), 'o Diego não recebeu')
    assert.ok(!(await chamar('GET', '/conversas/1/programadas', { cookie: larissa })).dados.programadas.some((p) => p.id === programada.id))
    assert.equal((await chamar('POST', `/conversas/1/programadas/${programada.id}/enviar`, { cookie: larissa })).status, 404) // não sai duas vezes
    assert.equal((await mensagensCom(`${marca} e`)).length, 1)
  })

  test('no horário, a fila manda sozinha (inclusive as atrasadas, se o servidor ficou desligado)', async () => {
    const id = await vencida(`${marca} f`)
    const enviadas = await programadas.processarVencidas()
    assert.ok(enviadas >= 1)
    const saiu = await mensagensCom(`${marca} f`)
    assert.equal(saiu.length, 1)
    assert.equal(saiu[0].remetente_id, 2)
    assert.equal((await db.query('SELECT id FROM mensagem_programada WHERE id = ?', [id]))[0].length, 0)
    await programadas.processarVencidas() // de novo: não repete
    assert.equal((await mensagensCom(`${marca} f`)).length, 1)
  })

  test('fila e "Enviar agora" ao mesmo tempo: a mensagem sai uma vez só', async () => {
    for (let volta = 0; volta < 5; volta += 1) {
      const texto = `${marca} g${volta}`
      const id = await vencida(texto)
      const resultados = await Promise.allSettled([
        programadas.processarVencidas(),
        chamar('POST', `/conversas/1/programadas/${id}/enviar`, { cookie: larissa }),
        programadas.processarVencidas(),
      ])
      assert.ok(resultados.every((r) => r.status === 'fulfilled'))
      assert.equal((await mensagensCom(texto)).length, 1, `volta ${volta}: saiu mais de uma vez`)
    }
  })

  test('programada de conversa que não deixa mais enviar sai da fila sem travar as outras', async () => {
    // remetente que não participa (dado estragado no banco): descarta e segue para a próxima
    const [r] = await db.query("INSERT INTO mensagem_programada (conversa_id, remetente_id, texto, enviar_em) VALUES (1, 3, ?, UTC_TIMESTAMP() - INTERVAL 2 MINUTE)", [`${marca} h`])
    await vencida(`${marca} i`)
    await programadas.processarVencidas()
    assert.equal((await db.query('SELECT id FROM mensagem_programada WHERE id = ?', [r.insertId]))[0].length, 0)
    assert.equal((await mensagensCom(`${marca} h`)).length, 0)
    assert.equal((await mensagensCom(`${marca} i`)).length, 1)
  })

  test('no máximo 20 programadas por conversa para cada pessoa', async () => {
    await db.query('DELETE FROM mensagem_programada')
    for (let i = 0; i < 20; i += 1) assert.equal((await programar(`${marca} j${i}`, daqui(60 + i))).status, 201)
    assert.equal((await programar(`${marca} j20`, daqui(90))).status, 409)
    assert.equal((await programar(`${marca} k`, daqui(90), diego)).status, 201) // a outra pessoa tem as próprias 20
    await db.query('DELETE FROM mensagem_programada')
  })
})
