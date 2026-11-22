// Em produção a API entrega o site (frontend/dist). Aqui o teste usa uma pasta temporária no lugar.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, describe, test } from 'node:test'
import express from 'express'
import { entregarSite } from '../src/site.js'

const pasta = await fs.mkdtemp(path.join(os.tmpdir(), 'desapegauai-site-'))
await fs.mkdir(path.join(pasta, 'assets'))
await fs.writeFile(path.join(pasta, 'index.html'), '<!doctype html><title>DesapegaUai</title>')
await fs.writeFile(path.join(pasta, 'assets', 'index-abc123.js'), 'console.log(1)')
await fs.writeFile(path.join(pasta, 'sw.js'), '// service worker')

const app = express()
app.use(entregarSite({ pasta, frontendUrl: 'https://desapegauai.example' }))
app.use((req, res) => res.status(404).json({ codigo: 'ROTA_NAO_ENCONTRADA' }))

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const base = `http://127.0.0.1:${servidor.address().port}`

after(async () => {
  await new Promise((fim) => servidor.close(fim))
  await fs.rm(pasta, { recursive: true, force: true })
})

describe('site entregue pela API', () => {
  test('a página inicial e as telas do React Router recebem o index.html', async () => {
    for (const caminho of ['/', '/anuncio/12', '/conversas/3?aba=1', '/tela-que-nao-existe']) {
      const resposta = await fetch(base + caminho)
      assert.equal(resposta.status, 200, caminho)
      assert.match(resposta.headers.get('content-type'), /text\/html/, caminho)
      assert.equal(resposta.headers.get('cache-control'), 'no-cache', caminho)
      assert.match(await resposta.text(), /DesapegaUai/, caminho)
    }
  })

  test('as telas liberam o login do Google, o mapa e o tempo real', async () => {
    const resposta = await fetch(base + '/entrar')
    const politica = resposta.headers.get('content-security-policy')
    assert.match(politica, /script-src 'self' https:\/\/accounts\.google\.com\/gsi\/client/)
    assert.match(politica, /img-src [^;]*https:\/\/tile\.openstreetmap\.org/)
    assert.match(politica, /connect-src [^;]*wss:\/\/desapegauai\.example/)
    assert.match(politica, /frame-ancestors 'none'/)
    assert.equal(resposta.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups')
    assert.equal(resposta.headers.get('referrer-policy'), 'strict-origin-when-cross-origin')
  })

  test('arquivo de assets/ pode ficar guardado; o service worker não', async () => {
    const script = await fetch(base + '/assets/index-abc123.js')
    assert.equal(script.status, 200)
    assert.match(script.headers.get('cache-control'), /immutable/)

    const sw = await fetch(base + '/sw.js')
    assert.equal(sw.status, 200)
    assert.equal(sw.headers.get('cache-control'), 'no-cache')
  })

  test('arquivo que não existe é 404, e não a página inicial', async () => {
    const resposta = await fetch(base + '/img/nada.png')
    assert.equal(resposta.status, 404)
  })

  test('não entrega arquivo de fora da pasta do site', async () => {
    const resposta = await fetch(base + '/..%2F..%2Fpackage.json')
    assert.notEqual(resposta.status, 200)
  })

  test('a API e os pedidos que alteram dados passam direto', async () => {
    const daApi = await fetch(base + '/api/saude')
    assert.equal(daApi.status, 404)
    assert.equal((await daApi.json()).codigo, 'ROTA_NAO_ENCONTRADA')
    assert.equal(daApi.headers.get('cross-origin-opener-policy'), null)

    const post = await fetch(base + '/', { method: 'POST' })
    assert.equal(post.status, 404)
  })

  test('sem o build do site, não entrega nada (API sozinha)', () => {
    assert.equal(entregarSite({ pasta: path.join(pasta, 'nao-existe') }), null)
  })
})
