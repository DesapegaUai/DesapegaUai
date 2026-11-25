// Vídeo no chat: envio com legenda, entrega em tempo real, quem pode ver, assistir em pedaços (Range),
// arquivo que não é vídeo e apagar para todos (o arquivo sai do disco).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { access } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import caminhoDoFfmpeg from 'ffmpeg-static'
import { after, before, test } from 'node:test'
import { io as conectarSocket } from 'socket.io-client'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { encerrarSocket, iniciarSocket } = await import('../src/socket.js')
const { caminhoDoVideoDoChat } = await import('../src/utils/fotos.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
iniciarSocket(servidor)
const origem = `http://127.0.0.1:${servidor.address().port}`
const base = `${origem}/api`

const CONVERSA = 1 // do seed: Larissa (2) conversa com o Diego (1) sobre a air fryer
let vendedor // Diego (1)
let comprador // Larissa (2)
let outraPessoa // Usuário Teste (3), que não participa da conversa
const sockets = []

// vídeos de verdade de 2 s (barras coloridas), gerados na hora com o ffmpeg da API: a IA da moderação
// abre o vídeo e confere os quadros, então um arquivo que só começa como MP4 não passa mais
function videoDeTeste(formato) {
  const arquivo = path.join(os.tmpdir(), `desapegauai-teste-video-${process.pid}.${formato}`)
  execFileSync(caminhoDoFfmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=15',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', formato, arquivo])
  const dados = readFileSync(arquivo)
  rmSync(arquivo, { force: true })
  return dados
}
const VIDEO_MP4 = videoDeTeste('mp4') // caixa ftyp "isom"
const VIDEO_MOV = videoDeTeste('mov') // caixa ftyp "qt  ", como o do iPhone

async function entrarComo(id) {
  const r = await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })
  return r.headers.get('set-cookie').split(';')[0]
}

function enviarVideo(cookie, dados, { tipo = 'video/mp4', nome = 'video.mp4', texto, conversaId = CONVERSA } = {}) {
  const corpo = new FormData()
  corpo.append('video', new Blob([dados], { type: tipo }), nome)
  if (texto !== undefined) corpo.append('texto', texto)
  return fetch(`${base}/conversas/${conversaId}/videos`, { method: 'POST', headers: { Cookie: cookie }, body: corpo })
}

const existe = (caminho) => access(caminho).then(() => true, () => false)

before(async () => {
  vendedor = await entrarComo(1)
  comprador = await entrarComo(2)
  outraPessoa = await entrarComo(3)
})

after(async () => {
  for (const s of sockets) s.disconnect()
  await db.query("DELETE FROM mensagem WHERE conversa_id = ? AND (video IS NOT NULL OR texto LIKE 'Teste do vídeo%')", [CONVERSA])
  await encerrarSocket()
  servidor.closeAllConnections()
  await db.end()
})

test('quem conversa manda um vídeo com legenda e a outra pessoa recebe na hora', async () => {
  const socket = conectarSocket(origem, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { Cookie: vendedor }, reconnection: false })
  sockets.push(socket)
  await new Promise((ok, falha) => { socket.once('connect', ok); socket.once('connect_error', falha) })
  const chegou = new Promise((ok) => socket.once('nova_mensagem', ok))

  const r = await enviarVideo(comprador, VIDEO_MP4, { texto: 'Teste do vídeo: olha funcionando' })
  assert.equal(r.status, 201)
  const { mensagem } = await r.json()
  assert.equal(mensagem.texto, 'Teste do vídeo: olha funcionando')
  assert.match(mensagem.video.url, new RegExp(`^/api/conversas/${CONVERSA}/videos/[a-f0-9]{32}\\.mp4$`))
  assert.equal(mensagem.foto, null)
  const recebida = await chegou
  assert.equal(recebida.video.url, mensagem.video.url)
  assert.ok(await existe(caminhoDoVideoDoChat(CONVERSA, mensagem.video.url.split('/').pop())))

  // aparece na conversa das duas pessoas
  const lista = await (await fetch(`${base}/conversas/${CONVERSA}/mensagens`, { headers: { Cookie: vendedor } })).json()
  assert.ok(lista.mensagens.some((m) => m.video?.url === mensagem.video.url))
  socket.disconnect()
})

test('o vídeo abre só para quem participa, e dá para assistir em pedaços (avançar sem baixar tudo)', async () => {
  const { mensagem } = await (await enviarVideo(comprador, VIDEO_MP4)).json()
  const url = `${origem}${mensagem.video.url}`

  const inteiro = await fetch(url, { headers: { Cookie: vendedor } })
  assert.equal(inteiro.status, 200)
  assert.equal(inteiro.headers.get('content-type'), 'video/mp4')
  assert.equal(Number(inteiro.headers.get('content-length')), VIDEO_MP4.length)

  const pedaco = await fetch(url, { headers: { Cookie: vendedor, Range: 'bytes=0-99' } })
  assert.equal(pedaco.status, 206)
  assert.equal((await pedaco.arrayBuffer()).byteLength, 100)

  assert.equal((await fetch(url, { headers: { Cookie: outraPessoa } })).status, 403)
  assert.equal((await fetch(url)).status, 401)
  assert.equal((await fetch(`${base}/conversas/${CONVERSA}/videos/..%2F..%2Fsegredo.mp4`, { headers: { Cookie: vendedor } })).status, 404)
})

test('o vídeo do iPhone (MOV) é aceito e toca como MP4', async () => {
  const r = await enviarVideo(comprador, VIDEO_MOV, { tipo: 'video/quicktime', nome: 'IMG_0001.MOV' })
  assert.equal(r.status, 201)
  const { mensagem } = await r.json()
  assert.match(mensagem.video.url, /\.mov$/)
  const resposta = await fetch(`${origem}${mensagem.video.url}`, { headers: { Cookie: vendedor } })
  assert.equal(resposta.headers.get('content-type'), 'video/mp4')
})

test('arquivo que não é vídeo, sem vídeo ou de quem não participa é recusado', async () => {
  const falso = await enviarVideo(comprador, Buffer.from('isto não é um vídeo, é um texto qualquer'), { nome: 'virus.mp4' })
  assert.equal(falso.status, 400)
  assert.match((await falso.json()).erro ?? '', /vídeo/i)

  const imagem = await enviarVideo(comprador, VIDEO_MP4, { tipo: 'image/png', nome: 'foto.png' })
  assert.equal(imagem.status, 400)

  const semVideo = await fetch(`${base}/conversas/${CONVERSA}/videos`, { method: 'POST', headers: { Cookie: comprador }, body: new FormData() })
  assert.equal(semVideo.status, 400)

  assert.equal((await enviarVideo(outraPessoa, VIDEO_MP4)).status, 403)
})

test('apagar para todos tira o vídeo da conversa e do disco', async () => {
  const { mensagem } = await (await enviarVideo(comprador, VIDEO_MP4)).json()
  const caminho = caminhoDoVideoDoChat(CONVERSA, mensagem.video.url.split('/').pop())
  assert.ok(await existe(caminho))
  const r = await fetch(`${base}/conversas/${CONVERSA}/mensagens/${mensagem.id}?para=todos`, { method: 'DELETE', headers: { Cookie: comprador } })
  assert.equal(r.status, 200)
  const apagada = (await r.json()).mensagem
  assert.equal(apagada.apagada, true)
  assert.equal(apagada.video, null)
  assert.equal(await existe(caminho), false)
})
