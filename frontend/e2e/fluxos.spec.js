// Fluxos completos, como uma pessoa usando o DesapegaUai (comprador e vendedor ao mesmo tempo).
import { expect, test } from '@playwright/test'
import { CENTRO_VICOSA, FOTO_PNG, criarAnuncioPelaApi, entrarComo, negarGps, semMapaDaInternet, vigiarErros } from './ajuda.js'

// anúncios de perto: a primeira grade da busca (embaixo dela fica a seção "Em outras cidades da região")
const dePerto = (page) => page.locator('.bus-grade').first()
const distancias = async (page) => (await dePerto(page).locator('.card-distancia').allInnerTexts())
  .map((texto) => (texto.includes('menos de') ? 0 : Number(texto.replace(/[^\d,]/g, '').replace(',', '.'))))

test.describe('Comprador procurando anúncios próximos', () => {
  test.use({ geolocation: CENTRO_VICOSA, permissions: ['geolocation'] })

  test('entra, autoriza a localização, escolhe 5 km e vê só os anúncios dentro do raio', async ({ page }) => {
    const erros = vigiarErros(page)
    await semMapaDaInternet(page)
    await entrarComo(page, 2)
    await page.goto('/busca')

    await page.getByRole('button', { name: 'Usar minha localização' }).first().click()
    await expect(page.locator('.raio-ref b')).toContainText('Perto de você')
    await page.getByRole('radio', { name: '5 km', exact: true }).click()
    await expect(page.locator('.raio-ref i')).toContainText('em até 5 km')

    await expect(dePerto(page).locator('.card').first()).toBeVisible()
    const kms = await distancias(page)
    expect(kms.length).toBeGreaterThan(0)
    for (const km of kms) expect(km).toBeLessThanOrEqual(5)
    expect(kms).toEqual([...kms].sort((a, b) => a - b))
    // a bicicleta está em Ponte Nova, a 37 km: não entra nos de perto, aparece embaixo, em outras cidades
    await expect(dePerto(page)).not.toContainText('Bicicleta aro 29')
    await expect(page.locator('.outras-cidades')).toContainText('Bicicleta aro 29')
    expect(erros).toEqual([])
  })

  test('muda o raio de 5 para 10 km e depois para 50 km: os resultados mudam sem recarregar a página', async ({ page }) => {
    await semMapaDaInternet(page)
    await page.goto('/busca')
    await page.getByRole('button', { name: 'Usar minha localização' }).first().click()
    await page.getByRole('radio', { name: '5 km', exact: true }).click()
    await expect(page.locator('.raio-ref i')).toContainText('em até 5 km')
    const em5 = await page.locator('.card').count()
    let recarregou = false
    page.on('load', () => { recarregou = true })

    await page.getByRole('radio', { name: '10 km', exact: true }).click()
    await expect(page.locator('.raio-ref i')).toContainText('em até 10 km')
    expect(await page.locator('.card').count()).toBeGreaterThanOrEqual(em5)

    await page.getByRole('radio', { name: '50 km', exact: true }).click()
    await expect(page.getByText('Bicicleta aro 29')).toBeVisible()
    expect(recarregou).toBe(false)
  })

  test('raio personalizado: 40 km', async ({ page }) => {
    await semMapaDaInternet(page)
    await page.goto('/busca')
    await page.getByLabel('Outro raio em km').fill('40')
    await page.getByRole('button', { name: 'Usar esse raio' }).click()
    await expect(page.locator('.raio-ref i')).toContainText('em até 40 km')
    await page.getByLabel('Outro raio em km').fill('999')
    await page.getByRole('button', { name: 'Usar esse raio' }).click()
    await expect(page.getByRole('alert').filter({ hasText: '1 a 300' })).toBeVisible()
  })
})

test.describe('Sem GPS', () => {
  test('comprador nega a localização: o site explica e oferece cidade e bairro', async ({ browser }) => {
    const contexto = await browser.newContext({ permissions: [] })
    const page = await contexto.newPage()
    await negarGps(page)
    await semMapaDaInternet(page)
    await page.goto('/busca')
    await page.getByRole('button', { name: 'Usar minha localização' }).first().click()
    await expect(page.locator('.raio-aviso')).toContainText('não autorizou a localização')
    await expect(page.locator('.card').first()).toBeVisible() // a busca continua pela cidade
    await contexto.close()
  })

  test('localização manual: escolhe Ponte Nova e vê os anúncios de lá', async ({ page }) => {
    await semMapaDaInternet(page)
    await page.goto('/busca')
    // no celular e no tablet a cidade fica no menu que desce do ☰
    const menu = page.getByRole('button', { name: 'Abrir menu', exact: true })
    if (await menu.isVisible()) await menu.click()
    await page.getByRole('button', { name: /Localização:/ }).click()
    await page.getByLabel('Buscar cidade da Zona da Mata').fill('ponte')
    await page.getByRole('listbox', { name: 'Cidades da Zona da Mata mineira' }).getByRole('option', { name: 'Ponte Nova', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(page.locator('.raio-ref b')).toContainText('Ponte Nova')
    await expect(page.getByText('Bicicleta aro 29')).toBeVisible()
  })

  test('nada por perto: o site avisa e oferece ampliar o raio', async ({ page }) => {
    await semMapaDaInternet(page)
    await page.goto('/categoria/veiculos')
    await page.getByRole('radio', { name: '1 km', exact: true }).click()
    await expect(page.getByText(/Nenhum anúncio em até 1 km/)).toBeVisible()
    await page.getByRole('button', { name: /Ampliar para \d+ km/ }).click()
    await expect(page.getByText('Bicicleta aro 29')).toBeVisible()
  })
})

test.describe('Vendedor e comprador ao mesmo tempo', () => {
  test('o vendedor publica e o feed do comprador recebe o anúncio sem recarregar; ao excluir, ele some', async ({ browser }) => {
    const doComprador = await browser.newContext()
    const doVendedor = await browser.newContext()
    const comprador = await doComprador.newPage()
    const vendedor = await doVendedor.newPage()
    await semMapaDaInternet(comprador)
    await entrarComo(comprador, 2)
    await entrarComo(vendedor, 3)

    await comprador.goto('/busca')
    await expect(comprador.locator('.card').first()).toBeVisible()
    const titulo = `Cadeira do teste E2E ${Date.now()}`
    await expect(comprador.getByText(titulo)).toHaveCount(0)

    const anuncio = await criarAnuncioPelaApi(vendedor, { titulo })
    await expect(comprador.getByText(titulo)).toBeVisible({ timeout: 15_000 })

    // o vendedor muda a localização do anúncio para Ubá: sai do raio de 5 km do comprador e passa para
    // "Em outras cidades da região", sem aparecer duas vezes
    const mudou = await vendedor.request.patch(`/api/localizacao/anuncios/${anuncio.id}`, { data: { origem: 'bairro', bairro_id: 24 } })
    expect(mudou.ok()).toBeTruthy()
    await expect(dePerto(comprador).getByText(titulo)).toHaveCount(0, { timeout: 15_000 })
    await expect(comprador.locator('.outras-cidades').getByText(titulo)).toBeVisible({ timeout: 15_000 })
    await expect(comprador.getByText(titulo)).toHaveCount(1)

    await vendedor.request.patch(`/api/localizacao/anuncios/${anuncio.id}`, { data: { origem: 'bairro', bairro_id: 1 } })
    await expect(dePerto(comprador).getByText(titulo)).toBeVisible({ timeout: 15_000 })
    await expect(comprador.getByText(titulo)).toHaveCount(1, { timeout: 15_000 })
    expect((await vendedor.request.delete(`/api/anuncios/${anuncio.id}`)).status()).toBe(204)
    await expect(comprador.getByText(titulo)).toHaveCount(0, { timeout: 15_000 })
    await doComprador.close()
    await doVendedor.close()
  })

  test('chat em tempo real: mensagem, lida e online entre duas contas', async ({ browser }) => {
    const doComprador = await browser.newContext()
    const doVendedor = await browser.newContext()
    const comprador = await doComprador.newPage()
    const vendedor = await doVendedor.newPage()
    await entrarComo(comprador, 2) // Larissa
    await entrarComo(vendedor, 1) // Diego, dono da air fryer (conversa 1 do seed)

    await vendedor.goto('/conversas/1')
    await comprador.goto('/conversas/1')
    await expect(comprador.locator('.conv-status')).toContainText('Online agora')

    const texto = `Consigo buscar hoje às 18h? ${Date.now()}`
    await comprador.getByRole('textbox').last().fill(texto)
    await comprador.keyboard.press('Enter')
    await expect(vendedor.locator('.msgs').getByText(texto)).toBeVisible()
    await expect(comprador.locator('.linha-msg.eu').last().locator('[aria-label="Lida"]')).toBeVisible()
    await doComprador.close()
    await doVendedor.close()
  })

  test('o sininho recebe o aviso de anúncio novo de quem ativou, com a foto do anúncio', async ({ browser }) => {
    const doComprador = await browser.newContext()
    const doVendedor = await browser.newContext()
    const comprador = await doComprador.newPage()
    const vendedor = await doVendedor.newPage()
    await semMapaDaInternet(comprador)
    await entrarComo(comprador, 2)
    await entrarComo(vendedor, 3)
    await comprador.goto('/busca')
    await comprador.getByRole('button', { name: /Notificações/ }).click()
    await comprador.getByRole('switch', { name: /^(Ativar|Desativar) avisos$/ }).click()
    await expect(comprador.getByRole('switch', { name: /^(Ativar|Desativar) avisos$/ })).toBeChecked()

    const titulo = `Mesa do sininho ${Date.now()}`
    const anuncio = await criarAnuncioPelaApi(vendedor, { titulo })
    await expect(comprador.locator('.notif-lista')).toContainText(titulo, { timeout: 15_000 })
    // o aviso mostra a foto de capa do que foi publicado
    await expect(comprador.locator('.notif-lista li').filter({ hasText: titulo }).locator('img.notif-foto')).toHaveAttribute('src', new RegExp('/api/uploads/anuncios/' + anuncio.id + '/'))
    await expect(comprador.locator('.notif-qtd')).toBeVisible()

    await comprador.getByRole('switch', { name: /^(Ativar|Desativar) avisos$/ }).click()
    await vendedor.request.delete(`/api/anuncios/${anuncio.id}`)
    await doComprador.close()
    await doVendedor.close()
  })
})

test.describe('Conexão', () => {
  test('comprador perde a conexão: o último resultado fica na tela e, ao voltar, tudo se recupera', async ({ page, context }) => {
    test.setTimeout(200_000)
    await semMapaDaInternet(page)
    await page.goto('/busca')
    await expect(dePerto(page).locator('.card').first()).toBeVisible()
    await expect(page.locator('.outras-cidades')).toBeVisible()
    const antes = await page.locator('.card').count()

    await context.setOffline(true)
    await expect(page.getByText('Sem conexão em tempo real')).toBeVisible({ timeout: 70_000 })
    expect(await page.locator('.card').count()).toBe(antes)

    await context.setOffline(false)
    await expect(page.getByText('Sem conexão em tempo real')).toHaveCount(0, { timeout: 70_000 })
    await page.getByRole('radio', { name: '50 km', exact: true }).click()
    await expect(page.getByText('Bicicleta aro 29')).toBeVisible()
  })
})

test.describe('Vendedor publicando pelo site', () => {
  test.use({ geolocation: { latitude: -20.757104, longitude: -42.875465, accuracy: 12 }, permissions: ['geolocation'] })

  test('preenche a localização pelo GPS (cidade, bairro, rua e CEP) e publica', async ({ page }) => {
    const erros = vigiarErros(page)
    await semMapaDaInternet(page)
    await entrarComo(page, 3)
    await page.goto('/anunciar')

    await page.locator('input[type="file"]').first().setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: FOTO_PNG })
    const titulo = `Ventilador do teste E2E ${Date.now()}`
    await page.getByLabel('Título do anúncio').fill(titulo)
    await page.getByLabel('Categoria').selectOption('casa')
    await page.getByLabel('Condição do produto').selectOption('Usado')
    await page.getByLabel('Preço').fill('80')

    await page.getByRole('button', { name: 'Usar minha localização atual' }).click()
    await expect(page.getByLabel('Cidade')).toHaveValue('1')
    await expect(page.getByLabel('Rua')).not.toHaveValue('')
    await expect(page.getByLabel('CEP')).toHaveValue(/^365\d{2}-\d{3}$/)
    await expect(page.getByLabel('Bairro ou localidade')).not.toHaveValue('')
    await page.getByText('Cabe em carro de app').click() // tag de transporte: como levar

    await page.getByRole('button', { name: 'Publicar anúncio' }).click()
    await expect(page).toHaveURL(/\/meus-anuncios/)
    await expect(page.getByText(titulo)).toBeVisible()

    // quem não é o dono não vê a rua nem o CEP
    const lista = await (await page.request.get('/api/meus-anuncios')).json()
    const id = lista.find((a) => a.titulo === titulo).id
    expect(lista.find((a) => a.titulo === titulo).transporte).toBe('carro')
    const publico = await (await page.context().request.get(`/api/localizacao/anuncios/${id}`, { headers: { Cookie: '' } })).json()
    expect(publico.localizacao.aproximada).toBe(true)
    await page.request.delete(`/api/anuncios/${id}`)
    expect(erros).toEqual([])
  })
})

test.describe('Diferenciais', () => {
  test('Procura-se: o pedido aparece na página e o anúncio compatível avisa quem procura', async ({ browser }) => {
    const doComprador = await browser.newContext()
    const doVendedor = await browser.newContext()
    const comprador = await doComprador.newPage()
    const vendedor = await doVendedor.newPage()
    const erros = vigiarErros(comprador)
    await semMapaDaInternet(comprador)
    await entrarComo(comprador, 2)
    await entrarComo(vendedor, 3)

    const marca = Date.now()
    await comprador.goto('/procura-se')
    await comprador.getByLabel('O que você procura?').fill(`Teclado musical ${marca}`)
    await expect(comprador.getByLabel('Bairro ou localidade').locator('option')).not.toHaveCount(1)
    await comprador.getByLabel('Bairro ou localidade').selectOption({ index: 1 })
    await comprador.getByLabel('Até quanto você paga? (R$)').fill('300')
    await comprador.getByRole('button', { name: 'Publicar pedido' }).click()
    await expect(comprador.locator('.pro-item').first()).toContainText(`Teclado musical ${marca}`)
    await expect(comprador.locator('.pro-item').first()).toContainText('Paga até R$ 300')

    // alguém publica um teclado em Viçosa por menos de R$ 300: o sininho de quem procura recebe o aviso
    const anuncio = await criarAnuncioPelaApi(vendedor, { titulo: `Teclado Casio ${marca}`, preco: '250' })
    await comprador.getByRole('button', { name: /Notificações/ }).click()
    await expect(comprador.locator('.notif-lista')).toContainText(`Apareceu o que você procura: Teclado Casio ${marca}`, { timeout: 15_000 })

    await comprador.keyboard.press('Escape')
    comprador.once('dialog', (dialogo) => dialogo.accept())
    await comprador.locator('.pro-item').first().getByRole('button', { name: 'Excluir' }).click()
    await expect(comprador.getByText(`Teclado musical ${marca}`)).toHaveCount(0)
    await vendedor.request.delete(`/api/anuncios/${anuncio.id}`)
    expect(erros).toEqual([])
    await doComprador.close()
    await doVendedor.close()
  })

  test('anúncio reservado continua na busca com a etiqueta e a página mostra como levar', async ({ page, browser }) => {
    const erros = vigiarErros(page)
    await semMapaDaInternet(page)
    const doVendedor = await browser.newContext()
    const vendedor = await doVendedor.newPage()
    await entrarComo(vendedor, 3)
    const titulo = `Abajur do teste E2E ${Date.now()}`
    const anuncio = await criarAnuncioPelaApi(vendedor, { titulo, transporte: 'mochila' })
    const reservado = await vendedor.request.patch(`/api/anuncios/${anuncio.id}/status`, { data: { status: 'reservado' } })
    expect(reservado.ok()).toBeTruthy()

    await page.goto(`/busca?q=${encodeURIComponent(titulo)}`)
    const card = page.locator('.card', { hasText: titulo })
    await expect(card).toBeVisible()
    await expect(card.locator('.card-etiqueta')).toHaveText('Reservado')

    await page.goto(`/anuncio/${anuncio.id}`)
    await expect(page.locator('.det-vendido.reservado')).toHaveText('Reservado')
    await expect(page.locator('.det-dados')).toContainText('Cabe na mochila')
    await expect(page.getByRole('button', { name: 'Conversar' })).toBeEnabled()

    await vendedor.request.delete(`/api/anuncios/${anuncio.id}`)
    expect(erros).toEqual([])
    await doVendedor.close()
  })
})
