// O site aberto como app instalado (tela de início do celular) e o que continua igual no navegador.
// O app de verdade é simulado com o Chrome em janela de app (--app), que responde display-mode: standalone
// como o app instalado.
import { chromium, expect, test } from '@playwright/test'
import { entrarComo, semMapaDaInternet } from './ajuda.js'

const TELA_DO_CELULAR = { width: 412, height: 915 }

// a cor das barras do celular que vale agora
const temaDaPagina = (pagina) => pagina.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].find((m) => !m.media || matchMedia(m.media).matches)?.content)

// Abre o Chrome como app no endereço pedido (a janela já nasce nele)
async function abrirApp(base, caminho) {
  const contexto = await chromium.launchPersistentContext('', {
    channel: 'chrome',
    baseURL: base,
    viewport: TELA_DO_CELULAR,
    hasTouch: true,
    args: [`--app=${base}${caminho}`],
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

    // internet lenta: a sessão demora 3 s; a carinha fica viva enquanto isso, com as barras verde-limão
    await contexto.route('**/api/auth/sessao', async (rota) => {
      await new Promise((pronto) => setTimeout(pronto, 3000))
      await rota.continue()
    })
    await pagina.goto('/')
    const tela = pagina.locator('#carregamento')
    await expect(tela).toBeVisible()
    await expect(tela).toHaveAttribute('role', 'status')
    await expect(tela.locator('.cg-sorriso')).toBeVisible()
    expect(await temaDaPagina(pagina)).toBe('#C6FE32')
    await pagina.waitForTimeout(1500) // a carinha já terminou de se desenhar
    await expect(tela).toBeVisible()
    expect(await tela.locator('.cg-pingo').evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
    await expect(tela).toHaveCount(0, { timeout: 5000 })
    expect(await pagina.evaluate(() => window.carregamentoSaiuEm)).toBeGreaterThan(3000)
    expect(await temaDaPagina(pagina)).toBe('#FFFFFF')
    await expect(pagina).toHaveURL(/\/entrar$/) // e quem não entrou cai na tela de entrar

    // internet rápida: mesmo assim a carinha termina de se desenhar (1,35 s) antes de sair
    await contexto.unroute('**/api/auth/sessao')
    await pagina.goto('/entrar')
    await expect(pagina.locator('#carregamento')).toHaveCount(0)
    expect(await pagina.evaluate(() => window.carregamentoSaiuEm)).toBeGreaterThanOrEqual(1350 + 250)
  } finally {
    await contexto.close()
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
