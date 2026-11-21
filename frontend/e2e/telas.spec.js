// Abre todas as telas (como visitante e logado) e confere que nenhuma dá erro de JavaScript.
import { expect, test } from '@playwright/test'
import { entrarComo, semMapaDaInternet, vigiarErros } from './ajuda.js'

const PUBLICAS = [
  ['/', /Achados perto de você/],
  ['/busca', /Anúncios perto de você/],
  ['/categoria/casa', /Casa/],
  ['/categoria/servicos', /Serviços/],
  ['/mapa', /Mapa de anúncios/],
  ['/anuncio/1', /Sofá 3 lugares/],
  ['/entrar', /Entrar|Bem-vindo|DesapegaUai/i],
  ['/ajuda/politica-de-privacidade', /Privacidade/i],
]

const PRIVADAS = [
  ['/perfil', /Meus anúncios|Perfil/],
  ['/meus-anuncios', /Meus anúncios/],
  ['/favoritos', /Favoritos/],
  ['/conversas', /Conversas/],
  ['/anunciar', /Cadastrar anúncio/],
  ['/anuncios/1/editar', /Editar anúncio/],
  ['/perfil/editar', /perfil/i],
]

test.beforeEach(async ({ page }) => semMapaDaInternet(page))

test('as telas públicas abrem sem erro', async ({ page }) => {
  const erros = vigiarErros(page)
  for (const [rota, texto] of PUBLICAS) {
    await page.goto(rota)
    await expect(page.locator('body')).toContainText(texto)
  }
  expect(erros).toEqual([])
})

test('as telas da conta exigem login e abrem sem erro depois de entrar', async ({ page }) => {
  const erros = vigiarErros(page)
  await page.goto('/meus-anuncios')
  await expect(page).toHaveURL(/\/entrar/)
  await entrarComo(page, 1)
  for (const [rota, texto] of PRIVADAS) {
    await page.goto(rota)
    await expect(page.locator('body')).toContainText(texto)
  }
  expect(erros).toEqual([])
})

test('nenhuma tela mostra dados de exemplo', async ({ page }) => {
  await entrarComo(page, 3)
  for (const rota of ['/', '/perfil', '/conversas', '/favoritos', '/meus-anuncios']) {
    await page.goto(rota)
    await page.waitForLoadState('networkidle')
    const texto = await page.locator('body').innerText()
    for (const ficticio of ['Ana Beatriz', 'Rafael Lima', 'Juliana Prado', 'Carla Bittencourt', 'Lorena Castro', 'anabeatriz']) {
      expect(texto, `${rota} mostra "${ficticio}"`).not.toContain(ficticio)
    }
  }
})
