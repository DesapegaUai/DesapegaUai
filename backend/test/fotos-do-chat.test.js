// Fotos no chat: envio (uma ou várias, com legenda), entrega em tempo real e quem pode ver a foto.
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import sharp from 'sharp'
import { io as conectarSocket } from 'socket.io-client'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { encerrarSocket, iniciarSocket } = await import('../src/socket.js')
const { caminhoDaFotoDoChat, LARGURAS_FOTO_DO_CHAT } = await import('../src/utils/fotos.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
iniciarSocket(servidor)
const origem = `http://127.0.0.1:${servidor.address().port}`
const base = `${origem}/api`

const CONVERSA = 1 // do seed: Larissa (2) conversa com o Diego (1) sobre a air fryer
const LEGENDA = 'Teste das fotos do chat'
let vendedor // Diego (1)
let comprador // Larissa (2)
let outraPessoa // Usuário Teste (3), que não participa da conversa
let fotoJpg
const sockets = []

async function entrarComo(id) {
  const r = await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })
  return r.headers.get('set-cookie').split(';')[0]
}

// monta o multipart com as fotos no campo "fotos" e, se vier, a legenda no campo "texto"
function enviarFotos(cookie, fotos, texto, conversaId = CONVERSA) {
  const corpo = new FormData()
  for (const [i, foto] of fotos.entries()) {
    corpo.append('fotos', new Blob([foto.dados], { type: foto.tipo ?? 'image/jpeg' }), foto.nome ?? `foto-${i}.jpg`)
  }
  if (texto !== undefined) corpo.append('texto', texto)
  return fetch(`${base}/conversas/${conversaId}/fotos`, { method: 'POST', headers: { Cookie: cookie }, body: corpo })
}

before(async () => {
  vendedor = await entrarComo(1)
  comprador = await entrarComo(2)
  outraPessoa = await entrarComo(3)
  // foto "deitada" de 2000 x 1000, para conferir a redução de tamanho
  fotoJpg = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#3e8b22' } }).jpeg().toBuffer()
})

after(async () => {
  for (const s of sockets) s.disconnect()
  // apaga as mensagens e os arquivos criados aqui (as fotos de teste têm sempre a mesma legenda ou nenhuma)
  const [linhas] = await db.query('SELECT foto FROM mensagem WHERE conversa_id = ? AND foto IS NOT NULL', [CONVERSA])
  for (const { foto } of linhas) {
    for (const largura of LARGURAS_FOTO_DO_CHAT) await rm(caminhoDaFotoDoChat(CONVERSA, foto, largura), { force: true })
  }
  await db.query('DELETE FROM mensagem WHERE conversa_id = ? AND foto IS NOT NULL', [CONVERSA])
  await encerrarSocket()
  servidor.closeAllConnections()
  await db.end()
})

test('a foto vira uma mensagem, chega na hora para o outro lado e só tem os dois tamanhos em WebP', async () => {
  const socket = conectarSocket(origem, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { Cookie: vendedor }, reconnection: false })
  sockets.push(socket)
  await new Promise((ok, falha) => { socket.once('connect', ok); socket.once('connect_error', falha) })
  const chegou = new Promise((ok, falha) => {
    const tempo = setTimeout(() => falha(new Error('nova_mensagem não chegou')), 4000)
    socket.once('nova_mensagem', (dados) => { clearTimeout(tempo); ok(dados) })
  })

  const resposta = await enviarFotos(comprador, [{ dados: fotoJpg }], LEGENDA)
  assert.equal(resposta.status, 201, await resposta.clone().text())
  const { mensagens } = await resposta.json()
  assert.equal(mensagens.length, 1)
  const [mensagem] = mensagens
  assert.equal(mensagem.texto, LEGENDA)
  assert.equal(mensagem.minha, true)
  assert.match(mensagem.foto.pequena, /^\/api\/conversas\/1\/fotos\/[a-f0-9]{32}-480\.webp$/)
  assert.match(mensagem.foto.grande, /^\/api\/conversas\/1\/fotos\/[a-f0-9]{32}-1600\.webp$/)

  const doSocket = await chegou
  assert.equal(doSocket.id, mensagem.id)
  assert.deepEqual(doSocket.foto, mensagem.foto)

  // quem participa baixa a foto, já reduzida e em WebP
  const pequena = await fetch(origem + mensagem.foto.pequena, { headers: { Cookie: vendedor } })
  assert.equal(pequena.status, 200)
  assert.equal(pequena.headers.get('content-type'), 'image/webp')
  assert.match(pequena.headers.get('cache-control'), /private/)
  const medidas = await sharp(Buffer.from(await pequena.arrayBuffer())).metadata()
  assert.equal(medidas.format, 'webp')
  assert.equal(medidas.width, 480)
  assert.equal(medidas.height, 240)

  const grande = await fetch(origem + mensagem.foto.grande, { headers: { Cookie: comprador } })
  assert.equal((await sharp(Buffer.from(await grande.arrayBuffer())).metadata()).width, 1600)
})

test('várias fotos viram uma mensagem cada, e a legenda vai na última', async () => {
  const resposta = await enviarFotos(comprador, [{ dados: fotoJpg }, { dados: fotoJpg }, { dados: fotoJpg }], LEGENDA)
  assert.equal(resposta.status, 201)
  const { mensagens } = await resposta.json()
  assert.equal(mensagens.length, 3)
  assert.deepEqual(mensagens.map((m) => m.texto), ['', '', LEGENDA])
  assert.equal(new Set(mensagens.map((m) => m.foto.pequena)).size, 3)
})

test('foto sem legenda é aceita; a listagem das mensagens e das conversas mostra a foto', async () => {
  const resposta = await enviarFotos(vendedor, [{ dados: fotoJpg }])
  assert.equal(resposta.status, 201)
  const [enviada] = (await resposta.json()).mensagens
  assert.equal(enviada.texto, '')

  const lista = await (await fetch(`${base}/conversas/${CONVERSA}/mensagens`, { headers: { Cookie: comprador } })).json()
  const ultima = lista.mensagens.at(-1)
  assert.equal(ultima.id, enviada.id)
  assert.deepEqual(ultima.foto, enviada.foto)
  assert.equal(lista.mensagens[0].foto, null) // mensagem de texto do seed

  const conversas = await (await fetch(`${base}/conversas`, { headers: { Cookie: comprador } })).json()
  const conversa = conversas.itens.find((c) => c.id === CONVERSA)
  assert.equal(conversa.ultima_mensagem.tem_foto, true)
  assert.equal(conversa.ultima_mensagem.texto, '')
})

test('só quem participa da conversa envia ou vê a foto', async () => {
  const [mensagem] = (await (await enviarFotos(comprador, [{ dados: fotoJpg }])).json()).mensagens

  assert.equal((await fetch(origem + mensagem.foto.pequena)).status, 401) // sem login
  assert.equal((await fetch(origem + mensagem.foto.pequena, { headers: { Cookie: outraPessoa } })).status, 403)
  assert.equal((await enviarFotos(outraPessoa, [{ dados: fotoJpg }])).status, 403)
  assert.equal((await enviarFotos(comprador, [{ dados: fotoJpg }], undefined, 999999)).status, 404)

  // a pasta pública de uploads não entrega as fotos do chat
  const nome = mensagem.foto.pequena.split('/').pop()
  assert.equal((await fetch(`${base}/uploads/conversas/${CONVERSA}/${nome}`)).status, 404)
})

test('nome de arquivo fora do padrão não sai da pasta da conversa', async () => {
  for (const arquivo of ['..%2F..%2F..%2F.env', 'x.webp', `${'a'.repeat(32)}-999.webp`, `${'a'.repeat(32)}-480.webp`]) {
    const r = await fetch(`${base}/conversas/${CONVERSA}/fotos/${arquivo}`, { headers: { Cookie: comprador } })
    assert.equal(r.status, 404, arquivo)
  }
})

test('envio inválido responde 400 e não cria mensagem', async () => {
  const [[antes]] = await db.query('SELECT COUNT(*) AS total FROM mensagem WHERE conversa_id = ?', [CONVERSA])

  const semFoto = await enviarFotos(comprador, [], 'só texto')
  assert.equal(semFoto.status, 400)

  const pdf = await enviarFotos(comprador, [{ dados: Buffer.from('%PDF-1.4'), tipo: 'application/pdf', nome: 'a.pdf' }])
  assert.equal(pdf.status, 400)

  // diz que é JPG, mas o conteúdo não é uma imagem
  const falsa = await enviarFotos(comprador, [{ dados: fotoJpg }, { dados: Buffer.from('isto não é uma foto') }])
  assert.equal(falsa.status, 400)

  const seis = await enviarFotos(comprador, Array.from({ length: 6 }, () => ({ dados: fotoJpg })))
  assert.equal(seis.status, 400)

  const legendaLonga = await enviarFotos(comprador, [{ dados: fotoJpg }], 'a'.repeat(1001))
  assert.equal(legendaLonga.status, 400)

  const [[depois]] = await db.query('SELECT COUNT(*) AS total FROM mensagem WHERE conversa_id = ?', [CONVERSA])
  assert.equal(depois.total, antes.total)
})

test('mensagem de texto continua exigindo texto', async () => {
  const r = await fetch(`${base}/conversas/${CONVERSA}/mensagens`, {
    method: 'POST', headers: { Cookie: comprador, 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: '   ' }),
  })
  assert.equal(r.status, 400)
})
