// Compartilhar anúncio (referência: o compartilhar da OLX), pelos três pontinhos no alto do anúncio: no
// computador abre a escolha entre WhatsApp, Facebook, X e copiar o link; no celular, a janela do próprio aparelho.
import { expect, test } from '@playwright/test'
import { semMapaDaInternet, vigiarErros } from './ajuda.js'

test('compartilhar o anúncio: WhatsApp, Facebook e X levam o link do anúncio, e o link pode ser copiado', async ({ page, browserName }) => {
  const erros = vigiarErros(page)
  await semMapaDaInternet(page)
  // sem a janela de compartilhar do aparelho, o site mostra a escolha das redes
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
  await page.goto('/anuncio/1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Sofá 3 lugares/)

  await page.getByRole('button', { name: 'Mais opções do anúncio' }).click() // os três pontinhos no alto do anúncio
  await page.getByRole('menuitem', { name: 'Compartilhar' }).click()
  const janela = page.getByRole('dialog', { name: 'Compartilhar' })
  await expect(janela).toBeVisible()
  const endereco = encodeURIComponent(new URL('/anuncio/1', page.url()).href)
  await expect(janela.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', new RegExp(`^https://wa\\.me/\\?text=.*${endereco.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  await expect(janela.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', `https://www.facebook.com/sharer/sharer.php?u=${endereco}`)
  await expect(janela.getByRole('link', { name: 'X' })).toHaveAttribute('href', new RegExp(`^https://x\\.com/intent/post\\?text=.*&url=${endereco.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
  await expect(janela.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('target', '_blank')

  // Esc fecha
  await page.keyboard.press('Escape')
  await expect(janela).toHaveCount(0)

  // copiar o link: o aviso confirma (sem permissão da área de transferência, o aviso mostra o link)
  if (browserName === 'chromium') await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Mais opções do anúncio' }).click() // os três pontinhos no alto do anúncio
  await page.getByRole('menuitem', { name: 'Compartilhar' }).click()
  await janela.getByRole('button', { name: 'Copiar link' }).click()
  await expect(page.getByRole('status').getByText(/Link copiado|Não foi possível copiar o link/)).toBeVisible()
  await expect(janela).toHaveCount(0)
  expect(erros).toEqual([])
})
