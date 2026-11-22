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

test.describe('Confirmação de leitura', () => {
  test('um tique enviada, dois quando a outra pessoa abre o site e dois azuis quando ela abre a conversa', async ({ browser }) => {
    const daCompradora = await browser.newContext()
    const doVendedor = await browser.newContext()
    const compradora = await daCompradora.newPage()
    const vendedor = await doVendedor.newPage()
    await entrarComo(compradora, 2)
    await entrarComo(vendedor, 1)
    await compradora.goto('/conversas/1')

    const texto = `Confirmação de leitura ${Date.now()}`
    await compradora.getByRole('textbox').last().fill(texto)
    await compradora.keyboard.press('Enter')
    const tiques = compradora.locator('.linha-msg.eu').filter({ hasText: texto }).locator('.tiques')
    await expect(tiques).toHaveAttribute('aria-label', 'Enviada') // o vendedor está fora

    await vendedor.goto('/') // o vendedor abre o site, em outra tela
    await expect(tiques).toHaveAttribute('aria-label', 'Entregue')

    await vendedor.goto('/conversas/1') // e abre a conversa
    await expect(tiques).toHaveAttribute('aria-label', 'Lida')
    await expect(tiques).toHaveClass(/lida/)

    await daCompradora.close()
    await doVendedor.close()
  })
})

test.describe('Azul só quando abre a conversa', () => {
  test('abrir a lista de conversas não deixa azul; só abrir a conversa deixa', async ({ browser }) => {
    const daCompradora = await browser.newContext()
    const doVendedor = await browser.newContext()
    const compradora = await daCompradora.newPage()
    const vendedor = await doVendedor.newPage()
    await entrarComo(compradora, 2)
    await entrarComo(vendedor, 1)
    await compradora.goto('/conversas/1')
    const texto = `Só azul quando abrir ${Date.now()}`
    await compradora.getByRole('textbox').last().fill(texto)
    await compradora.keyboard.press('Enter')
    const tiques = compradora.locator('.linha-msg.eu').filter({ hasText: texto }).locator('.tiques')

    await vendedor.goto('/conversas') // só a lista
    await expect(vendedor.locator('.item-conv').first()).toBeVisible()
    await expect(tiques).toHaveAttribute('aria-label', 'Entregue')
    await compradora.waitForTimeout(1500)
    await expect(tiques).toHaveAttribute('aria-label', 'Entregue')

    await vendedor.locator('a.item-conv[href="/conversas/1"]').click() // abre a conversa
    await expect(tiques).toHaveAttribute('aria-label', 'Lida')

    await daCompradora.close()
    await doVendedor.close()
  })
})

test.describe('Confirmação de leitura no celular', () => {
  test('o aviso de lida se perdeu (celular em segundo plano): ao voltar para o site, os tiques ficam azuis', async ({ browser }) => {
    const daCompradora = await browser.newContext()
    const doVendedor = await browser.newContext()
    const compradora = await daCompradora.newPage()
    const vendedor = await doVendedor.newPage()
    // o tempo real da compradora passa por aqui: enquanto "bloquear" estiver ligado, o aviso de lida não chega,
    // como acontece no iPhone com o site em segundo plano
    let bloquear = false
    await compradora.routeWebSocket(/socket.io/, (ws) => {
      const servidor = ws.connectToServer()
      servidor.onMessage((m) => { if (bloquear && typeof m === 'string' && m.includes('mensagens_lidas')) return; ws.send(m) })
      ws.onMessage((m) => servidor.send(m))
    })
    await entrarComo(compradora, 2)
    await entrarComo(vendedor, 1)
    await vendedor.goto('/')
    await compradora.goto('/conversas/1')

    const texto = `Lida em segundo plano ${Date.now()}`
    await compradora.getByRole('textbox').last().fill(texto)
    await compradora.keyboard.press('Enter')
    const tiques = compradora.locator('.linha-msg.eu').filter({ hasText: texto }).locator('.tiques')
    await expect(tiques).toHaveAttribute('aria-label', 'Entregue')

    bloquear = true
    await vendedor.goto('/conversas/1') // o vendedor lê, mas o aviso não chega na compradora
    await expect(vendedor.locator('.msgs').getByText(texto)).toBeVisible()
    await compradora.waitForTimeout(1500)
    await expect(tiques).toHaveAttribute('aria-label', 'Entregue')

    // a compradora volta para o site (como desbloquear o celular)
    await compradora.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect(tiques).toHaveAttribute('aria-label', 'Lida')

    await daCompradora.close()
    await doVendedor.close()
  })
})

// troca o "site na tela" da aba, como trocar de aba ou bloquear o celular e depois voltar
const mudarTela = (pagina, escondida) => pagina.evaluate((valor) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => valor })
  document.dispatchEvent(new Event('visibilitychange'))
}, escondida)

test.describe('Aviso de mensagem nova no site', () => {
  test('quem abre o site com mensagem esperando é avisado, sem ativar nada; o número aparece no título da aba e a mensagem que chega com a aba escondida é avisada na volta', async ({ browser }) => {
    const daCompradora = await browser.newContext()
    const doVendedor = await browser.newContext()
    const compradora = await daCompradora.newPage()
    const vendedor = await doVendedor.newPage()
    await entrarComo(compradora, 2)
    await entrarComo(vendedor, 1)

    // a compradora escreve antes de o vendedor abrir o site
    expect((await compradora.request.post('/api/conversas/1/mensagens', { data: { texto: `Oi, ainda tem? ${Date.now()}` } })).ok()).toBeTruthy()
    await vendedor.goto('/')
    await expect(vendedor.getByRole('status').getByText('Você tem mensagem nova')).toBeVisible()
    await expect(vendedor).toHaveTitle(/^\(\d+\) /)

    // o vendedor troca de aba: nada aparece enquanto ele está fora, e o aviso aparece quando ele volta
    await mudarTela(vendedor, true)
    const texto = `Chegou com a aba escondida ${Date.now()}`
    expect((await compradora.request.post('/api/conversas/1/mensagens', { data: { texto } })).ok()).toBeTruthy()
    await vendedor.waitForTimeout(800)
    await expect(vendedor.getByRole('status').getByText(texto)).toHaveCount(0)
    await mudarTela(vendedor, false)
    await expect(vendedor.getByRole('status').getByText(texto)).toBeVisible()
    // como no WhatsApp: o nome e a foto de quem mandou (a Larissa não tem foto: aparecem as iniciais do perfil)
    const aviso = vendedor.locator('.toast').filter({ hasText: texto })
    await expect(aviso).toContainText('Larissa Andrade')
    await expect(aviso.locator('.toast-foto')).toHaveText('LA')

    // tocar no aviso abre a conversa; leu, o número sai do título
    await aviso.getByRole('link').click()
    await expect(vendedor).toHaveURL(/\/conversas\/1$/)
    await expect(vendedor.locator('.msgs').getByText(texto)).toBeVisible()
    await expect(vendedor).not.toHaveTitle(/^\(\d+\) /)

    await daCompradora.close()
    await doVendedor.close()
  })
})

test.describe('Foto no chat colando ou arrastando', () => {
  test('colar um print (Ctrl+V) e arrastar uma imagem para a conversa viram anexos, e as fotos chegam para a outra pessoa', async ({ browser, browserName }) => {
    // o Firefox apaga o arquivo de um colar ou arrastar criado pelo teste, e o Firefox de teste não divide a
    // área de transferência; lá isso só dá para conferir com a pessoa colando de verdade
    test.skip(browserName === 'firefox', 'o Firefox não deixa o teste simular colar ou arrastar arquivo');
    const daCompradora = await browser.newContext()
    const doVendedor = await browser.newContext()
    const compradora = await daCompradora.newPage()
    const vendedor = await doVendedor.newPage()
    await entrarComo(compradora, 2)
    await entrarComo(vendedor, 1)
    await vendedor.goto('/conversas/1')
    await compradora.goto('/conversas/1')
    await expect(vendedor.locator('.msgs')).toBeVisible()
    const fotosAntes = await vendedor.locator('.msgs .bolha-img').count()

    // print colado no campo da mensagem (como Win+Shift+S e depois Ctrl+V)
    await compradora.getByRole('textbox').last().click()
    await compradora.evaluate(async () => {
      const imagem = await (await fetch('/icon-192.png')).blob()
      const dados = new DataTransfer()
      dados.items.add(new File([imagem], 'image.png', { type: 'image/png' }))
      document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dados, bubbles: true, cancelable: true }))
    })
    const anexos = compradora.getByRole('list', { name: 'Anexos para enviar' }).locator('img')
    await expect(anexos).toHaveCount(1)
    await expect(anexos.first()).toHaveAttribute('alt', 'print.png')

    // imagem arrastada do computador: enquanto passa por cima da conversa aparece "Solte a imagem para anexar"
    const avisouParaSoltar = await compradora.evaluate(async () => {
      const imagem = await (await fetch('/icon-512.png')).blob()
      const dados = new DataTransfer()
      dados.items.add(new File([imagem], 'foto-do-produto.png', { type: 'image/png' }))
      const conversa = document.querySelector('.conversa .msgs')
      conversa.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dados, bubbles: true, cancelable: true }))
      conversa.dispatchEvent(new DragEvent('dragover', { dataTransfer: dados, bubbles: true, cancelable: true }))
      await new Promise((pronto) => { requestAnimationFrame(() => requestAnimationFrame(pronto)) })
      const avisou = document.body.innerText.includes('Solte a imagem para anexar')
      conversa.dispatchEvent(new DragEvent('drop', { dataTransfer: dados, bubbles: true, cancelable: true }))
      return avisou
    })
    expect(avisouParaSoltar).toBe(true)
    await expect(anexos).toHaveCount(2)
    await expect(compradora.getByText('Solte a imagem para anexar')).toHaveCount(0)

    await compradora.getByRole('button', { name: 'Enviar mensagem' }).click()
    await expect(anexos).toHaveCount(0)
    await expect(vendedor.locator('.msgs .bolha-img')).toHaveCount(fotosAntes + 2)

    await daCompradora.close()
    await doVendedor.close()
  })
})

test.describe('Mensagem antiga', () => {
  test('depois do prazo, Editar e Apagar para todos continuam no menu, apagados e com o aviso', async ({ page }) => {
    await entrarComo(page, 2)
    const texto = `Mensagem para envelhecer ${Date.now()}`
    expect((await page.request.post('/api/conversas/1/mensagens', { data: { texto } })).ok()).toBeTruthy()
    // o navegador acha que já passaram 3 dias (o prazo de editar é 15 minutos e o de apagar para todos, 2 dias)
    await page.clock.install({ time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) })
    await page.goto('/conversas/1')
    await page.locator('.linha-msg.eu .bolha').filter({ hasText: texto }).click()
    const menu = page.getByRole('menu', { name: 'Opções da mensagem' })
    await expect(menu.getByRole('menuitem', { name: /Editar/ })).toBeDisabled()
    await expect(menu).toContainText('Só dá para editar até 15 minutos depois de enviar')
    await expect(menu.getByRole('menuitem', { name: /Apagar para todos/ })).toBeDisabled()
    await expect(menu).toContainText('Só dá para apagar para todos até 2 dias depois de enviar')
    await expect(menu.getByRole('menuitem', { name: 'Apagar para mim' })).toBeEnabled()
    await expect(menu.getByRole('menuitem', { name: 'Apagar para mim' })).toBeFocused()
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
