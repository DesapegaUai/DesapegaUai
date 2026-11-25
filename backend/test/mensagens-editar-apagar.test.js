// Editar e apagar mensagem no chat, como no WhatsApp: editar a própria até 15 minutos, apagar para todos
// a própria até 2 dias e apagar para mim qualquer mensagem da conversa.
// Conversa 1 do seed: anúncio do Diego (1), comprada pela Larissa (2). O Usuário Teste (3) não participa.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { after, before, describe, test } from 'node:test'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { pastaDaConversa } = await import('../src/utils/fotos.js')
const servidor = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)) })
const base = `http://127.0.0.1:${servidor.address().port}/api`
let diego, larissa, teste

async function chamar(metodo, caminho, { cookie, json, form } = {}) {
  const headers = cookie ? { Cookie: cookie } : {}
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(base + caminho, { method: metodo, headers, body: json !== undefined ? JSON.stringify(json) : form })
  const texto = await r.text()
  let dados = null
  try { dados = texto ? JSON.parse(texto) : null } catch { /* não é JSON */ }
  return { status: r.status, dados }
}
const entrar = async (id) => (await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })).headers.getSetCookie()[0].split(';')[0]
const enviar = async (cookie, texto, conversa = 1) => (await chamar('POST', `/conversas/${conversa}/mensagens`, { cookie, json: { texto } })).dados.mensagem
const mensagensDe = async (cookie, conversa = 1) => (await chamar('GET', `/conversas/${conversa}/mensagens`, { cookie })).dados.mensagens
const envelhecer = (id, minutos) => db.query('UPDATE mensagem SET enviada_em = NOW() - INTERVAL ? MINUTE WHERE id = ?', [minutos, id])

// o que o teste cria sai no fim: as mensagens novas da conversa 1 e a conversa do Usuário Teste
// (sem isso, rodar a bateria duas vezes seguidas muda os totais do perfil)
let ultimaMensagemAntes = 0
const conversasCriadas = []
before(async () => {
  diego = await entrar(1); larissa = await entrar(2); teste = await entrar(3)
  ultimaMensagemAntes = (await db.query('SELECT COALESCE(MAX(id), 0) AS id FROM mensagem'))[0][0].id
})
after(async () => {
  await db.query('DELETE FROM mensagem WHERE conversa_id = 1 AND id > ?', [ultimaMensagemAntes])
  for (const id of conversasCriadas) await db.query('DELETE FROM conversa WHERE id = ?', [id])
  servidor.close(); servidor.closeAllConnections(); await db.end()
})

describe('Editar mensagem', () => {
  test('quem enviou edita até 15 minutos e as duas pessoas veem o texto novo com "editada"', async () => {
    const m = await enviar(larissa, 'Posso buscar amanhã às 9h?')
    const r = await chamar('PATCH', `/conversas/1/mensagens/${m.id}`, { cookie: larissa, json: { texto: 'Posso buscar amanhã às 10h?' } })
    assert.equal(r.status, 200)
    assert.equal(r.dados.mensagem.texto, 'Posso buscar amanhã às 10h?')
    assert.equal(r.dados.mensagem.editada, true)
    const doDiego = (await mensagensDe(diego)).find((x) => x.id === m.id)
    assert.equal(doDiego.texto, 'Posso buscar amanhã às 10h?')
    assert.equal(doDiego.editada, true)
  })

  test('ninguém edita a mensagem de outra pessoa', async () => {
    const m = await enviar(larissa, 'Mensagem da Larissa')
    assert.equal((await chamar('PATCH', `/conversas/1/mensagens/${m.id}`, { cookie: diego, json: { texto: 'mudei' } })).status, 403)
    assert.equal((await chamar('PATCH', `/conversas/1/mensagens/${m.id}`, { cookie: teste, json: { texto: 'mudei' } })).status, 403)
    assert.equal((await chamar('PATCH', `/conversas/1/mensagens/${m.id}`, { json: { texto: 'mudei' } })).status, 401)
    assert.equal((await mensagensDe(larissa)).find((x) => x.id === m.id).texto, 'Mensagem da Larissa')
  })

  test('o id de uma mensagem de outra conversa não vale nesta conversa', async () => {
    const outra = (await chamar('POST', '/conversas', { cookie: teste, json: { anuncio_id: 2 } })).dados.conversa
    conversasCriadas.push(outra.id)
    const m = await enviar(teste, 'Ainda está disponível?', outra.id)
    // a Larissa participa da conversa 1 e tenta usar o id de uma mensagem da conversa do Usuário Teste
    assert.equal((await chamar('PATCH', `/conversas/1/mensagens/${m.id}`, { cookie: larissa, json: { texto: 'x' } })).status, 404)
    assert.equal((await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=mim`, { cookie: larissa })).status, 404)
  })

  test('depois de 15 minutos não dá mais para editar', async () => {
    const m = await enviar(larissa, 'Mensagem antiga')
    await envelhecer(m.id, 16)
    const r = await chamar('PATCH', `/conversas/1/mensagens/${m.id}`, { cookie: larissa, json: { texto: 'tarde demais' } })
    assert.equal(r.status, 409)
    assert.match(r.dados.erro, /15 minutos/)
  })

  test('texto vazio ou com mais de 1000 letras é recusado', async () => {
    const m = await enviar(larissa, 'Texto original')
    assert.equal((await chamar('PATCH', `/conversas/1/mensagens/${m.id}`, { cookie: larissa, json: { texto: '   ' } })).status, 400)
    assert.equal((await chamar('PATCH', `/conversas/1/mensagens/${m.id}`, { cookie: larissa, json: { texto: 'a'.repeat(1001) } })).status, 400)
    assert.equal((await chamar('PATCH', `/conversas/1/mensagens/${m.id}`, { cookie: larissa, json: { texto: { a: 1 } } })).status, 400)
  })
})

describe('Apagar para todos', () => {
  test('quem enviou apaga: as duas pessoas veem "apagada", sem texto, e não dá mais para editar', async () => {
    const m = await enviar(larissa, 'Meu telefone é 31 99999-0000')
    const r = await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=todos`, { cookie: larissa })
    assert.equal(r.status, 200)
    assert.equal(r.dados.mensagem.apagada, true)
    for (const cookie of [diego, larissa]) {
      const vista = (await mensagensDe(cookie)).find((x) => x.id === m.id)
      assert.equal(vista.apagada, true)
      assert.equal(vista.texto, '')
      assert.equal(vista.foto, null)
    }
    const [[banco]] = await db.query('SELECT texto, foto, apagada_em FROM mensagem WHERE id = ?', [m.id])
    assert.equal(banco.texto, '', 'o texto sai do banco, não fica só escondido')
    assert.ok(banco.apagada_em)
    assert.equal((await chamar('PATCH', `/conversas/1/mensagens/${m.id}`, { cookie: larissa, json: { texto: 'volta' } })).status, 409)
    assert.equal((await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=todos`, { cookie: larissa })).status, 200, 'apagar de novo não é erro')
  })

  test('ninguém apaga para todos a mensagem de outra pessoa', async () => {
    const m = await enviar(larissa, 'Não pode sumir')
    assert.equal((await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=todos`, { cookie: diego })).status, 403)
    assert.equal((await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=todos`, { cookie: teste })).status, 403)
    assert.equal((await mensagensDe(diego)).find((x) => x.id === m.id).texto, 'Não pode sumir')
  })

  test('depois de 2 dias só dá para apagar para mim', async () => {
    const m = await enviar(larissa, 'Mensagem de 3 dias atrás')
    await envelhecer(m.id, 3 * 24 * 60)
    const r = await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=todos`, { cookie: larissa })
    assert.equal(r.status, 409)
    assert.equal((await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=mim`, { cookie: larissa })).status, 204)
  })

  test('a foto apagada para todos sai do disco e não abre mais', async () => {
    const foto = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#3E8B22' } }).jpeg().toBuffer()
    const form = new FormData()
    form.append('fotos', new Blob([foto], { type: 'image/jpeg' }), 'foto.jpg')
    const enviada = (await chamar('POST', '/conversas/1/fotos', { cookie: diego, form })).dados.mensagens[0]
    const nome = enviada.foto.pequena.split('/').pop().replace(/-\d+\.webp$/, '')
    const noDisco = async () => (await fs.readdir(pastaDaConversa(1)).catch(() => [])).filter((a) => a.startsWith(nome)).length
    assert.equal(await noDisco(), 2)
    assert.equal((await chamar('DELETE', `/conversas/1/mensagens/${enviada.id}?para=todos`, { cookie: diego })).status, 200)
    assert.equal(await noDisco(), 0)
    const r = await fetch(base.replace('/api', '') + enviada.foto.grande, { headers: { Cookie: larissa } })
    assert.equal(r.status, 404)
  })

  test('na lista de conversas, a última mensagem apagada aparece como apagada', async () => {
    const m = await enviar(larissa, 'Vou apagar esta')
    await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=todos`, { cookie: larissa })
    const conversa = (await chamar('GET', '/conversas', { cookie: diego })).dados.itens.find((c) => c.id === 1)
    assert.equal(conversa.ultima_mensagem.id, m.id)
    assert.equal(conversa.ultima_mensagem.apagada, true)
    assert.equal(conversa.ultima_mensagem.texto, '')
  })
})

describe('Apagar para mim', () => {
  test('some só para quem apagou; a outra pessoa continua vendo', async () => {
    const m = await enviar(larissa, 'Mensagem que o Diego vai apagar para ele')
    assert.equal((await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=mim`, { cookie: diego })).status, 204)
    assert.equal((await mensagensDe(diego)).some((x) => x.id === m.id), false)
    assert.equal((await mensagensDe(larissa)).find((x) => x.id === m.id).texto, 'Mensagem que o Diego vai apagar para ele')
    // na lista do Diego, a prévia não mostra a mensagem que ele apagou
    const conversa = (await chamar('GET', '/conversas', { cookie: diego })).dados.itens.find((c) => c.id === 1)
    assert.notEqual(conversa.ultima_mensagem?.id, m.id)
    assert.equal((await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=mim`, { cookie: diego })).status, 204, 'apagar de novo não é erro')
  })

  test('quem não participa não apaga nada, e "para" diferente de mim ou todos é recusado', async () => {
    const m = await enviar(larissa, 'Fica')
    assert.equal((await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=mim`, { cookie: teste })).status, 403)
    assert.equal((await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=ninguem`, { cookie: larissa })).status, 400)
    assert.equal((await chamar('DELETE', '/conversas/1/mensagens/999999?para=mim', { cookie: larissa })).status, 404)
    assert.equal((await chamar('DELETE', '/conversas/999999/mensagens/1?para=mim', { cookie: larissa })).status, 404)
    assert.equal((await chamar('DELETE', `/conversas/1/mensagens/${m.id}?para=mim`)).status, 401)
  })
})
