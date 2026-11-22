// Google e prévia de link: cada página sai com o título, a descrição e a foto dela; o robots.txt diz o que o
// Google pode ler; o sitemap.xml lista as páginas e os anúncios ativos; a prévia do anúncio é um JPG 1200 x 630.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import express from 'express'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app: api } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { entregarSite } = await import('../src/site.js')
const { aplicarMetas, metasDaPagina, rotasDoGoogle } = await import('../src/seo.js')

const BASE = 'https://desapegauai.example'
const pasta = await fs.mkdtemp(path.join(os.tmpdir(), 'desapegauai-seo-'))
await fs.writeFile(path.join(pasta, 'index.html'), '<!doctype html><html><head><meta name="description" content="padrão" /><title>DesapegaUai</title></head><body><div id="root"></div></body></html>')

// o site (com as informações de cada página) e a API juntos, como em produção
const app = express()
app.use(rotasDoGoogle({ base: BASE }))
app.use(entregarSite({ pasta, frontendUrl: BASE, metas: { daPagina: metasDaPagina, aplicar: aplicarMetas } }))
app.use(api)
const servidor = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)) })
const origem = `http://127.0.0.1:${servidor.address().port}`
let vendedor, anuncioComFoto

const FOTO = await sharp({ create: { width: 900, height: 700, channels: 3, background: '#3e8b22' } }).jpeg().toBuffer()

before(async () => {
  vendedor = (await fetch(`${origem}/api/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: 3 }) })).headers.getSetCookie()[0].split(';')[0]
  const corpo = new FormData()
  for (const [campo, valor] of Object.entries({ titulo: 'Bicicleta aro 29 do teste', preco: '850', categoria_id: '1', subcategoria_id: '1', bairro_id: '1', condicao: 'usado', forma_entrega: 'retirada', descricao: 'Bicicleta <revisada> & pronta para rodar.' })) corpo.append(campo, valor)
  corpo.append('fotos', new Blob([FOTO], { type: 'image/jpeg' }), 'bike.jpg')
  const r = await fetch(`${origem}/api/anuncios`, { method: 'POST', headers: { Cookie: vendedor }, body: corpo })
  assert.equal(r.status, 201, await r.clone().text())
  anuncioComFoto = (await r.json()).id
})

after(async () => {
  await fetch(`${origem}/api/anuncios/${anuncioComFoto}`, { method: 'DELETE', headers: { Cookie: vendedor } })
  servidor.closeAllConnections()
  await new Promise((fim) => servidor.close(fim))
  await fs.rm(pasta, { recursive: true, force: true })
  await db.end()
})

test('o anúncio chega com título, preço, lugar e foto (Google e prévia do WhatsApp)', async () => {
  const html = await (await fetch(`${origem}/anuncio/${anuncioComFoto}`)).text()
  assert.match(html, /<title>Bicicleta aro 29 do teste por R\$\s850,00 em [^<|]+ \| DesapegaUai<\/title>/)
  assert.match(html, /<meta property="og:title" content="Bicicleta aro 29 do teste por R\$\s850,00 em [^"]+" \/>/)
  assert.ok(html.includes(`<meta property="og:image" content="${BASE}/compartilhar/anuncio/${anuncioComFoto}.jpg" />`))
  assert.ok(html.includes(`<link rel="canonical" href="${BASE}/anuncio/${anuncioComFoto}" />`))
  assert.ok(html.includes('&lt;revisada&gt; &amp; pronta'), 'o texto do anúncio vai escapado, nada vira HTML')
  const produto = JSON.parse(html.match(/<script type="application\/ld\+json">(.+?)<\/script>/)[1])
  assert.equal(produto['@type'], 'Product')
  assert.equal(produto.offers.price, '850.00')
  assert.equal(produto.offers.priceCurrency, 'BRL')
  assert.equal(produto.offers.availability, 'https://schema.org/InStock')
  assert.equal(html.includes('name="robots"'), false)
})

test('a imagem de prévia do anúncio é um JPG 1200 x 630; anúncio sem foto usa a imagem do site', async () => {
  const r = await fetch(`${origem}/compartilhar/anuncio/${anuncioComFoto}.jpg`)
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('content-type'), 'image/jpeg')
  const { width, height } = await sharp(Buffer.from(await r.arrayBuffer())).metadata()
  assert.deepEqual([width, height], [1200, 630])
  const semFoto = await fetch(`${origem}/compartilhar/anuncio/999999.jpg`, { redirect: 'manual' })
  assert.equal(semFoto.status, 302)
  assert.equal(semFoto.headers.get('location'), '/img/compartilhar.jpg')
})

test('categoria e páginas de ajuda têm título próprio; as telas da conta e os perfis ficam fora do Google', async () => {
  assert.match(await (await fetch(`${origem}/categoria/casa`)).text(), /<title>Casa: usados em Viçosa e região \| DesapegaUai<\/title>/)
  assert.match(await (await fetch(`${origem}/ajuda/dicas-de-seguranca`)).text(), /<title>Dicas de segurança \| DesapegaUai<\/title>/)
  for (const caminho of ['/perfil', '/conversas/1', '/favoritos', '/usuario/2', '/anuncio/999999', '/pagina-que-nao-existe']) {
    const html = await (await fetch(origem + caminho)).text()
    assert.ok(html.includes('<meta name="robots" content="noindex" />'), caminho)
    assert.equal(html.includes('rel="canonical"'), false, caminho)
  }
})

test('robots.txt deixa o Google ler o site (menos a conta e a API) e aponta o sitemap', async () => {
  const r = await fetch(`${origem}/robots.txt`)
  assert.equal(r.status, 200)
  const texto = await r.text()
  assert.match(texto, /^User-agent: \*$/m)
  assert.match(texto, /^Disallow: \/api\/$/m)
  assert.match(texto, /^Allow: \/api\/uploads\/anuncios\/$/m)
  assert.match(texto, /^Disallow: \/conversas$/m)
  assert.ok(texto.includes(`Sitemap: ${BASE}/sitemap.xml`))
})

test('sitemap.xml lista a página inicial, as categorias, as páginas de ajuda e os anúncios ativos', async () => {
  const r = await fetch(`${origem}/sitemap.xml`)
  assert.equal(r.status, 200)
  assert.match(r.headers.get('content-type'), /application\/xml/)
  const xml = await r.text()
  assert.ok(xml.includes(`<loc>${BASE}/</loc>`))
  assert.ok(xml.includes(`<loc>${BASE}/categoria/casa</loc>`))
  assert.ok(xml.includes(`<loc>${BASE}/ajuda/como-funciona</loc>`))
  assert.ok(xml.includes(`<loc>${BASE}/anuncio/${anuncioComFoto}</loc>`))
  assert.equal(xml.includes('/perfil'), false)
  const [[rascunho]] = await db.query("SELECT id FROM anuncio WHERE status IN ('rascunho', 'vendido') LIMIT 1")
  if (rascunho) assert.equal(xml.includes(`<loc>${BASE}/anuncio/${rascunho.id}</loc>`), false, 'rascunho e vendido ficam fora')
})
