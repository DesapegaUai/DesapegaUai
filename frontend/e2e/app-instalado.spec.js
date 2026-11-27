// O site aberto como app instalado (tela de início do celular) e o que continua igual no navegador.
// O app de verdade é simulado com o Chrome em janela de app (--app), que responde display-mode: standalone
// como o app instalado.
import { chromium, expect, test } from '@playwright/test'
import { entrarComo, semMapaDaInternet } from './ajuda.js'

const TELA_DO_CELULAR = { width: 412, height: 915 }

// a cor das barras do celular que vale agora
const temaDaPagina = (pagina) => pagina.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].find((m) => !m.media || matchMedia(m.media).matches)?.content)

// centro de peso da parte escura (a carinha) numa imagem, em % da largura/altura a partir do meio
const pesoForaDoMeio = (pagina, url) => pagina.evaluate(async (url) => {
  const imagem = new Image()
  imagem.src = url
  await imagem.decode()
  const tela = Object.assign(document.createElement('canvas'), { width: imagem.width, height: imagem.height })
  const desenho = tela.getContext('2d')
  desenho.drawImage(imagem, 0, 0)
  const pontos = desenho.getImageData(0, 0, tela.width, tela.height).data
  let somaX = 0, somaY = 0, soma = 0
  for (let y = 0; y < tela.height; y++) {
    for (let x = 0; x < tela.width; x++) {
      const k = (y * tela.width + x) * 4
      const peso = (pontos[k + 3] / 255) * Math.max(0, Math.min(1, (120 - (pontos[k] + pontos[k + 1] + pontos[k + 2]) / 3) / 70))
      somaX += peso * (x + 0.5)
      somaY += peso * (y + 0.5)
      soma += peso
    }
  }
  return { x: (somaX / soma / tela.width - 0.5) * 100, y: (somaY / soma / tela.height - 0.5) * 100 }
}, url)

const CELULAR_ANDROID = 'Mozilla/5.0 (Linux; Android 14; moto g84 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'

// Abre o Chrome como app no endereço pedido (a janela já nasce nele)
async function abrirApp(base, caminho, opcoes = {}) {
  const contexto = await chromium.launchPersistentContext('', {
    channel: 'chrome',
    baseURL: base,
    viewport: TELA_DO_CELULAR,
    hasTouch: true,
    args: [`--app=${base}${caminho}`],
    ...opcoes,
  })
  await contexto.route(/tile\.openstreetmap\.org/, (rota) => rota.fulfill({ status: 204, body: '' }))
  const pagina = contexto.pages()[0] ?? await contexto.waitForEvent('page')
  return { contexto, pagina }
}

test('no app, quem não está logado abre na tela de entrar e pode continuar sem entrar', async ({ baseURL }) => {
  const { contexto, pagina } = await abrirApp(baseURL, '/')
  try {
    await expect(pagina).toHaveURL(/\/entrar$/)
    expect(await pagina.evaluate(() => matchMedia('(display-mode: standalone)').matches)).toBe(true)
    await expect(pagina.locator('html')).toHaveClass(/modo-app/)

    await pagina.getByRole('button', { name: 'Continuar sem entrar' }).click()
    await expect(pagina).toHaveURL(/\/$/)
    // a escolha vale até fechar o app: recarregar não volta para a tela de entrar
    await pagina.reload()
    await expect(pagina.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(pagina).toHaveURL(/\/$/)

    // barras do celular brancas no app quando a carinha sai (a regra do theme-color com display-mode: standalone vale aqui)
    await expect(pagina.locator('#carregamento')).toHaveCount(0)
    expect(await temaDaPagina(pagina)).toBe('#FFFFFF')
  } finally {
    await contexto.close()
  }
})

test('no app, a carinha se desenha no verde-limão e só sai depois de pronta e de o site saber quem entrou', async ({ baseURL }) => {
  const { contexto, pagina } = await abrirApp(baseURL, '/api/saude')
  try {
    // anota quando a tela de carregamento sai (em ms desde que a página começou a abrir)
    await pagina.addInitScript(() => {
      let viu = false
      window.carregamentoSaiuEm = null
      new MutationObserver(() => {
        if (document.getElementById('carregamento')) viu = true
        else if (viu && window.carregamentoSaiuEm === null) window.carregamentoSaiuEm = performance.now()
      }).observe(document, { childList: true, subtree: true })
    })

    // quanto tempo a carinha ficou na tela: da primeira pintura da página até sair
    const tempoNaTela = () => pagina.evaluate(() => window.carregamentoSaiuEm - performance.getEntriesByName('first-paint')[0].startTime)

    // internet lenta: a sessão demora 3,5 s; a carinha termina de se desenhar e fica viva, com as barras verde-limão
    await contexto.route('**/api/auth/sessao', async (rota) => {
      await new Promise((pronto) => setTimeout(pronto, 3500))
      await rota.continue()
    })
    await pagina.goto('/')
    const tela = pagina.locator('#carregamento')
    await expect(tela).toBeVisible()
    await expect(tela).toHaveAttribute('role', 'status')
    await expect(tela.locator('.cg-sorriso')).toBeVisible()
    expect(await temaDaPagina(pagina)).toBe('#FFFFFF') // barras brancas também durante a carinha
    await pagina.waitForTimeout(2300) // a carinha já terminou de se desenhar (2,1 s)
    await expect(tela).toBeVisible()
    expect(await tela.locator('.cg-b3').evaluate((el) => getComputedStyle(el).opacity)).not.toBe('0')
    await expect(tela).toHaveCount(0, { timeout: 5000 })
    expect(await pagina.evaluate(() => window.carregamentoSaiuEm)).toBeGreaterThan(3500)
    expect(await temaDaPagina(pagina)).toBe('#FFFFFF')
    await expect(pagina).toHaveURL(/\/entrar$/) // e quem não entrou cai na tela de entrar
    await contexto.unroute('**/api/auth/sessao')

    // internet rápida: mesmo assim a carinha se desenha inteira (2,1 s) antes de sair
    await pagina.goto('/entrar')
    await expect(pagina.locator('#carregamento')).toHaveCount(0, { timeout: 5000 })
    expect(await tempoNaTela()).toBeGreaterThanOrEqual(2090 + 250 - 60)

    // o caso do vídeo: no app do Android a abertura do sistema fica na frente enquanto a página baixa.
    // A página demora 2,5 s para aparecer e a sessão vem logo depois: a carinha não pode só piscar,
    // os 2,1 s contam de quando ela aparece
    await contexto.route('**/src/styles/carregamento.css', async (rota) => {
      await new Promise((pronto) => setTimeout(pronto, 2500))
      await rota.continue()
    })
    await pagina.goto('/entrar')
    await expect(pagina.locator('#carregamento')).toHaveCount(0, { timeout: 10000 })
    expect(await pagina.evaluate(() => performance.getEntriesByName('first-paint')[0].startTime)).toBeGreaterThan(2400)
    expect(await tempoNaTela()).toBeGreaterThanOrEqual(2090 + 250 - 60)
  } finally {
    await contexto.close()
  }
})

test('no Android, ao abrir o app a carinha já começa pronta e no meio (continua a abertura do Android) e ganha vida; recarregando, abre direto, sem a carinha', async ({ baseURL }) => {
  const { contexto, pagina } = await abrirApp(baseURL, '/api/saude', { userAgent: CELULAR_ANDROID })
  try {
    await pagina.addInitScript(() => {
      // as barras do celular da Rhayane (medidas no vídeo): 52 px em cima e 26 px embaixo
      Object.defineProperty(screen, 'height', { get: () => innerHeight + 78 })
      let viu = false
      window.carregamentoSaiuEm = null
      new MutationObserver(() => {
        if (document.getElementById('carregamento')) viu = true
        else if (viu && window.carregamentoSaiuEm === null) window.carregamentoSaiuEm = performance.now()
      }).observe(document, { childList: true, subtree: true })
    })
    await pagina.goto('/')
    const tela = pagina.locator('#carregamento')
    await expect(pagina.locator('html')).toHaveClass(/carinha-pronta/)
    await expect(tela).toBeVisible()
    // verde-limão liso (o mesmo fundo da abertura do Android) e a carinha inteira: nenhuma peça se desenhando
    expect(await tela.evaluate((el) => el.getAnimations({ subtree: true }).map((a) => a.animationName)
      .filter((nome) => ['cg-desenhar', 'cg-surgir', 'cg-cair'].includes(nome)))).toEqual([])
    // parada no começo da animação "viva", para fotografar
    await pagina.evaluate(() => document.getAnimations().forEach((animacao) => { animacao.pause(); animacao.currentTime = 0 }))
    expect(await tela.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none')
    expect(await tela.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(198, 254, 50)')
    for (const peca of ['.cg-u', '.cg-haste', '.cg-sorriso']) expect(await tela.locator(peca).evaluate((el) => parseFloat(getComputedStyle(el).strokeDashoffset))).toBe(0)
    for (const peca of ['.cg-a', '.cg-pingo', '.cg-b1', '.cg-b3']) expect(await tela.locator(peca).evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
    // a carinha não fica torta: o peso dela está no meio na largura; na altura, sobe 13 px para ficar onde o
    // Android desenha a dele (no meio da tela inteira, contando as barras)
    expect(await pagina.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--carinha-sobe').trim())).toBe('13.0px')
    const foto = await pagina.screenshot()
    const fora = await pesoForaDoMeio(pagina, `data:image/png;base64,${foto.toString('base64')}`)
    expect(Math.abs(fora.x)).toBeLessThan(1)
    expect(Math.abs((fora.y / 100) * TELA_DO_CELULAR.height + 13)).toBeLessThan(2)
    await pagina.evaluate(() => document.getAnimations().forEach((animacao) => animacao.play()))

    // fica até a carinha sorrir uma vez (1,7 s), mesmo com o site já pronto
    await expect(tela).toHaveCount(0, { timeout: 6000 })
    // (folga: a animação começa um pouco antes da primeira pintura que o navegador anota)
    expect(await pagina.evaluate(() => window.carregamentoSaiuEm - performance.getEntriesByName('first-paint')[0].startTime)).toBeGreaterThanOrEqual(1700 + 250 - 150)

    // recarregar (puxar a tela para baixo) não é abrir o app: abre direto, sem a tela de carregamento
    await pagina.reload({ waitUntil: 'commit' })
    await expect(pagina.locator('html')).toHaveClass(/sem-carregamento/)
    await expect(pagina.locator('html')).not.toHaveClass(/carinha-pronta/)
    expect(await pagina.evaluate(() => {
      const tela = document.getElementById('carregamento')
      return tela ? getComputedStyle(tela).display : 'já saiu'
    })).toMatch(/^(none|já saiu)$/)
    await expect(pagina.getByRole('heading', { level: 1 }).first()).toBeVisible() // o site aparece direto
  } finally {
    await contexto.close()
  }
})

test('os ícones do app existem e a carinha deles está no meio (não fica torta)', async ({ page }) => {
  await page.goto('/api/saude')
  const manifest = await (await page.request.get('/site.webmanifest')).json()
  expect(manifest.background_color).toBe('#C6FE32')
  // a barra de baixo do Android pega o theme_color: verde ali vira uma faixa durante todo o uso do app
  expect(manifest.theme_color).toBe('#FFFFFF')
  for (const icone of manifest.icons) {
    const resposta = await page.request.get(icone.src)
    expect(resposta.ok(), icone.src).toBeTruthy()
    expect(resposta.headers()['content-type'], icone.src).toContain('image/png')
  }
  const maskable = manifest.icons.find((icone) => icone.purpose === 'maskable')?.src
  expect(maskable).toBeTruthy()
  // ícone do Android: beirada transparente (a abertura do Android desenhava uma linha na beira) e o miolo,
  // que é o que aparece na tela inicial, opaco
  const transparencia = await page.evaluate(async (url) => {
    const imagem = new Image()
    imagem.src = url
    await imagem.decode()
    const tela = Object.assign(document.createElement('canvas'), { width: 512, height: 512 })
    const desenho = tela.getContext('2d')
    desenho.drawImage(imagem, 0, 0, 512, 512)
    const alfa = (x, y) => desenho.getImageData(x, y, 1, 1).data[3]
    const recorteDaAbertura = Math.round(256 - 256 * 0.874) // a abertura mostra o miolo de 87,4%
    const telaInicial = Math.round(256 - 256 * 0.8) // a tela inicial mostra o miolo de uns 80%
    return { canto: alfa(2, 2), recorte: [alfa(recorteDaAbertura, 256), alfa(256, recorteDaAbertura)], telaInicial: [alfa(telaInicial, 256), alfa(256, 511 - telaInicial), alfa(telaInicial, telaInicial)], meio: alfa(256, 256) }
  }, maskable)
  expect(transparencia).toEqual({ canto: 0, recorte: [0, 0], telaInicial: [255, 255, 255], meio: 255 })
  for (const icone of [maskable, '/apple-touch-icon.png', '/icone-app-512.png', '/icon-512.png']) {
    const fora = await pesoForaDoMeio(page, icone)
    expect(Math.abs(fora.x), `${icone}: peso fora do meio na horizontal`).toBeLessThan(1)
    expect(Math.abs(fora.y), `${icone}: peso fora do meio na vertical`).toBeLessThan(1)
  }
})

test('no app, quem já está logado entra direto, sem passar pela tela de entrar', async ({ baseURL }) => {
  const { contexto, pagina } = await abrirApp(baseURL, '/api/saude')
  try {
    const login = await contexto.request.post('/api/auth/teste', { data: { usuario_id: 2 } })
    expect(login.ok()).toBeTruthy()
    const sessao = pagina.waitForResponse((r) => r.url().includes('/api/auth/sessao'))
    await pagina.goto('/')
    expect((await (await sessao).json()).usuario?.id).toBe(2)
    await pagina.waitForTimeout(300) // dá tempo de a porta do app agir, se fosse agir
    await expect(pagina).toHaveURL(/\/$/)
  } finally {
    await contexto.close()
  }
})

test('no app, a aba de acessibilidade começa recolhida na borda e abre ao tocar na alça', async ({ baseURL }) => {
  const { contexto, pagina } = await abrirApp(baseURL, '/api/saude')
  try {
    await contexto.request.post('/api/auth/teste', { data: { usuario_id: 2 } })
    await pagina.goto('/busca')
    await expect(pagina.locator('#carregamento')).toHaveCount(0) // enquanto a carinha está na tela, nada embaixo recebe o toque
    const alca =pagina.getByRole('button', { name: 'Mostrar os botões de acessibilidade e Libras' })
    const menu = pagina.getByRole('button', { name: 'Acessibilidade', exact: true })
    await expect(alca).toBeVisible()
    await expect(menu).toBeHidden()

    // alça fina, mas com área de toque de pelo menos 24 x 24 (o toque um pouco à esquerda dela ainda acerta)
    const caixa = await alca.boundingBox()
    expect(caixa.width).toBeLessThanOrEqual(18)
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(TELA_DO_CELULAR.width + 1)
    const acerta = await pagina.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.acs-alca') !== null, [caixa.x - 8, caixa.y + caixa.height / 2])
    expect(acerta).toBe(true)

    await alca.click()
    await expect(menu).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Traduzir para Libras com o VLibras' })).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Esconder os botões de acessibilidade' })).toHaveAttribute('aria-expanded', 'true')

    // o menu continua funcionando; Esc fecha e o foco volta para o botão
    await menu.click()
    const painel = pagina.getByRole('dialog', { name: 'Acessibilidade' })
    await expect(painel).toBeVisible()
    await pagina.keyboard.press('Escape')
    await expect(painel).toBeHidden()
    await expect(menu).toBeFocused()

    // tocar fora recolhe a aba (o toque vai num ponto vazio da página, sem link embaixo)
    await pagina.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    await expect(menu).toBeHidden()
    await expect(alca).toBeVisible()
  } finally {
    await contexto.close()
  }
})

test('no navegador continua como antes: botões inteiros, sem alça e sem ir para a tela de entrar', async ({ page }) => {
  await semMapaDaInternet(page)
  await page.setViewportSize(TELA_DO_CELULAR)
  await page.goto('/')
  await expect(page.locator('#carregamento')).toBeHidden() // a carinha de carregamento é só do app
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('html')).not.toHaveClass(/modo-app/)
  await expect(page.getByRole('button', { name: 'Acessibilidade', exact: true })).toBeVisible()
  await expect(page.locator('.acs-alca')).toBeHidden()
  await page.goto('/entrar')
  await expect(page.getByRole('button', { name: 'Continuar sem entrar' })).toHaveCount(0)
  expect(await temaDaPagina(page)).toBe('#3E8B22')
})

test('o "+ Anunciar" flutuante fica só na busca, nas categorias e em todos os anúncios', async ({ page }) => {
  await semMapaDaInternet(page)
  await page.setViewportSize(TELA_DO_CELULAR)
  await entrarComo(page, 2)
  for (const caminho of ['/busca', '/categoria/casa', '/anuncios']) {
    await page.goto(caminho)
    await expect(page.locator('a.fab'), caminho).toBeVisible()
  }
  for (const caminho of ['/favoritos', '/comparar', '/mapa', '/conversas']) {
    await page.goto(caminho)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('a.fab'), caminho).toHaveCount(0)
  }
})

test('o nome do produto no topo da conversa fica numa linha só, com reticências', async ({ page }) => {
  await semMapaDaInternet(page)
  await page.setViewportSize(TELA_DO_CELULAR)
  await entrarComo(page, 2)
  await page.goto('/conversas/1')
  const titulo = page.locator('.conv-anuncio .t').first()
  await expect(titulo).toBeVisible()
  expect(await titulo.evaluate((el) => {
    const estilo = getComputedStyle(el)
    return [estilo.whiteSpace, estilo.overflow, estilo.textOverflow]
  })).toEqual(['nowrap', 'hidden', 'ellipsis'])
})
