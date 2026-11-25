// Moderação de conteúdo no site (IA própria, sem serviço pago): o que não pode na plataforma é recusado com
// uma mensagem que diz o porquê e o que revisar, no lugar certo (anúncio, chat, mensagem programada,
// Procura-se e lista de compras). Corrigiu, passa. O que parece mas pode (pistola de cola, biquíni) passa.
// As recusas de foto e vídeo são conferidas nos testes da API (test/moderacao.test.js).
import { expect, test } from '@playwright/test'
import { FOTO_PNG, entrarComo, semMapaDaInternet, vigiarErros } from './ajuda.js'

// a recusa vem da API como 422: o navegador registra isso no console, e é o esperado aqui
const semRecusa = (erros) => erros.filter((erro) => !/status of 422/.test(erro))

test.describe('Moderação de conteúdo', () => {
  test.use({ geolocation: { latitude: -20.757104, longitude: -42.875465, accuracy: 12 }, permissions: ['geolocation'] })

  test('anúncio com munição na descrição: a mensagem aparece embaixo da descrição; corrigiu, publica', async ({ page }) => {
    const erros = vigiarErros(page)
    await semMapaDaInternet(page)
    await entrarComo(page, 3)
    await page.goto('/anunciar')
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: FOTO_PNG })
    const titulo = `Kit de acampamento do teste ${Date.now()}`
    await page.getByLabel('Título do anúncio').fill(titulo)
    await page.getByLabel('Categoria').selectOption('casa')
    await page.getByLabel('Condição do produto').selectOption('Usado')
    await page.getByLabel('Preço').fill('80')
    await page.locator('#cad-descricao').fill('Acompanha munição calibre 12')
    await page.getByRole('button', { name: 'Usar minha localização atual' }).click()
    await expect(page.getByLabel('Bairro ou localidade')).not.toHaveValue('')
    await page.getByText('Cabe em carro de app').click()

    await page.getByRole('button', { name: 'Publicar anúncio' }).click()
    await expect(page.locator('#cad-descricao-erro')).toHaveText(/armas de fogo, munição.*Revise a descrição\.$/)
    await expect(page.locator('#cad-descricao')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('.toast-area').filter({ hasText: 'Não foi possível salvar.' })).toBeVisible()
    await expect(page).toHaveURL(/\/anunciar/)
    expect((await (await page.request.get('/api/meus-anuncios')).json()).some((a) => a.titulo === titulo)).toBe(false)

    await page.locator('#cad-descricao').fill('Barraca para 4 pessoas, lanterna e pistola de cola quente')
    await expect(page.locator('#cad-descricao-erro')).toHaveCount(0)
    await page.getByRole('button', { name: 'Publicar anúncio' }).click()
    await expect(page).toHaveURL(/\/meus-anuncios/)
    const publicado = (await (await page.request.get('/api/meus-anuncios')).json()).find((a) => a.titulo === titulo)
    expect(publicado).toBeTruthy()
    await page.request.delete(`/api/anuncios/${publicado.id}`)
    expect(semRecusa(erros)).toEqual([])
  })

  test('no chat, ameaça não sai: o aviso explica e o texto fica no campo para corrigir; a programada também é recusada', async ({ page }) => {
    const erros = vigiarErros(page)
    await entrarComo(page, 2)
    await page.goto('/conversas/1')
    const campo = page.locator('#campo-mensagem')
    const enviar = page.locator('.campo-msg').getByRole('button', { name: 'Enviar mensagem' })

    await campo.fill('vou te matar')
    await enviar.click()
    await expect(page.locator('.toast-area').filter({ hasText: 'Mensagem não enviada' })).toContainText('Ameaça ou violência contra alguém não é permitida')
    await expect(campo).toHaveValue('vou te matar')
    await expect(page.locator('.msgs .bolha').filter({ hasText: 'vou te matar' })).toHaveCount(0)

    // programar o mesmo texto: a janela mostra o motivo e continua aberta
    await enviar.click({ button: 'right' })
    const janela = page.getByRole('dialog', { name: 'Programar mensagem' })
    await janela.locator('.pm-enviar').click()
    await expect(janela.locator('.pm-erro')).toContainText('Ameaça ou violência')
    await expect(janela).toBeVisible()
    await page.keyboard.press('Escape')
    expect((await (await page.request.get('/api/conversas/1/programadas')).json()).programadas).toEqual([])

    // o que pode continua saindo
    const texto = `Passo aí às 10h com a pistola de cola ${Date.now()}`
    await campo.fill(texto)
    await enviar.click()
    await expect(page.locator('.msgs .bolha').filter({ hasText: texto })).toHaveCount(1)
    expect(semRecusa(erros)).toEqual([])
  })

  test('Procura-se e lista de compras recusam o que não pode, com a mensagem embaixo do campo', async ({ page }) => {
    const erros = vigiarErros(page)
    await semMapaDaInternet(page)
    await entrarComo(page, 2)

    await page.goto('/procura-se')
    await page.getByLabel('O que você procura?').fill('Procuro pistola 9mm Taurus')
    await expect(page.getByLabel('Bairro ou localidade').locator('option')).not.toHaveCount(1)
    await page.getByLabel('Bairro ou localidade').selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Publicar pedido' }).click()
    await expect(page.locator('.cad-erro[role="alert"]')).toContainText('armas de fogo')
    await expect(page.locator('.pro-item').filter({ hasText: 'pistola 9mm' })).toHaveCount(0)

    for (const item of (await (await page.request.get('/api/lista-compras')).json()).itens) await page.request.delete(`/api/lista-compras/${item.id}`)
    await page.goto('/favoritos?aba=lista')
    const campo = page.getByRole('textbox', { name: 'O que você quer encontrar?' })
    await campo.fill('munição')
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.locator('#lc-erro')).toContainText('armas de fogo, munição')
    await expect(page.locator('.lc-item')).toHaveCount(0)
    expect(semRecusa(erros)).toEqual([])
  })
})
