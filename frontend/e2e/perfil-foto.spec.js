// Foto de perfil: ao escolher a foto, abre o ajuste (arrastar dentro do círculo e aproximar ou afastar) e só
// depois ela é enviada, já recortada do jeito que a pessoa enquadrou.
import { expect, test } from '@playwright/test'
import { entrarComo, FOTO_PNG } from './ajuda.js'

test('escolher a foto abre o ajuste; cancelar não envia nada; aproximar, arrastar e "Usar foto" troca a foto', async ({ page }) => {
  await entrarComo(page, 3)
  await page.request.delete('/api/perfil/foto') // começa sem foto
  await page.goto('/perfil/editar')
  const escolher = page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]')
  const ajuste = page.getByRole('dialog', { name: 'Ajustar foto' })

  // cancelar: a janela fecha e a foto não muda
  await escolher.setInputFiles({ name: 'eu.png', mimeType: 'image/png', buffer: FOTO_PNG })
  await expect(ajuste).toBeVisible()
  await ajuste.getByRole('button', { name: 'Cancelar' }).click()
  await expect(ajuste).toHaveCount(0)
  expect((await (await page.request.get('/api/perfil')).json()).foto_url).toBeNull()

  // ajustar e usar
  await escolher.setInputFiles({ name: 'eu.png', mimeType: 'image/png', buffer: FOTO_PNG })
  await expect(ajuste).toBeVisible()
  await ajuste.getByRole('slider', { name: 'Aproximar ou afastar' }).fill('2.5')
  const quadro = ajuste.getByRole('img', { name: /Foto de perfil/ })
  const caixa = await quadro.boundingBox()
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2)
  await page.mouse.down()
  await page.mouse.move(caixa.x + caixa.width / 2 + 40, caixa.y + caixa.height / 2 + 20, { steps: 5 })
  await page.mouse.up()
  await ajuste.getByRole('button', { name: 'Usar foto' }).click()
  await expect(ajuste).toHaveCount(0)
  await expect(page.getByRole('status').getByText('Foto de perfil atualizada')).toBeVisible()

  const fotoUrl = (await (await page.request.get('/api/perfil')).json()).foto_url
  expect(fotoUrl).toMatch(/^\/api\/uploads\/perfis\/3\/[a-f0-9]{32}\.webp$/)
  await page.request.delete('/api/perfil/foto') // deixa como estava
})

test('em "Meu perfil", clicar na foto abre as opções: "Adicionar imagem" passa pelo ajuste e "Ajustar imagem" reabre a foto atual', async ({ page }) => {
  await entrarComo(page, 3)
  await page.request.delete('/api/perfil/foto') // começa sem foto
  await page.goto('/perfil')
  const opcoes = page.getByRole('dialog', { name: 'Foto do perfil' })
  const ajuste = page.getByRole('dialog', { name: 'Ajustar foto' })
  const fotoAtual = async () => (await (await page.request.get('/api/perfil')).json()).foto_url

  // sem foto, não tem o que ajustar; "Adicionar imagem" abre o ajuste antes de enviar
  await page.locator('.av-trigger').click()
  await expect(opcoes).toBeVisible()
  await expect(opcoes.getByRole('button', { name: 'Ajustar imagem' })).toHaveCount(0)
  const [seletor] = await Promise.all([
    page.waitForEvent('filechooser'),
    opcoes.getByRole('button', { name: 'Adicionar imagem' }).click(),
  ])
  await seletor.setFiles({ name: 'eu.png', mimeType: 'image/png', buffer: FOTO_PNG })
  await expect(opcoes).toHaveCount(0)
  await expect(ajuste).toBeVisible()
  expect(await fotoAtual()).toBeNull() // nada foi enviado ainda
  await ajuste.getByRole('button', { name: 'Usar foto' }).click()
  await expect(ajuste).toHaveCount(0)
  await expect(page.getByRole('status').getByText('Foto de perfil atualizada')).toBeVisible()
  const primeira = await fotoAtual()
  expect(primeira).toMatch(/^\/api\/uploads\/perfis\/3\/[a-f0-9]{32}\.webp$/)

  // com foto: clicar nela e em "Ajustar imagem" abre a foto atual para aproximar e enquadrar de novo
  await page.locator('.av-trigger').click()
  await opcoes.getByRole('button', { name: 'Ajustar imagem' }).click()
  await expect(ajuste).toBeVisible()
  await ajuste.getByRole('slider', { name: 'Aproximar ou afastar' }).fill('2')
  await ajuste.getByRole('button', { name: 'Usar foto' }).click()
  await expect(ajuste).toHaveCount(0)
  await expect.poll(fotoAtual).not.toBe(primeira)
  await page.request.delete('/api/perfil/foto') // deixa como estava
})

test('em "Editar perfil", clicar na foto também abre a escolha da foto', async ({ page }) => {
  await entrarComo(page, 3)
  await page.goto('/perfil/editar')
  const [seletor] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Trocar a foto de perfil' }).click(),
  ])
  await seletor.setFiles({ name: 'eu.png', mimeType: 'image/png', buffer: FOTO_PNG })
  const ajuste = page.getByRole('dialog', { name: 'Ajustar foto' })
  await expect(ajuste).toBeVisible()
  await ajuste.getByRole('button', { name: 'Cancelar' }).click()
  await expect(ajuste).toHaveCount(0)
})
