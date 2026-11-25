// Moderação de conteúdo (sem serviço pago): a IA de imagens (NSFW.js, rodando aqui no servidor) recusa
// nudez e pornografia em foto de anúncio, de perfil, do chat e em vídeo, e deixa passar foto comum e de
// biquíni; as regras de texto recusam armas, drogas, conteúdo sexual e ameaça em todo lugar onde se escreve.
// Nos testes de recusa pela API, o modelo é trocado por um de mentira que diz "pornografia" (não há imagem
// imprópria de verdade nos testes); o modelo de verdade é usado para conferir que foto comum passa.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import caminhoDoFfmpeg from 'ffmpeg-static'
import sharp from 'sharp'
import { io as conectarSocket } from 'socket.io-client'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { encerrarSocket, iniciarSocket } = await import('../src/socket.js')
const { pastaDaConversa } = await import('../src/utils/fotos.js')
const moderacao = await import('../src/services/moderacaoDeImagem.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
iniciarSocket(servidor)
const origem = `http://127.0.0.1:${servidor.address().port}`
const base = `${origem}/api`
const CONVERSA = 1 // do seed: Larissa (2) conversa com o Diego (1) sobre a air fryer
const MARCA = 'Teste da moderação'
let vendedor // Diego (1)
let comprador // Larissa (2)
const sockets = []
const anunciosCriados = []
let bioOriginal = null

// ---------------------------------------------------------------- imagens e vídeos de teste

const previsao = (chances) => Object.entries({ Neutral: 0, Drawing: 0, Sexy: 0, Porn: 0, Hentai: 0, ...chances })
  .map(([className, probability]) => ({ className, probability }))
const PORNOGRAFIA = previsao({ Porn: 0.93, Sexy: 0.05, Neutral: 0.02 })
const BIQUINI = previsao({ Sexy: 0.95, Porn: 0.04, Neutral: 0.01 })

const desenho = (svg, largura = 800, altura = 600) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}">${svg}</svg>`))
const BICICLETA = '<rect width="800" height="600" fill="#EEF6EA"/><g transform="translate(190 80) scale(17.5)" fill="none" stroke="#2F6B19" stroke-width="1.15"><circle cx="5.6" cy="15.6" r="3.6"/><circle cx="18.4" cy="15.6" r="3.6"/><path d="M5.6 15.6 9 9.2h6.6M9 9.2l3 6.4H5.6M12 15.6l3.6-6.4 2.8 6.4"/></g>'
let FOTO // JPEG comum
let FOTOS_COMUNS // várias imagens comuns, de formatos e jeitos diferentes

function videoDeTeste() {
  const arquivo = path.join(os.tmpdir(), `desapegauai-moderacao-${process.pid}.mp4`)
  execFileSync(caminhoDoFfmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=15',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mp4', arquivo])
  const dados = readFileSync(arquivo)
  rmSync(arquivo, { force: true })
  return dados
}
const VIDEO = videoDeTeste()

// ---------------------------------------------------------------- API

async function entrarComo(id) {
  const r = await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })
  return r.headers.get('set-cookie').split(';')[0]
}
async function chamar(metodo, caminho, { cookie, json, form } = {}) {
  const r = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) },
    body: json ? JSON.stringify(json) : form,
  })
  const texto = await r.text()
  return { status: r.status, dados: texto ? JSON.parse(texto) : null }
}
function formulario(campos, arquivos = []) {
  const form = new FormData()
  for (const [chave, valor] of Object.entries(campos)) form.append(chave, String(valor))
  for (const { campo, dados, tipo = 'image/jpeg', nome = 'foto.jpg' } of arquivos) form.append(campo, new Blob([dados], { type: tipo }), nome)
  return form
}
const CAMPOS_DO_ANUNCIO = { titulo: `${MARCA}: bicicleta`, preco: 300, categoria_id: 1, subcategoria_id: 1, bairro_id: 1, condicao: 'usado', forma_entrega: 'retirada' }
const contarMensagens = async () => (await db.query('SELECT COUNT(*) AS n FROM mensagem WHERE conversa_id = ?', [CONVERSA]))[0][0].n
const contarAnuncios = async () => (await db.query('SELECT COUNT(*) AS n FROM anuncio WHERE usuario_id = 1'))[0][0].n
const arquivosDaConversa = async () => (await readdir(pastaDaConversa(CONVERSA)).catch(() => [])).length
function recusou(resposta, campo, trecho) {
  assert.equal(resposta.status, 422, JSON.stringify(resposta.dados))
  assert.equal(resposta.dados.codigo, 'CONTEUDO_PROIBIDO')
  assert.deepEqual(resposta.dados.campos, [campo])
  if (trecho) assert.match(resposta.dados.erro, trecho)
}

before(async () => {
  vendedor = await entrarComo(1)
  comprador = await entrarComo(2)
  ;[[{ bio: bioOriginal }]] = await db.query('SELECT bio FROM usuario WHERE id = 2')
  FOTO = await desenho(BICICLETA).jpeg().toBuffer()
  FOTOS_COMUNS = {
    'desenho de produto (JPEG)': FOTO,
    'cor lisa verde (PNG)': await sharp({ create: { width: 640, height: 480, channels: 3, background: '#3E8B22' } }).png().toBuffer(),
    'cor de pele lisa': await sharp({ create: { width: 640, height: 480, channels: 3, background: '#E0AC8A' } }).jpeg().toBuffer(),
    'degradê (WebP)': await desenho('<defs><linearGradient id="g"><stop offset="0" stop-color="#F4E1C1"/><stop offset="1" stop-color="#8B5A2B"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/>').webp().toBuffer(),
    'preto e branco (1 canal)': await desenho(BICICLETA).greyscale().toColourspace('b-w').png().toBuffer(),
    'fundo transparente (PNG com alfa)': await desenho('<circle cx="400" cy="300" r="200" fill="#C0392B"/>').png().toBuffer(),
    'minúscula (1x1)': await sharp({ create: { width: 1, height: 1, channels: 3, background: '#FFFFFF' } }).png().toBuffer(),
    'grande (4000x3000)': await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#D9E4F5' } }).jpeg().toBuffer(),
    'de celular deitada (EXIF 6)': await desenho(BICICLETA).jpeg().withMetadata({ orientation: 6 }).toBuffer(),
  }
})

after(async () => {
  moderacao.trocarClassificadorParaTestes(null)
  for (const s of sockets) s.disconnect()
  for (const id of anunciosCriados) await chamar('DELETE', `/anuncios/${id}`, { cookie: vendedor })
  await db.query('DELETE FROM mensagem WHERE conversa_id = ? AND texto LIKE ?', [CONVERSA, `${MARCA}%`])
  await db.query('DELETE FROM mensagem_programada WHERE conversa_id = ?', [CONVERSA])
  await db.query('UPDATE usuario SET bio = ? WHERE id = 2', [bioOriginal])
  await moderacao.desligarModeracao()
  await encerrarSocket()
  servidor.closeAllConnections()
  await db.end()
})

// ---------------------------------------------------------------- a decisão

test('a decisão: nudez e pornografia (Porn + Hentai a partir de 70%) recusam; biquíni (Sexy) passa', () => {
  assert.equal(moderacao.fotoRecusada(PORNOGRAFIA), true)
  assert.equal(moderacao.fotoRecusada(previsao({ Porn: 0.65, Hentai: 0.06 })), true) // juntos passam de 70%
  assert.equal(moderacao.fotoRecusada(previsao({ Hentai: 0.8 })), true)
  assert.equal(moderacao.fotoRecusada(previsao({ Porn: 0.69, Sexy: 0.31 })), false)
  assert.equal(moderacao.fotoRecusada(BIQUINI), false)
  assert.equal(moderacao.fotoRecusada(previsao({ Neutral: 0.99 })), false)
  // vídeo: um quadro bem claro (85%) ou dois quadros acima de 70%
  assert.equal(moderacao.videoRecusado([previsao({ Neutral: 1 }), previsao({ Porn: 0.86 })]), true)
  assert.equal(moderacao.videoRecusado([previsao({ Porn: 0.75 }), previsao({ Neutral: 1 }), previsao({ Neutral: 1 })]), false)
  assert.equal(moderacao.videoRecusado([previsao({ Porn: 0.72 }), previsao({ Porn: 0.71 })]), true)
  assert.equal(moderacao.videoRecusado([BIQUINI, BIQUINI, BIQUINI]), false)
})

// ---------------------------------------------------------------- o modelo de verdade

test('com o modelo de verdade, fotos comuns passam (formatos, preto e branco, transparente, minúscula, grande e deitada)', async () => {
  moderacao.trocarClassificadorParaTestes(null)
  for (const [nome, imagem] of Object.entries(FOTOS_COMUNS)) {
    const pixels = await moderacao.pixelsDaFoto(imagem)
    assert.equal(pixels.length, 224 * 224 * 3, nome)
    const inicio = Date.now()
    await assert.doesNotReject(moderacao.exigirFotoPermitida(imagem), nome)
    assert.ok(Date.now() - inicio < 15_000, `${nome} demorou ${Date.now() - inicio} ms`)
  }
  assert.equal(moderacao.estadoDaModeracao(), 'ligada')
})

test('com o modelo de verdade, um vídeo comum passa; os quadros saem espalhados pelo vídeo; vídeo que não abre é recusado', async () => {
  moderacao.trocarClassificadorParaTestes(null)
  const arquivo = path.join(os.tmpdir(), `desapegauai-moderacao-quadros-${process.pid}.mp4`)
  const falso = path.join(os.tmpdir(), `desapegauai-moderacao-falso-${process.pid}.mp4`)
  try {
    await import('node:fs/promises').then(({ writeFile }) => Promise.all([
      writeFile(arquivo, VIDEO),
      writeFile(falso, Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom', 'latin1'), Buffer.alloc(4096, 7)])),
    ]))
    const quadros = await moderacao.quadrosDoVideo(arquivo)
    assert.ok(quadros.length >= 6 && quadros.length <= moderacao.QUADROS_DO_VIDEO, `${quadros.length} quadros`)
    for (const quadro of quadros) assert.equal(quadro.length, 224 * 224 * 3)
    await assert.doesNotReject(moderacao.exigirVideoPermitido(arquivo))
    await assert.rejects(moderacao.exigirVideoPermitido(falso), (erro) => erro.status === 400 && /Não foi possível abrir o vídeo/.test(erro.message))
  } finally {
    rmSync(arquivo, { force: true })
    rmSync(falso, { force: true })
  }
})

test('vídeo com quadro maior que 4K não é decodificado (usaria memória demais) e é recusado (400)', async () => {
  const arquivo = path.join(os.tmpdir(), `desapegauai-moderacao-8k-${process.pid}.mp4`)
  try {
    execFileSync(caminhoDoFfmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:size=7680x4320:rate=1:duration=2',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-f', 'mp4', arquivo])
    assert.deepEqual(await moderacao.quadrosDoVideo(arquivo), [])
    await assert.rejects(moderacao.exigirVideoPermitido(arquivo), (erro) => erro.status === 400)
  } finally {
    rmSync(arquivo, { force: true })
  }
})

test('as mensagens dizem qual foto foi, que biquíni pode, e se a análise falhar a foto não entra (503)', async () => {
  moderacao.trocarClassificadorParaTestes(() => PORNOGRAFIA)
  await assert.rejects(moderacao.exigirFotoPermitida(FOTO), (erro) => {
    assert.equal(erro.status, 422)
    assert.equal(erro.message, 'A foto foi recusada: a IA do DesapegaUai encontrou nudez ou conteúdo sexual, que não são permitidos. Fotos de roupa de banho, como biquíni e maiô, podem.')
    return true
  })
  await assert.rejects(moderacao.exigirFotoPermitida(FOTO, { posicao: 2, total: 3 }), /^Error: A 2ª foto foi recusada/)
  await assert.rejects(moderacao.exigirFotoPermitida(FOTO, { onde: 'perfil' }), (erro) => /^A foto de perfil foi recusada/.test(erro.message) && erro.campos[0] === 'foto')
  moderacao.trocarClassificadorParaTestes(() => BIQUINI)
  await assert.doesNotReject(moderacao.exigirFotoPermitida(FOTO))
  moderacao.trocarClassificadorParaTestes(() => { throw new Error('modelo fora do ar') })
  await assert.rejects(moderacao.exigirFotoPermitida(FOTO), (erro) => erro.status === 503 && /Tente de novo/.test(erro.message))
  await assert.rejects(moderacao.exigirFotoPermitida(Buffer.from('não é imagem')), (erro) => erro.status === 400)
  moderacao.trocarClassificadorParaTestes(null)
})

// ---------------------------------------------------------------- pela API: fotos e vídeo

test('foto imprópria no anúncio, no chat e no perfil é recusada (422) e nada é gravado', async () => {
  moderacao.trocarClassificadorParaTestes(() => PORNOGRAFIA)
  try {
    const anunciosAntes = await contarAnuncios()
    const anuncio = await chamar('POST', '/anuncios', { cookie: vendedor, form: formulario(CAMPOS_DO_ANUNCIO, [{ campo: 'fotos', dados: FOTO }, { campo: 'fotos', dados: FOTO }]) })
    recusou(anuncio, 'fotos', /^A 1ª foto foi recusada/)
    assert.equal(await contarAnuncios(), anunciosAntes)

    const mensagensAntes = await contarMensagens()
    const arquivosAntes = await arquivosDaConversa()
    const fotoNoChat = await chamar('POST', `/conversas/${CONVERSA}/fotos`, { cookie: comprador, form: formulario({ texto: `${MARCA}: foto` }, [{ campo: 'fotos', dados: FOTO }]) })
    recusou(fotoNoChat, 'fotos', /^A foto foi recusada/)
    assert.equal(await contarMensagens(), mensagensAntes)
    assert.equal(await arquivosDaConversa(), arquivosAntes)

    const [[antes]] = await db.query('SELECT foto_url FROM usuario WHERE id = 2')
    const fotoDePerfil = await chamar('PUT', '/perfil/foto', { cookie: comprador, form: formulario({}, [{ campo: 'foto', dados: FOTO }]) })
    recusou(fotoDePerfil, 'foto', /^A foto de perfil foi recusada/)
    const [[depois]] = await db.query('SELECT foto_url FROM usuario WHERE id = 2')
    assert.equal(depois.foto_url, antes.foto_url)
  } finally {
    moderacao.trocarClassificadorParaTestes(null)
  }
})

test('vídeo impróprio no chat é recusado (422): não vira mensagem e o arquivo sai do disco', async () => {
  moderacao.trocarClassificadorParaTestes(() => PORNOGRAFIA)
  try {
    const mensagensAntes = await contarMensagens()
    const arquivosAntes = await arquivosDaConversa()
    const r = await chamar('POST', `/conversas/${CONVERSA}/videos`, { cookie: comprador, form: formulario({}, [{ campo: 'video', dados: VIDEO, tipo: 'video/mp4', nome: 'video.mp4' }]) })
    recusou(r, 'video', /^O vídeo foi recusado: a IA do DesapegaUai encontrou nudez ou conteúdo sexual, que não são permitidos\.$/)
    assert.equal(await contarMensagens(), mensagensAntes)
    assert.equal(await arquivosDaConversa(), arquivosAntes)
  } finally {
    moderacao.trocarClassificadorParaTestes(null)
  }
})

test('foto de biquíni passa: o anúncio é publicado', async () => {
  moderacao.trocarClassificadorParaTestes(() => BIQUINI)
  try {
    const r = await chamar('POST', '/anuncios', { cookie: vendedor, form: formulario({ ...CAMPOS_DO_ANUNCIO, titulo: `${MARCA}: biquíni cortininha` }, [{ campo: 'fotos', dados: FOTO }]) })
    assert.equal(r.status, 201, JSON.stringify(r.dados))
    anunciosCriados.push(r.dados.id)
  } finally {
    moderacao.trocarClassificadorParaTestes(null)
  }
})

// ---------------------------------------------------------------- pela API: textos

test('texto proibido é recusado (422) em todo lugar onde se escreve, dizendo o que revisar', async () => {
  const anunciosAntes = await contarAnuncios()
  const anuncio = await chamar('POST', '/anuncios', { cookie: vendedor, form: formulario({ ...CAMPOS_DO_ANUNCIO, descricao: 'Acompanha munição calibre 12' }, [{ campo: 'fotos', dados: FOTO }]) })
  recusou(anuncio, 'descricao', /armas de fogo, munição.*Revise a descrição\.$/)
  recusou(await chamar('POST', '/anuncios', { cookie: vendedor, form: formulario({ titulo: 'Maconha prensada', status: 'rascunho' }) }), 'titulo', /drogas/)
  assert.equal(await contarAnuncios(), anunciosAntes)

  const mensagensAntes = await contarMensagens()
  recusou(await chamar('POST', `/conversas/${CONVERSA}/mensagens`, { cookie: comprador, json: { texto: 'Vou te matar' } }), 'texto', /Ameaça ou violência/)
  recusou(await chamar('POST', `/conversas/${CONVERSA}/fotos`, { cookie: comprador, form: formulario({ texto: 'vendo nudes' }, [{ campo: 'fotos', dados: FOTO }]) }), 'legenda', /sexual/)
  recusou(await chamar('POST', `/conversas/${CONVERSA}/videos`, { cookie: comprador, form: formulario({ texto: 'vendo nudes' }, [{ campo: 'video', dados: VIDEO, tipo: 'video/mp4', nome: 'v.mp4' }]) }), 'legenda', /sexual/)
  assert.equal(await contarMensagens(), mensagensAntes)

  // editar para um texto proibido: recusa e a mensagem continua como era
  const enviada = await chamar('POST', `/conversas/${CONVERSA}/mensagens`, { cookie: comprador, json: { texto: `${MARCA}: tudo certo` } })
  assert.equal(enviada.status, 201)
  recusou(await chamar('PATCH', `/conversas/${CONVERSA}/mensagens/${enviada.dados.mensagem.id}`, { cookie: comprador, json: { texto: 'te mato' } }), 'texto')
  const [[mensagem]] = await db.query('SELECT texto FROM mensagem WHERE id = ?', [enviada.dados.mensagem.id])
  assert.equal(mensagem.texto, `${MARCA}: tudo certo`)

  const daqui1h = new Date(Date.now() + 3600 * 1000).toISOString()
  recusou(await chamar('POST', `/conversas/${CONVERSA}/programadas`, { cookie: comprador, json: { texto: 'você vai levar uma surra', enviar_em: daqui1h } }), 'texto')
  recusou(await chamar('POST', '/procuras', { cookie: comprador, json: { titulo: 'Procuro pistola 9mm Taurus', bairro_id: 1 } }), 'titulo', /armas/)
  recusou(await chamar('POST', '/lista-compras', { cookie: comprador, json: { texto: 'munição' } }), 'texto', /armas/)
  recusou(await chamar('PUT', '/perfil', { cookie: comprador, json: { bio: 'Vendo lança-perfume' } }), 'bio', /drogas.*Revise a bio\.$/)

  // o que pode continua passando
  assert.equal((await chamar('PUT', '/perfil', { cookie: comprador, json: { bio: 'Teste da moderação: vendo biquíni e pistola de cola quente' } })).status, 200)
})

test('pelo Socket.IO a mensagem proibida também é recusada', async () => {
  const socket = conectarSocket(origem, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { Cookie: comprador }, reconnection: false })
  sockets.push(socket)
  await new Promise((ok, falha) => { socket.once('connect', ok); socket.once('connect_error', falha) })
  const mensagensAntes = await contarMensagens()
  const resposta = await new Promise((ok) => socket.emit('enviar_mensagem', { conversa_id: CONVERSA, texto: 'te dou um tiro' }, ok))
  assert.equal(resposta.ok, false)
  assert.match(resposta.erro, /Ameaça ou violência/)
  assert.equal(await contarMensagens(), mensagensAntes)
})

test('programada que virou proibida antes de sair é descartada, sem enviar', async () => {
  const { processarVencidas } = await import('../src/services/mensagemProgramadaService.js')
  const mensagensAntes = await contarMensagens()
  // grava direto no banco, como se tivesse sido programada antes da regra existir
  await db.query('INSERT INTO mensagem_programada (conversa_id, remetente_id, texto, enviar_em) VALUES (?, 2, ?, UTC_TIMESTAMP() - INTERVAL 1 MINUTE)', [CONVERSA, 'vou te matar'])
  await processarVencidas()
  const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM mensagem_programada WHERE conversa_id = ? AND texto = 'vou te matar'", [CONVERSA])
  assert.equal(n, 0)
  assert.equal(await contarMensagens(), mensagensAntes)
})
