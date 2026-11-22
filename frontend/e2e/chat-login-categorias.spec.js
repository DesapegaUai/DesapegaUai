// Editar e apagar mensagem no chat (como no WhatsApp), login indo para a tela inicial e anúncios de
// outras cidades na categoria. Conversa 1 do seed: Larissa (2) comprando a air fryer do Diego (1).
import { expect, test } from '@playwright/test'
import { entrarComo, semMapaDaInternet, vigiarErros } from './ajuda.js'

test.describe('Mensagens do chat', () => {
  test('editar e apagar para todos aparecem na hora para a outra pessoa', async ({ browser }) => {
    const daCompradora = await browser.newContext()
    const doVendedor = await browser.newContext()
    const compradora = await daCompradora.newPage()
    const vendedor = await doVendedor.newPage()
    const erros = vigiarErros(compradora)
    await entrarComo(compradora, 2)
    await entrarComo(vendedor, 1)
    await vendedor.goto('/conversas/1')
    await compradora.goto('/conversas/1')

    const texto = `Posso buscar às 9h? ${Date.now()}`
    await compradora.getByRole('textbox').last().fill(texto)
    await compradora.keyboard.press('Enter')
    await expect(vendedor.locator('.msgs').getByText(texto)).toBeVisible()

    // editar: tocar na mensagem, "Editar", mudar o texto e Enter
    await compradora.locator('.linha-msg.eu .bolha').filter({ hasText: texto }).click()
    const menu = compradora.getByRole('menu', { name: 'Opções da mensagem' })
    await expect(menu.getByRole('menuitem')).toHaveText(['Editar', 'Apagar para mim', 'Apagar para todos'])
    await menu.getByRole('menuitem', { name: 'Editar' }).click()
    await expect(compradora.getByText('Editando mensagem')).toBeVisible()
    const editado = texto.replace('9h', '10h')
    await compradora.getByRole('textbox').last().fill(editado)
    await compradora.keyboard.press('Enter')
    const naTelaDoVendedor = vendedor.locator('.bolha').filter({ hasText: editado })
    await expect(naTelaDoVendedor).toBeVisible()
    await expect(naTelaDoVendedor.locator('.editada')).toHaveText('editada')
    await expect(vendedor.getByText(texto, { exact: true })).toHaveCount(0)

    // apagar para todos: some o texto dos dois lados e fica o aviso
    await compradora.locator('.linha-msg.eu .bolha').filter({ hasText: editado }).click()
    await compradora.getByRole('menuitem', { name: 'Apagar para todos' }).click()
    await expect(compradora.locator('.bolha.apagada').last()).toContainText('Você apagou esta mensagem')
    await expect(vendedor.locator('.bolha.apagada').last()).toContainText('Mensagem apagada')
    await expect(vendedor.getByText(editado)).toHaveCount(0)

    expect(erros).toEqual([])
    await daCompradora.close()
    await doVendedor.close()
  })

  test('na mensagem da outra pessoa só aparece "Apagar para mim", e ela some só para quem apagou', async ({ browser }) => {
    const daCompradora = await browser.newContext()
    const doVendedor = await browser.newContext()
    const compradora = await daCompradora.newPage()
    const vendedor = await doVendedor.newPage()
    await entrarComo(compradora, 2)
    await entrarComo(vendedor, 1)
    await vendedor.goto('/conversas/1')
    await compradora.goto('/conversas/1')

    const texto = `Ainda está disponível? ${Date.now()}`
    await compradora.getByRole('textbox').last().fill(texto)
    await compradora.keyboard.press('Enter')
    const bolhaNoVendedor = vendedor.locator('.bolha').filter({ hasText: texto })
    await expect(bolhaNoVendedor).toBeVisible()

    await bolhaNoVendedor.click()
    const menu = vendedor.getByRole('menu', { name: 'Opções da mensagem' })
    await expect(menu.getByRole('menuitem')).toHaveText(['Apagar para mim'])
    await menu.getByRole('menuitem', { name: 'Apagar para mim' }).click()
    await expect(bolhaNoVendedor).toHaveCount(0)
    await vendedor.reload()
    await expect(vendedor.locator('.msgs')).toBeVisible()
    await expect(vendedor.getByText(texto)).toHaveCount(0)
    await expect(compradora.locator('.bolha').filter({ hasText: texto })).toBeVisible()

    await daCompradora.close()
    await doVendedor.close()
  })
})

test.describe('Login', () => {
  test('tela da conta sem login vai para o login; quem já entrou e abre o login vai para a tela inicial', async ({ page }) => {
    await page.goto('/perfil')
    await expect(page).toHaveURL(/\/entrar$/)
    await entrarComo(page, 2)
    await page.goto('/entrar')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Olá, Larissa')).toHaveCount(0)
  })
})

test.describe('Categorias', () => {
  test('anúncios de outras cidades aparecem embaixo dos de perto, com a distância', async ({ page }) => {
    await semMapaDaInternet(page)
    const erros = vigiarErros(page)
    await page.goto('/categoria/casa')
    const secao = page.locator('.outras-cidades')
    await expect(secao.getByRole('heading', { name: 'Em outras cidades da região' })).toBeVisible()
    await expect(secao).toContainText('Ubá')
    await expect(secao).toContainText(/a \d+(,\d)? km/)
    expect(erros).toEqual([])
  })
})
