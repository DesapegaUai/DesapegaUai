// O que a notificação do celular recebe do service worker (public/sw.js), no padrão dos apps grandes:
// a carinha do Uai em silhueta no lugar do sino, a imagem do próprio aviso à direita e a foto grande quando a
// pessoa puxa a notificação para baixo. Imagem que não carrega vira a logo do app (antes o Android mostrava
// um "D" cinza). O sw.js é carregado numa página comum e a função que monta a notificação é chamada direto.
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/api/saude')
  await page.addScriptTag({ url: '/sw.js' })
})

const montar = (page, dados) => page.evaluate((d) => montarNotificacao(d), dados) // eslint-disable-line no-undef

test('anúncio: título curto, carinha no lugar do sino, foto pequena à direita e grande ao puxar para baixo', async ({ page }) => {
  const { titulo, opcoes } = await montar(page, {
    titulo: 'Novo anúncio',
    texto: 'Cadeira de escritório · R$ 6.450,00 · Bela Vista',
    url: '/anuncio/7',
    icone: '/icone-app-192.png', // no lugar da foto do anúncio: uma imagem que existe
    imagem: '/icone-app-512.png',
    tag: 'anuncio-7',
  })
  expect(titulo).toBe('Novo anúncio')
  expect(opcoes.body).toBe('Cadeira de escritório · R$ 6.450,00 · Bela Vista')
  expect(opcoes.badge).toBe('/icone-notificacao-96.png')
  expect(opcoes.icon).toMatch(/^data:image\/png;base64,/) // já baixada: nunca fica quebrada
  expect(opcoes.image).toMatch(/^data:image\/png;base64,/)
  expect(opcoes.data).toEqual({ url: '/anuncio/7' })
  expect(opcoes.tag).toBe('anuncio-7')
})

test('imagem que não carrega vira a logo do app (nunca o "D" cinza) e a foto grande some', async ({ page }) => {
  const { opcoes } = await montar(page, { titulo: 'Novo anúncio', icone: '/api/uploads/anuncios/999999/nao-existe-400.webp', imagem: '/api/uploads/anuncios/999999/nao-existe-800.webp' })
  expect(opcoes.icon).toBe('/apple-touch-icon.png')
  expect(opcoes.image).toBeUndefined()
  expect(opcoes.badge).toBe('/icone-notificacao-96.png')
})

test('mensagem de quem não tem foto: as iniciais, como no perfil', async ({ page }) => {
  const { titulo, opcoes } = await montar(page, { titulo: 'Larissa Andrade', texto: 'Ainda está disponível?', icone: null, iniciais: 'LA', tag: 'conversa-1' })
  expect(titulo).toBe('Larissa Andrade')
  expect(opcoes.icon).toMatch(/^data:image\/png;base64,/)
  expect(opcoes.image).toBeUndefined()
  expect(opcoes.renotify).toBe(true)
})

test('a carinha da notificação é branca e sem fundo (o Android usa só o desenho e pinta do jeito dele)', async ({ page }) => {
  const resposta = await page.request.get('/icone-notificacao-96.png')
  expect(resposta.ok()).toBeTruthy()
  expect(resposta.headers()['content-type']).toContain('image/png')
  const pontos = await page.evaluate(async () => {
    const imagem = new Image()
    imagem.src = '/icone-notificacao-96.png'
    await imagem.decode()
    const tela = Object.assign(document.createElement('canvas'), { width: 96, height: 96 })
    const desenho = tela.getContext('2d')
    desenho.drawImage(imagem, 0, 0)
    const d = desenho.getImageData(0, 0, 96, 96).data
    let opacos = 0
    let brancos = 0
    for (let k = 0; k < d.length; k += 4) {
      if (d[k + 3] > 200) {
        opacos++
        if (d[k] > 240 && d[k + 1] > 240 && d[k + 2] > 240) brancos++
      }
    }
    return { canto: d[3], opacos, brancos, larguraTotal: imagem.naturalWidth }
  })
  expect(pontos.larguraTotal).toBe(96)
  expect(pontos.canto).toBe(0)
  expect(pontos.opacos).toBeGreaterThan(1000) // tem desenho
  expect(pontos.brancos).toBe(pontos.opacos) // e ele é todo branco
})
