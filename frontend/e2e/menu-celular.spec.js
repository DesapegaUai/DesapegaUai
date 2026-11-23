// Celular e tablet (opção B com a caixa A): o sininho e as mensagens ficam no alto, com o número de novos
// em tempo real; favoritos, conta, cidade, categorias e Anunciar descem do ☰. No computador nada muda.
import { expect, test } from '@playwright/test'
import { entrarComo, semMapaDaInternet } from './ajuda.js'

test('no celular, o ☰ abre o menu que desce: cartão da pessoa, atalhos, cidade, categorias e Anunciar', async ({ page }) => {
  await semMapaDaInternet(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await entrarComo(page, 2)

  for (const caminho of ['/', '/busca', '/perfil']) {
    await page.goto(caminho)
    // no alto: Início, o sininho, as mensagens e o ☰ (favoritos, conta e Anunciar ficam no menu)
    await expect(page.getByRole('banner').getByRole('button', { name: /^Notificações/ })).toBeVisible()
    await expect(page.getByRole('banner').getByRole('link', { name: 'Mensagens' }).or(page.getByRole('banner').getByRole('button', { name: 'Mensagens' }))).toBeVisible()
    await expect(page.getByRole('banner').getByRole('link', { name: 'Favoritos' })).toBeHidden()
    const menu = page.getByRole('button', { name: 'Abrir menu', exact: true })
    await menu.click()
    const caixa = page.locator('#menu-que-desce')
    await expect(caixa).toBeVisible()
    await expect(caixa.getByRole('link', { name: /Larissa/ })).toBeVisible()
    for (const atalho of ['Início', 'Anúncios', 'Meus anúncios', 'Favoritos', 'Procura-se', 'Anunciar']) await expect(caixa.getByRole('link', { name: atalho, exact: atalho !== 'Anunciar' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await page.keyboard.press('Escape')
    await expect(caixa).toHaveCount(0)
  }

  // categoria pela etiqueta: vai para a página e o menu fecha
  await page.goto('/busca')
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
  await page.locator('#menu-que-desce').getByRole('link', { name: 'Moda' }).click()
  await expect(page).toHaveURL(/\/categoria\/moda/)
  await expect(page.locator('#menu-que-desce')).toHaveCount(0)
})

test('sem login, o cartão do menu convida a entrar', async ({ page }) => {
  await semMapaDaInternet(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/busca')
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
  const caixa = page.locator('#menu-que-desce')
  await caixa.getByRole('link', { name: /Entre na sua conta/ }).click()
  await expect(page).toHaveURL(/\/entrar/)
})

test('o número de conversas novas aparece no ícone de mensagens do celular na hora em que a mensagem chega', async ({ page, browser }) => {
  await semMapaDaInternet(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await entrarComo(page, 2)
  await page.goto('/busca')
  const mensagens = page.getByRole('banner').getByRole('link', { name: /^Mensagens/ })
  await expect(mensagens).toBeVisible()
  const selo = mensagens.locator('.selo-msg')
  const antes = (await selo.count()) ? Number(await selo.locator('[aria-hidden]').textContent()) || 0 : 0

  const doDiego = await browser.newContext()
  const diego = await doDiego.newPage()
  await entrarComo(diego, 1)
  // o Diego escreve na conversa 1, em que a Larissa é a compradora (dados de exemplo)
  expect((await diego.request.post('/api/conversas/1/mensagens', { data: { texto: `Oi! ${Date.now()}` } })).status()).toBe(201)

  await expect(selo).toBeVisible({ timeout: 15_000 })
  await expect.poll(async () => Number(await selo.locator('[aria-hidden]').textContent())).toBeGreaterThanOrEqual(Math.max(antes, 1))
  await doDiego.close()
})

test('no computador o cabeçalho continua com todos os atalhos e sem o ☰', async ({ page }) => {
  await semMapaDaInternet(page)
  await page.setViewportSize({ width: 1366, height: 800 })
  await entrarComo(page, 2)
  await page.goto('/busca')
  await expect(page.getByRole('button', { name: 'Abrir menu', exact: true })).toBeHidden()
  for (const atalho of ['Favoritos', 'Mensagens', 'Perfil']) await expect(page.getByRole('banner').getByRole('link', { name: new RegExp(`^${atalho}`) })).toBeVisible()
})
