// Foto ou vídeo do chat que nenhuma das duas pessoas vê mais sai do disco, para não ocupar espaço:
// as duas apagaram "para mim", ou as duas excluíram a conversa (ou uma apagou e a outra excluiu).
// Enquanto uma das duas ainda vê, o arquivo fica.
// Usa uma conversa só do teste: o Usuário Teste (3) chama o Diego (1) no anúncio 1 (sofá).
import assert from 'node:assert/strict'
import { access, rm } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { caminhoDaFotoDoChat, caminhoDoVideoDoChat, LARGURAS_FOTO_DO_CHAT, pastaDaConversa } = await import('../src/utils/fotos.js')

const servidor = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)) })
const base = `http://127.0.0.1:${servidor.address().port}/api`
let diego, teste, conversa, foto
const VIDEO_MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom', 'latin1'), Buffer.alloc(12), Buffer.alloc(4096, 7)])

const entrar = async (id) => (await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })).headers.getSetCookie()[0].split(';')[0]
const existe = (caminho) => access(caminho).then(() => true, () => false)
const apagar = (cookie, caminho) => fetch(base + caminho, { method: 'DELETE', headers: { Cookie: cookie } })
// o banco guarda a hora em segundos: o que chega no mesmo segundo da exclusão conta como de antes dela
const virarOSegundo = () => new Promise((ok) => { setTimeout(ok, 1100) })

async function mandarFoto() {
  const corpo = new FormData()
  corpo.append('fotos', new Blob([foto], { type: 'image/jpeg' }), 'foto.jpg')
  const { mensagens } = await (await fetch(`${base}/conversas/${conversa}/fotos`, { method: 'POST', headers: { Cookie: teste }, body: corpo })).json()
  const nome = mensagens[0].foto.pequena.split('/').pop().split('-')[0]
  return { id: mensagens[0].id, arquivos: LARGURAS_FOTO_DO_CHAT.map((largura) => caminhoDaFotoDoChat(conversa, nome, largura)) }
}

async function mandarVideo() {
  const corpo = new FormData()
  corpo.append('video', new Blob([VIDEO_MP4], { type: 'video/mp4' }), 'video.mp4')
  const { mensagem } = await (await fetch(`${base}/conversas/${conversa}/videos`, { method: 'POST', headers: { Cookie: teste }, body: corpo })).json()
  return { id: mensagem.id, arquivo: caminhoDoVideoDoChat(conversa, mensagem.video.url.split('/').pop()) }
}

before(async () => {
  diego = await entrar(1)
  teste = await entrar(3)
  foto = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#3e8b22' } }).jpeg().toBuffer()
  const r = await fetch(`${base}/conversas`, { method: 'POST', headers: { Cookie: teste, 'Content-Type': 'application/json' }, body: JSON.stringify({ anuncio_id: 1 }) })
  conversa = (await r.json()).conversa.id
})

after(async () => {
  await db.query('DELETE FROM conversa WHERE id = ?', [conversa])
  await rm(pastaDaConversa(conversa), { recursive: true, force: true })
  servidor.close(); servidor.closeAllConnections(); await db.end()
})

test('foto apagada "para mim" pelas duas pessoas sai do disco; enquanto só uma apagou, fica', async () => {
  const { id, arquivos } = await mandarFoto()
  assert.equal((await apagar(teste, `/conversas/${conversa}/mensagens/${id}?para=mim`)).status, 204)
  for (const arquivo of arquivos) assert.ok(await existe(arquivo), 'o Diego ainda vê a foto')

  assert.equal((await apagar(diego, `/conversas/${conversa}/mensagens/${id}?para=mim`)).status, 204)
  for (const arquivo of arquivos) assert.equal(await existe(arquivo), false, 'ninguém vê mais: o arquivo sai')
  const [[linha]] = await db.query('SELECT foto, video, apagada_em FROM mensagem WHERE id = ?', [id])
  assert.equal(linha.foto, null)
  assert.ok(linha.apagada_em)
})

test('vídeo de uma conversa excluída pelas duas pessoas sai do disco; o que chega depois fica', async () => {
  const antes = await mandarVideo()
  assert.equal((await apagar(diego, `/conversas/${conversa}`)).status, 204)
  assert.ok(await existe(antes.arquivo), 'o Usuário Teste ainda vê o vídeo')

  assert.equal((await apagar(teste, `/conversas/${conversa}`)).status, 204)
  assert.equal(await existe(antes.arquivo), false, 'as duas excluíram: o vídeo sai')
  await virarOSegundo()

  // a conversa volta com mensagem nova; o vídeo novo é visto e fica
  const depois = await mandarVideo()
  assert.equal((await apagar(diego, `/conversas/${conversa}/mensagens/${depois.id}?para=mim`)).status, 204)
  assert.ok(await existe(depois.arquivo), 'o Usuário Teste ainda vê o vídeo novo')
})

test('uma apagou "para mim" e a outra excluiu a conversa: ninguém vê, o arquivo sai', async () => {
  await virarOSegundo()
  const { id, arquivo } = await mandarVideo()
  assert.equal((await apagar(teste, `/conversas/${conversa}/mensagens/${id}?para=mim`)).status, 204)
  assert.ok(await existe(arquivo))
  assert.equal((await apagar(diego, `/conversas/${conversa}`)).status, 204)
  assert.equal(await existe(arquivo), false)
})
