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
