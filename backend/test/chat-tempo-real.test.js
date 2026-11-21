// Chat em tempo real pelo Socket.IO: entrega, leitura, "digitando", online e limites.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { io as conectarSocket } from 'socket.io-client'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { encerrarSocket, iniciarSocket } = await import('../src/socket.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
iniciarSocket(servidor)
const base = `http://127.0.0.1:${servidor.address().port}/api`
const origemSocket = `http://127.0.0.1:${servidor.address().port}`

let vendedor // Diego (1), dono do anúncio 5 (air fryer)
let comprador // Larissa (2), já conversa com ele (conversa 1 do seed)
const sockets = []

async function entrarComo(id) {
  const r = await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })
  return r.headers.get('set-cookie').split(';')[0]
}

async function abrirSocket(cookie, extra = {}) {
  const socket = conectarSocket(origemSocket, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { Cookie: cookie, ...extra }, reconnection: false })
  sockets.push(socket)
  await new Promise((ok, falha) => {
    socket.once('connect', ok)
    socket.once('connect_error', falha)
  })
  return socket
}

const esperar = (socket, evento) => new Promise((ok, falha) => {
  const tempo = setTimeout(() => falha(new Error(`${evento} não chegou`)), 4000)
  socket.once(evento, (dados) => { clearTimeout(tempo); ok(dados) })
})
const emitir = (socket, evento, dados) => new Promise((ok) => socket.timeout(4000).emit(evento, dados, (erro, resposta) => ok(erro ? { ok: false, erro: 'tempo' } : resposta)))

before(async () => {
  vendedor = await entrarComo(1)
  comprador = await entrarComo(2)
})

after(async () => {
  for (const s of sockets) s.disconnect()
  await db.query("DELETE FROM mensagem WHERE conversa_id = 1 AND texto LIKE 'Teste do chat%'")
  await encerrarSocket()
  servidor.closeAllConnections()
  await db.end()
})

test('a mensagem chega na hora para o outro lado e quem enviou recebe a confirmação', async () => {
  const doVendedor = await abrirSocket(vendedor)
  const doComprador = await abrirSocket(comprador)
  const chegou = esperar(doVendedor, 'nova_mensagem')
  const resposta = await emitir(doComprador, 'enviar_mensagem', { conversa_id: 1, texto: 'Teste do chat: ainda está disponível?' })
  assert.equal(resposta.ok, true, JSON.stringify(resposta))
  const mensagem = await chegou
  assert.equal(mensagem.id, resposta.mensagem.id)
  assert.equal(mensagem.remetente_id, 2)
  assert.equal(mensagem.lida, false)
})

test('quem abre a conversa marca como lida e o outro lado vê na hora', async () => {
  const doVendedor = await abrirSocket(vendedor)
  const doComprador = await abrirSocket(comprador)
  await emitir(doComprador, 'enviar_mensagem', { conversa_id: 1, texto: 'Teste do chat: posso buscar hoje?' })
  const leitura = esperar(doComprador, 'mensagens_lidas')
  const r = await emitir(doVendedor, 'marcar_lidas', { conversa_id: 1 })
  assert.equal(r.ok, true)
  assert.ok(r.marcadas >= 1)
  const aviso = await leitura
  assert.equal(aviso.conversa_id, 1)
  assert.equal(aviso.leitor_id, 1)
})

test('"digitando" chega só para o outro participante', async () => {
  const doVendedor = await abrirSocket(vendedor)
  const doComprador = await abrirSocket(comprador)
  const intruso = await abrirSocket(await entrarComo(3))
  const digitando = esperar(doVendedor, 'digitando')
  let intrusoViu = false
  intruso.once('digitando', () => { intrusoViu = true })
  doComprador.emit('digitando', { conversa_id: 1 })
  assert.deepEqual(await digitando, { conversa_id: 1, usuario_id: 2 })
  intruso.emit('digitando', { conversa_id: 1 })
  await new Promise((ok) => setTimeout(ok, 300))
  assert.equal(intrusoViu, false)
})

test('quem não participa não manda nem lê a conversa', async () => {
  const intruso = await abrirSocket(await entrarComo(3))
  const enviar = await emitir(intruso, 'enviar_mensagem', { conversa_id: 1, texto: 'Teste do chat: invasão' })
  assert.equal(enviar.ok, false)
  assert.match(enviar.erro, /não participa/)
  const ler = await emitir(intruso, 'marcar_lidas', { conversa_id: 1 })
  assert.equal(ler.ok, false)
})

test('online agora: a lista de conversas mostra quem está conectado e avisa quando sai', async () => {
  for (const s of sockets.splice(0)) s.disconnect()
  await new Promise((ok) => setTimeout(ok, 200))
  const doComprador = await abrirSocket(comprador)
  const entrou = esperar(doComprador, 'presenca')
  const doVendedor = await abrirSocket(vendedor)
  assert.deepEqual((await entrou).online, true)
  const lista = await (await fetch(`${base}/conversas`, { headers: { Cookie: comprador } })).json()
  assert.equal(lista.itens.find((c) => c.id === 1).outro_usuario.online, true)
  const saiu = esperar(doComprador, 'presenca')
  doVendedor.disconnect()
  const aviso = await saiu
  assert.equal(aviso.online, false)
  assert.ok(aviso.ultimo_acesso, 'com o horário do último acesso')
})

test('limite: mais de 20 mensagens em 10 segundos são recusadas', async () => {
  const doComprador = await abrirSocket(comprador)
  let recusadas = 0
  for (let i = 0; i < 22; i++) {
    const r = await emitir(doComprador, 'enviar_mensagem', { conversa_id: 1, texto: `Teste do chat: rajada ${i}` })
    if (!r.ok) recusadas++
  }
  assert.equal(recusadas, 2)
})

test('WebSocket vindo de outro site é recusado', async () => {
  const socket = conectarSocket(origemSocket, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { Cookie: comprador, Origin: 'https://site-malicioso.example' }, reconnection: false })
  sockets.push(socket)
  const erro = await new Promise((ok) => {
    socket.once('connect', () => ok(null))
    socket.once('connect_error', ok)
  })
  assert.ok(erro, 'não podia conectar')
})
