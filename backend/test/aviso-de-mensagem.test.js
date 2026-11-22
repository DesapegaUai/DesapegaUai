// Notificação de mensagem nova no aparelho (push): chega sem a pessoa ativar nada no sininho,
// não chega para quem está com o site na tela e respeita quem desligou "Avisar mensagens novas".
// Conversa 1 do seed: anúncio do Diego (1), comprada pela Larissa (2).
// O envio de verdade para o aparelho é trocado por uma função que só guarda o que seria enviado.
import assert from 'node:assert/strict'
import { createECDH, randomBytes } from 'node:crypto'
import { after, before, test } from 'node:test'
import { io as conectarSocket } from 'socket.io-client'
import webpush from 'web-push'

const chaves = webpush.generateVAPIDKeys() // chaves de push só para o teste
process.env.VAPID_PUBLIC_KEY = chaves.publicKey
process.env.VAPID_PRIVATE_KEY = chaves.privateKey
process.env.PERMITIR_LOGIN_TESTE = 'true'
const enviados = []
webpush.sendNotification = async (inscricao, corpo) => { enviados.push({ endpoint: inscricao.endpoint, ...JSON.parse(corpo) }) }

const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { encerrarSocket, iniciarSocket } = await import('../src/socket.js')
const servidor = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)) })
iniciarSocket(servidor)
const porta = servidor.address().port
const base = `http://127.0.0.1:${porta}/api`
const APARELHO_DO_DIEGO = 'https://push.exemplo.test/aparelho-do-diego'
let diego, larissa
const sockets = []

async function chamar(metodo, caminho, { cookie, json } = {}) {
  const headers = cookie ? { Cookie: cookie } : {}
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(base + caminho, { method: metodo, headers, body: json !== undefined ? JSON.stringify(json) : undefined })
  const texto = await r.text()
  return { status: r.status, dados: texto ? JSON.parse(texto) : null }
}
const entrar = async (id) => (await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })).headers.getSetCookie()[0].split(';')[0]
const enviar = async (texto) => (await chamar('POST', '/conversas/1/mensagens', { cookie: larissa, json: { texto } })).dados.mensagem
const pausa = (ms) => new Promise((ok) => { setTimeout(ok, ms) })

// espera a notificação dessa mensagem chegar no aparelho do Diego (ou desiste)
async function notificacaoDe(texto, esperarMs = 2000) {
  for (let passou = 0; passou < esperarMs; passou += 50) {
    const achada = enviados.find((n) => n.endpoint === APARELHO_DO_DIEGO && n.texto === texto)
    if (achada) return achada
    await pausa(50)
  }
  return null
}

async function abrirSocket(cookie) {
  const socket = conectarSocket(`http://127.0.0.1:${porta}`, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { Cookie: cookie }, reconnection: false })
  sockets.push(socket)
  await new Promise((ok, falha) => { socket.once('connect', ok); socket.once('connect_error', falha) })
  return socket
}

before(async () => {
  diego = await entrar(1)
  larissa = await entrar(2)
  // o aparelho do Diego permitiu as notificações; ele não ativou os avisos de anúncios no sininho
  const preferencias = (await chamar('GET', '/notificacoes/preferencias', { cookie: diego })).dados
  assert.equal(preferencias.anuncios, false)
  assert.equal(preferencias.mensagens, true) // ligado por padrão
  const p256dh = createECDH('prime256v1').generateKeys().toString('base64url')
  const r = await chamar('POST', '/notificacoes/push', { cookie: diego, json: { endpoint: APARELHO_DO_DIEGO, keys: { p256dh, auth: randomBytes(16).toString('base64url') } } })
  assert.equal(r.status < 300, true, `não inscreveu o aparelho: ${r.status}`)
})

after(async () => {
  for (const s of sockets) s.disconnect()
  await chamar('DELETE', '/notificacoes/push', { cookie: diego, json: { endpoint: APARELHO_DO_DIEGO } })
  await chamar('PUT', '/notificacoes/preferencias', { cookie: diego, json: { mensagens: true } })
  await db.query("DELETE FROM mensagem WHERE conversa_id = 1 AND texto LIKE 'Teste do aviso%'")
  await encerrarSocket()
  servidor.closeAllConnections()
  await db.end()
})

test('mensagem nova chega no aparelho de quem está fora do site, sem ativar nada no sininho, com o nome e a foto de quem mandou', async () => {
  const texto = 'Teste do aviso: ainda tem a air fryer?'
  await enviar(texto)
  const n = await notificacaoDe(texto)
  assert.ok(n, 'a notificação não chegou')
  assert.equal(n.titulo, 'Larissa Andrade') // como no WhatsApp: o nome de quem mandou
  assert.equal(n.icone, null) // a Larissa não tem foto: o aparelho desenha as iniciais, como no perfil
  assert.equal(n.iniciais, 'LA')
  assert.equal(n.url, '/conversas/1')
  assert.equal(n.tag, 'conversa-1')
  assert.equal(enviados.some((x) => x.texto === texto && x.endpoint !== APARELHO_DO_DIEGO), false, 'quem mandou não recebe')
})

test('com o site na tela a notificação não vai (a mensagem aparece no site); saiu da aba, ela volta a ir', async () => {
  const aba = await abrirSocket(diego)
  aba.emit('na_tela', true)
  await pausa(150)
  const naTela = 'Teste do aviso: com o site aberto'
  await enviar(naTela)
  assert.equal(await notificacaoDe(naTela, 600), null, 'não devia notificar quem está olhando o site')

  aba.emit('na_tela', false) // trocou de aba ou bloqueou o celular
  await pausa(150)
  const foraDaTela = 'Teste do aviso: com o site em outra aba'
  await enviar(foraDaTela)
  assert.ok(await notificacaoDe(foraDaTela), 'devia notificar quem saiu da aba')
  aba.disconnect()
})

test('mensagem enviada pelo tempo real (Socket.IO) também notifica', async () => {
  const daLarissa = await abrirSocket(larissa)
  const texto = 'Teste do aviso: mandei pelo socket'
  const resposta = await new Promise((ok) => daLarissa.timeout(4000).emit('enviar_mensagem', { conversa_id: 1, texto }, (erro, r) => ok(erro ? null : r)))
  assert.equal(resposta?.ok, true)
  assert.ok(await notificacaoDe(texto))
  daLarissa.disconnect()
})

test('quem desligou "Avisar mensagens novas" não recebe a notificação', async () => {
  await chamar('PUT', '/notificacoes/preferencias', { cookie: diego, json: { mensagens: false } })
  const texto = 'Teste do aviso: com os avisos desligados'
  await enviar(texto)
  assert.equal(await notificacaoDe(texto, 600), null)
  await chamar('PUT', '/notificacoes/preferencias', { cookie: diego, json: { mensagens: true } })
})
