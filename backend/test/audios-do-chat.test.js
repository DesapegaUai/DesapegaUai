// Áudio no chat: o servidor converte o que cada navegador grava (WebM, OGG, MP4 do iPhone) para M4A,
// mede a duração e desenha as ondas (fala sobe, silêncio fica reto). Também: quem pode ouvir, ouvir em
// pedaços (Range), arquivo que não é áudio, curto ou longo demais, não editar e apagar para todos.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { after, before, test } from 'node:test'
import ffmpeg from 'ffmpeg-static'
import { io as conectarSocket } from 'socket.io-client'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { encerrarSocket, iniciarSocket } = await import('../src/socket.js')
const { caminhoDoAudioDoChat } = await import('../src/utils/fotos.js')
const { desenharOndas, formatoDoAudio } = await import('../src/services/audioDoChat.js')

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
let pasta
const audios = {}
const sockets = []
const rodar = promisify(execFile)

// fala (um tom) por 2 s, silêncio por 2 s e fala mais baixa por 1,5 s: 5,5 s no total
// duracao: em vez da fala, só silêncio por esse tempo
async function gerarAudio(nome, codec, { duracao } = {}) {
  const arquivo = path.join(pasta, nome)
  const entradas = duracao
    ? ['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=mono:d=${duracao}`]
    : ['-f', 'lavfi', '-i', 'sine=frequency=300:duration=2,volume=4', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono:d=2',
        '-f', 'lavfi', '-i', 'sine=frequency=500:duration=1.5,volume=1.5', '-filter_complex', '[0][1][2]concat=n=3:v=0:a=1']
  await rodar(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...entradas, '-ac', '1', '-c:a', codec, '-b:a', '24k', arquivo])
  return readFile(arquivo)
}

async function entrarComo(id) {
  const r = await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })
  return r.headers.get('set-cookie').split(';')[0]
}

function enviarAudio(cookie, dados, { tipo = 'audio/webm', nome = 'audio.webm', campo = 'audio', conversaId = CONVERSA } = {}) {
  const corpo = new FormData()
  corpo.append(campo, new Blob([dados], { type: tipo }), nome)
  return fetch(`${base}/conversas/${conversaId}/audios`, { method: 'POST', headers: { Cookie: cookie }, body: corpo })
}

const existe = (caminho) => access(caminho).then(() => true, () => false)
const arquivoDa = (mensagem) => caminhoDoAudioDoChat(CONVERSA, mensagem.audio.url.split('/').pop())
const nivel = (letra) => parseInt(letra, 32)

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'desapegauai-teste-audio-'))
  audios.webm = await gerarAudio('fala.webm', 'libopus')
  audios.ogg = await gerarAudio('fala.ogg', 'libopus')
  audios.m4a = await gerarAudio('fala.m4a', 'aac')
  audios.curto = await gerarAudio('curto.webm', 'libopus', { duracao: 0.2 })
  audios.longo = await gerarAudio('longo.webm', 'libopus', { duracao: 125 })
  audios.silencio = await gerarAudio('silencio.webm', 'libopus', { duracao: 3 })
  vendedor = await entrarComo(1)
  comprador = await entrarComo(2)
  outraPessoa = await entrarComo(3)
})

after(async () => {
  for (const s of sockets) s.disconnect()
  const [comAudio] = await db.query('SELECT audio FROM mensagem WHERE conversa_id = ? AND audio IS NOT NULL', [CONVERSA])
  for (const { audio } of comAudio) await rm(caminhoDoAudioDoChat(CONVERSA, audio), { force: true })
  await db.query("DELETE FROM mensagem WHERE conversa_id = ? AND (audio IS NOT NULL OR (texto = '' AND foto IS NULL AND video IS NULL))", [CONVERSA])
  await rm(pasta, { recursive: true, force: true })
  await encerrarSocket()
  servidor.closeAllConnections()
  await db.end()
})

test('o formato é reconhecido pelo começo do arquivo, e as ondas ficam retas no silêncio', () => {
  assert.equal(formatoDoAudio(audios.webm), 'webm')
  assert.equal(formatoDoAudio(audios.ogg), 'ogg')
  assert.equal(formatoDoAudio(audios.m4a), 'mp4')
  assert.equal(formatoDoAudio(Buffer.from('não sou um áudio de verdade')), null)
  assert.equal(desenharOndas(Buffer.alloc(16000)), '0'.repeat(40)) // silêncio total: tudo reto
  const alto = Buffer.alloc(16000)
  for (let i = 0; i < 8000; i++) alto.writeInt16LE(i % 2 ? 16000 : -16000, i * 2)
  assert.equal(desenharOndas(alto), 'v'.repeat(40)) // som alto o tempo todo: tudo cheio
})

test('quem conversa manda um áudio gravado no Chrome (WebM) e a outra pessoa recebe na hora, já em M4A', async () => {
  const socket = conectarSocket(origem, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { Cookie: vendedor }, reconnection: false })
  sockets.push(socket)
  await new Promise((ok, falha) => { socket.once('connect', ok); socket.once('connect_error', falha) })
  const chegou = new Promise((ok) => socket.once('nova_mensagem', ok))

  const r = await enviarAudio(comprador, audios.webm)
  assert.equal(r.status, 201, await r.clone().text())
  const { mensagem } = await r.json()
  assert.equal(mensagem.texto, '')
  assert.equal(mensagem.foto, null)
  assert.equal(mensagem.video, null)
  assert.match(mensagem.audio.url, new RegExp(`^/api/conversas/${CONVERSA}/audios/[a-f0-9]{32}\\.m4a$`))
  assert.equal(mensagem.audio.segundos, 6) // 5,5 s medidos pelo servidor (não pelo navegador)

  // as ondas: fala no começo, silêncio no meio (reto) e fala de novo no fim
  const ondas = mensagem.audio.ondas
  assert.match(ondas, /^[0-9a-v]{40}$/)
  assert.ok([...ondas.slice(0, 12)].every((l) => nivel(l) >= 15), `começo deveria ter fala: ${ondas}`)
  assert.ok([...ondas.slice(17, 27)].every((l) => l === '0'), `meio deveria ser reto: ${ondas}`)
  assert.ok([...ondas.slice(31, 40)].every((l) => nivel(l) >= 8), `fim deveria ter fala: ${ondas}`)

  const recebida = await chegou
  assert.equal(recebida.audio.url, mensagem.audio.url)
  assert.equal(recebida.audio.ondas, ondas)

  // o arquivo guardado é M4A de verdade, sem o WebM original
  const gravado = await readFile(arquivoDa(mensagem))
  assert.equal(gravado.toString('latin1', 4, 8), 'ftyp')
  assert.equal(formatoDoAudio(gravado), 'mp4')

  // a lista de conversas mostra que a última mensagem é um áudio, com a duração
  const lista = await (await fetch(`${base}/conversas`, { headers: { Cookie: vendedor } })).json()
  const conversa = (lista.itens ?? lista).find((c) => c.id === CONVERSA)
  assert.equal(conversa.ultima_mensagem.audio_segundos, 6)
  socket.disconnect()
})

test('o áudio do Firefox (OGG) e o do iPhone (MP4) também viram M4A', async () => {
  for (const [dados, tipo, nome] of [[audios.ogg, 'audio/ogg', 'audio.ogg'], [audios.m4a, 'audio/mp4', 'audio.mp4']]) {
    const r = await enviarAudio(comprador, dados, { tipo, nome })
    assert.equal(r.status, 201, `${nome}: ${await r.clone().text()}`)
    const { mensagem } = await r.json()
    assert.match(mensagem.audio.url, /\.m4a$/)
    assert.equal(mensagem.audio.segundos, 6)
    assert.equal(formatoDoAudio(await readFile(arquivoDa(mensagem))), 'mp4')
  }
})

test('áudio só de silêncio é aceito e fica todo reto', async () => {
  const r = await enviarAudio(vendedor, audios.silencio)
  assert.equal(r.status, 201)
  const { mensagem } = await r.json()
  assert.equal(mensagem.audio.segundos, 3)
  assert.equal(mensagem.audio.ondas, '0'.repeat(40))
})

test('o áudio abre só para quem participa, como M4A, e dá para ouvir em pedaços', async () => {
  const { mensagem } = await (await enviarAudio(comprador, audios.webm)).json()
  const url = `${origem}${mensagem.audio.url}`

  const inteiro = await fetch(url, { headers: { Cookie: vendedor } })
  assert.equal(inteiro.status, 200)
  assert.equal(inteiro.headers.get('content-type'), 'audio/mp4')
  assert.match(inteiro.headers.get('cache-control'), /private/)

  const pedaco = await fetch(url, { headers: { Cookie: vendedor, Range: 'bytes=0-99' } })
  assert.equal(pedaco.status, 206)
  assert.equal((await pedaco.arrayBuffer()).byteLength, 100)

  assert.equal((await fetch(url, { headers: { Cookie: outraPessoa } })).status, 403)
  assert.equal((await fetch(url)).status, 401)
  // nome de arquivo inventado ou tentando sair da pasta
  for (const nome of ['..%2F..%2F.env', `${'a'.repeat(32)}.webm`, 'qualquer.m4a']) {
    assert.equal((await fetch(`${base}/conversas/${CONVERSA}/audios/${nome}`, { headers: { Cookie: vendedor } })).status, 404, nome)
  }
})

test('arquivo que não é áudio, curto ou longo demais, sem arquivo ou de quem não participa é recusado', async () => {
  const antes = (await db.query('SELECT COUNT(*) AS n FROM mensagem WHERE conversa_id = ? AND audio IS NOT NULL', [CONVERSA]))[0][0].n

  const texto = await enviarAudio(comprador, Buffer.from('isto é um texto, não um áudio'), { tipo: 'audio/webm' })
  assert.equal(texto.status, 400)
  assert.match((await texto.json()).erro, /não é um áudio/)

  // começo de WebM e o resto lixo: o ffmpeg não consegue ler
  const lixo = await enviarAudio(comprador, Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(4000, 9)]))
  assert.equal(lixo.status, 400)
  assert.match((await lixo.json()).erro, /Não foi possível ler o áudio/)

  const curto = await enviarAudio(comprador, audios.curto)
  assert.equal(curto.status, 400)
  assert.match((await curto.json()).erro, /curto demais/)

  const longo = await enviarAudio(comprador, audios.longo)
  assert.equal(longo.status, 400)
  assert.match((await longo.json()).erro, /2 minutos/)

  const imagem = await enviarAudio(comprador, audios.webm, { tipo: 'image/png', nome: 'foto.png' })
  assert.equal(imagem.status, 400)

  const campoErrado = await enviarAudio(comprador, audios.webm, { campo: 'arquivo' })
  assert.equal(campoErrado.status, 400)

  const grande = await enviarAudio(comprador, Buffer.concat([audios.webm, Buffer.alloc(5 * 1024 * 1024)]))
  assert.equal(grande.status, 400)
  assert.match((await grande.json()).erro, /5 MB/)

  assert.equal((await enviarAudio(outraPessoa, audios.webm)).status, 403)
  assert.equal((await enviarAudio(comprador, audios.webm, { conversaId: 999999 })).status, 404)

  const semLogin = new FormData()
  semLogin.append('audio', new Blob([audios.webm], { type: 'audio/webm' }), 'a.webm')
  assert.equal((await fetch(`${base}/conversas/${CONVERSA}/audios`, { method: 'POST', body: semLogin })).status, 401)

  const depois = (await db.query('SELECT COUNT(*) AS n FROM mensagem WHERE conversa_id = ? AND audio IS NOT NULL', [CONVERSA]))[0][0].n
  assert.equal(depois, antes) // nenhuma recusa deixou mensagem para trás
})

test('áudio não pode ser editado', async () => {
  const { mensagem } = await (await enviarAudio(comprador, audios.webm)).json()
  const r = await fetch(`${base}/conversas/${CONVERSA}/mensagens/${mensagem.id}`, {
    method: 'PATCH', headers: { Cookie: comprador, 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: 'virou texto?' }),
  })
  assert.equal(r.status, 409)
  assert.match((await r.json()).erro, /Áudio não pode ser editado/)
})

test('apagar para todos tira o áudio da conversa e do disco', async () => {
  const { mensagem } = await (await enviarAudio(comprador, audios.webm)).json()
  const caminho = arquivoDa(mensagem)
  assert.ok(await existe(caminho))

  const r = await fetch(`${base}/conversas/${CONVERSA}/mensagens/${mensagem.id}?para=todos`, { method: 'DELETE', headers: { Cookie: comprador } })
  assert.equal(r.status, 200)
  const { mensagem: apagada } = await r.json()
  assert.equal(apagada.apagada, true)
  assert.equal(apagada.audio, null)
  assert.equal(await existe(caminho), false)
  assert.equal((await fetch(`${origem}${mensagem.audio.url}`, { headers: { Cookie: vendedor } })).status, 404)
})

test('quando as duas pessoas apagam só para si, o áudio sai do disco', async () => {
  const { mensagem } = await (await enviarAudio(comprador, audios.webm)).json()
  const caminho = arquivoDa(mensagem)
  for (const cookie of [comprador, vendedor]) {
    const r = await fetch(`${base}/conversas/${CONVERSA}/mensagens/${mensagem.id}?para=mim`, { method: 'DELETE', headers: { Cookie: cookie } })
    assert.equal(r.status, 204)
  }
  assert.equal(await existe(caminho), false)
})
