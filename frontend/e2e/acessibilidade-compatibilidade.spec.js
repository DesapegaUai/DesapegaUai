// Botões de acessibilidade (menu e VLibras). Roda no Chrome, no Edge, no celular e no tablet
// (veja os projetos no playwright.config.js).
import { expect, test } from '@playwright/test'
import { semMapaDaInternet, vigiarErros } from './ajuda.js'

// o VLibras vem da internet: nos testes, um VLibras de mentira só anota que foi aberto
const VLIBRAS_DE_MENTIRA = `
  window.VLibras = { Widget: function (opcoes) {
    window.__vlibras = { opcoes: opcoes, aberto: false }
    window.VLibrasWidget = { open: function () { window.__vlibras.aberto = true } }
  } }`

const dentroDaTela = async (page, caixa) => {
  const tela = page.viewportSize()
  return caixa.x >= 0 && caixa.y >= 0 && caixa.x + caixa.width <= tela.width + 1 && caixa.y + caixa.height <= tela.height + 1
}
const rolagemLateral = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test.beforeEach(async ({ page }) => {
  await semMapaDaInternet(page)
  await page.route(/vlibras\.gov\.br\/app\/vlibras-plugin\.js/, (rota) =>
    rota.fulfill({ status: 200, contentType: 'application/javascript', body: VLIBRAS_DE_MENTIRA }))
})

test('os botões de acessibilidade aparecem inteiros e o menu funciona', async ({ page }) => {
  const erros = vigiarErros(page)
  await page.goto('/')
  const menu = page.getByRole('button', { name: 'Acessibilidade' })
  const libras = page.getByRole('button', { name: 'Traduzir para Libras com o VLibras' })
  await expect(menu).toBeVisible()
  await expect(libras).toBeVisible()
  expect(await dentroDaTela(page, await page.locator('.acs-aba').boundingBox())).toBe(true)

  await menu.click()
  const painel = page.getByRole('dialog', { name: 'Acessibilidade' })
  await expect(painel).toBeVisible()
  expect(await dentroDaTela(page, await painel.boundingBox())).toBe(true)

  // texto no maior tamanho que a tela aguenta, sem rolagem para o lado
  const aumentar = page.getByRole('button', { name: 'Aumentar o texto' })
  while (await aumentar.isEnabled()) await aumentar.click()
  expect(await rolagemLateral(page)).toBeLessThanOrEqual(0)

  await page.getByRole('button', { name: /Alto contraste/ }).click()
  await expect(page.locator('html')).toHaveClass(/alto-contraste/)
  await page.getByRole('button', { name: /Pausar animações/ }).click()
  await expect(page.locator('html')).toHaveClass(/sem-animacao/)

  await page.keyboard.press('Escape')
  await expect(painel).toBeHidden()
  await expect(menu).toBeFocused()

  // a escolha continua depois de recarregar a página
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/alto-contraste/)

  await menu.click()
  await page.getByRole('button', { name: 'Voltar ao padrão' }).click()
  await expect(page.locator('html')).not.toHaveClass(/alto-contraste|sem-animacao/)
  expect(await page.evaluate(() => document.getElementById('root').style.zoom)).toBe('')
  expect(erros).toEqual([])
})

test('o botão de Libras abre o VLibras', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Traduzir para Libras com o VLibras' }).click()
  await expect.poll(() => page.evaluate(() => window.__vlibras?.aberto)).toBe(true)
  expect(await page.evaluate(() => window.__vlibras.opcoes.rootPath)).toBe('https://vlibras.gov.br/app')
})
