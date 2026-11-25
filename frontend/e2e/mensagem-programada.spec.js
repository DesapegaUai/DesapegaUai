// Mensagem programada no chat (como no WhatsApp): segurar o enviar abre "Programar mensagem" com as
// rodinhas de dia, hora e minuto; o aviso "Você programou..." só aparece para quem programou; "Mostrar"
// lista as programadas com "Enviar agora" e "Apagar"; e a mensagem sai sozinha no horário, mesmo com o
// site fechado. A lista de conversas em cartões também é conferida aqui.
// Conversa 1 do seed: Larissa (2) comprando a air fryer do Diego (1).
import { devices, expect, test } from '@playwright/test'
import { entrarComo, vigiarErros } from './ajuda.js'

const CONVERSA = 1

const programadasNaApi = async (page) => (await (await page.request.get(`/api/conversas/${CONVERSA}/programadas`)).json()).programadas
async function limparProgramadas(page) {
  for (const programada of await programadasNaApi(page)) await page.request.delete(`/api/conversas/${CONVERSA}/programadas/${programada.id}`)
}
async function segurarComOMouse(page, botao) {
  await botao.hover()
  await page.mouse.down()
  await page.waitForTimeout(700)
  await page.mouse.up()
}
const bolhaCom = (page, texto) => page.locator('.msgs .bolha').filter({ hasText: texto })
const botaoEnviar = (page) => page.locator('.campo-msg').getByRole('button', { name: 'Enviar mensagem' })

// amanhã às 10:00, pelo teclado (cada rodinha é um "spinbutton")
async function escolherAmanhaAs10(janela) {
  const dia = janela.getByRole('spinbutton', { name: 'Dia' })
  await dia.press('Home')
  await dia.press('ArrowDown')
  const hora = janela.getByRole('spinbutton', { name: 'Hora' })
  await hora.press('Home')
  await hora.press('PageDown')
  await hora.press('PageDown')
  await janela.getByRole('spinbutton', { name: 'Minuto' }).press('Home')
  await expect(dia).toHaveAttribute('aria-valuetext', 'Amanhã')
  await expect(hora).toHaveAttribute('aria-valuetext', '10')
}

test.describe('Lista de conversas em cartões', () => {
  test('cada conversa mostra se a pessoa está vendendo ou comprando e o produto com o preço', async ({ browser }) => {
    const doVendedor = await browser.newContext()
    const daCompradora = await browser.newContext()
    const vendedor = await doVendedor.newPage()
    const compradora = await daCompradora.newPage()
    await entrarComo(vendedor, 1)
    await entrarComo(compradora, 2)
    await vendedor.goto('/conversas')
    await compradora.goto('/conversas')
    await expect(vendedor.locator('.lista-titulo')).toContainText('Mensagens')

    const doDiego = vendedor.locator(`.item-conv[href$="/conversas/${CONVERSA}"]`)
    await expect(doDiego.locator('.item-papel')).toHaveText('Vendendo')
    await expect(doDiego.locator('.item-produto')).toContainText('Air fryer 4L')
    await expect(doDiego.locator('.item-produto')).toContainText('R$ 260')
    const daLarissa = compradora.locator(`.item-conv[href$="/conversas/${CONVERSA}"]`)
    await expect(daLarissa.locator('.item-papel')).toHaveText('Comprando')
    await expect(daLarissa.locator('.item-produto')).toContainText('Air fryer 4L')
    await doVendedor.close()
    await daCompradora.close()
  })
})

test.describe('Mensagem programada', () => {
  test('segurar o enviar abre as rodinhas; o aviso só aparece para quem programou; "Enviar agora" chega na hora para a outra pessoa', async ({ browser }) => {
    const daCompradora = await browser.newContext()
    const doVendedor = await browser.newContext()
    const compradora = await daCompradora.newPage()
    const vendedor = await doVendedor.newPage()
    const erros = vigiarErros(compradora)
    await entrarComo(compradora, 2)
    await entrarComo(vendedor, 1)
    await limparProgramadas(compradora)
    await compradora.goto(`/conversas/${CONVERSA}`)
    await vendedor.goto(`/conversas/${CONVERSA}`)

    const texto = `Passo aí amanhã às 10h ${Date.now()}`
    await compradora.locator('#campo-mensagem').fill(texto)
    // a dica aparece só na primeira vez que a pessoa escreve
    await expect(compradora.locator('.pm-dica')).toHaveText('Segure para programar o envio')

    await segurarComOMouse(compradora, botaoEnviar(compradora))
    const janela = compradora.getByRole('dialog', { name: 'Programar mensagem' })
    await expect(janela).toBeVisible()
    await expect(janela).toContainText(texto)
    await expect(bolhaCom(compradora, texto)).toHaveCount(0) // segurar não envia

    await escolherAmanhaAs10(janela)
    await janela.getByRole('button', { name: 'Enviar amanhã às 10:00' }).click()
    await expect(janela).toHaveCount(0)
    await expect(compradora.locator('#campo-mensagem')).toHaveValue('')
    await expect(compradora.locator('.toast-titulo')).toHaveText('Mensagem programada')
    const aviso = compradora.locator('.pm-aviso')
    await expect(aviso).toContainText('Você programou uma mensagem para amanhã às 10:00.')
    await expect(aviso).toBeInViewport()

    // no servidor: às 10:00 de amanhã (horário de Brasília, o do navegador do teste), em UTC
    const [salva] = await programadasNaApi(compradora)
    expect(salva.texto).toBe(texto)
    const amanha = new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    expect(salva.enviar_em).toBe(new Date(`${amanha}T10:00:00-03:00`).toISOString())

    // a outra pessoa não vê o aviso, não recebe nada antes da hora e nem consegue ver a programada
    await expect(vendedor.locator('.pm-aviso')).toHaveCount(0)
    await expect(bolhaCom(vendedor, texto)).toHaveCount(0)
    expect(await programadasNaApi(vendedor)).toEqual([])

    // Mostrar: a lista, agrupada pelo horário; "Enviar agora" manda e a lista fecha
    await aviso.getByRole('button', { name: 'Mostrar' }).click()
    const lista = compradora.getByRole('dialog', { name: 'Mensagens programadas' })
    await expect(lista).toContainText('Para amanhã às 10:00')
    await expect(lista).toContainText(texto)
    await lista.getByRole('button', { name: 'Enviar agora' }).click()
    await expect(lista).toHaveCount(0)
    await expect(aviso).toHaveCount(0)
    await expect(bolhaCom(compradora, texto)).toHaveCount(1)
    await expect(bolhaCom(vendedor, texto)).toHaveCount(1) // chegou na hora, sem recarregar
    expect(await programadasNaApi(compradora)).toEqual([])
    expect(erros).toEqual([])
    await daCompradora.close()
    await doVendedor.close()
  })

  test('"Apagar" tira sem enviar; o botão direito também abre; Esc fecha sem programar; clique rápido e Enter continuam enviando na hora', async ({ page }) => {
    const erros = vigiarErros(page)
    await entrarComo(page, 2)
    await limparProgramadas(page)
    await page.goto(`/conversas/${CONVERSA}`)
    const campo = page.locator('#campo-mensagem')
    const enviar = botaoEnviar(page)

    const paraApagar = `Esta vai ser apagada ${Date.now()}`
    await campo.fill(paraApagar)
    await enviar.click({ button: 'right' }) // o menu do botão (botão direito ou tecla de menu) também programa
    const janela = page.getByRole('dialog', { name: 'Programar mensagem' })
    await expect(janela).toBeVisible()
    await janela.locator('.pm-enviar').click()
    await page.locator('.pm-aviso').getByRole('button', { name: 'Mostrar' }).click()
    const lista = page.getByRole('dialog', { name: 'Mensagens programadas' })
    await lista.getByRole('button', { name: 'Apagar' }).click()
    await expect(lista).toHaveCount(0)
    await expect(page.locator('.pm-aviso')).toHaveCount(0)
    expect(await programadasNaApi(page)).toEqual([])
    await expect(bolhaCom(page, paraApagar)).toHaveCount(0)

    // clique rápido: envia na hora, sem abrir a janela
    const rapida = `Clique rápido ${Date.now()}`
    await campo.fill(rapida)
    await enviar.click()
    await expect(bolhaCom(page, rapida)).toHaveCount(1)
    await expect(janela).toHaveCount(0)

    // segurar e desistir (Esc): não programa nem envia; depois o Enter no botão envia normalmente
    const desistiu = `Desisti de programar ${Date.now()}`
    await campo.fill(desistiu)
    await segurarComOMouse(page, enviar)
    await expect(janela).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(janela).toHaveCount(0)
    await expect(campo).toHaveValue(desistiu)
    expect(await programadasNaApi(page)).toEqual([])
    await expect(bolhaCom(page, desistiu)).toHaveCount(0)
    await enviar.focus()
    await page.keyboard.press('Enter')
    await expect(bolhaCom(page, desistiu)).toHaveCount(1)

    // sem texto não tem o que programar: segurar o botão (desligado) não abre nada
    await segurarComOMouse(page, enviar)
    await expect(janela).toHaveCount(0)
    expect(erros).toEqual([])
  })

  test('sai sozinha no horário, mesmo com o site fechado, e a outra pessoa recebe', async ({ browser }) => {
    test.setTimeout(90_000)
    const daCompradora = await browser.newContext()
    const compradora = await daCompradora.newPage()
    await entrarComo(compradora, 2)
    await limparProgramadas(compradora)
    const texto = `Saiu sozinha no horário ${Date.now()}`
    const resposta = await compradora.request.post(`/api/conversas/${CONVERSA}/programadas`, {
      data: { texto, enviar_em: new Date(Date.now() + 15_000).toISOString() },
    })
    expect(resposta.status()).toBe(201)
    // em vez da janela, a API pede no mínimo 10 s no futuro e no máximo 30 dias
    expect((await compradora.request.post(`/api/conversas/${CONVERSA}/programadas`, { data: { texto, enviar_em: new Date(Date.now() - 60_000).toISOString() } })).status()).toBe(400)
    expect((await compradora.request.post(`/api/conversas/${CONVERSA}/programadas`, { data: { texto, enviar_em: new Date(Date.now() + 31 * 24 * 3600 * 1000).toISOString() } })).status()).toBe(400)
    await compradora.close() // site fechado

    const doVendedor = await browser.newContext()
    const vendedor = await doVendedor.newPage()
    await entrarComo(vendedor, 1)
    await vendedor.goto(`/conversas/${CONVERSA}`)
    await expect(bolhaCom(vendedor, texto)).toHaveCount(1, { timeout: 45_000 }) // chega em tempo real
    const conferir = await daCompradora.newPage()
    expect(await programadasNaApi(conferir)).toEqual([])
    await daCompradora.close()
    await doVendedor.close()
  })

  test('no celular: segurar com o dedo abre a janela e soltar o dedo não programa sozinho; tocar rápido envia', async ({ browser, browserName }) => {
    test.skip(browserName !== 'chromium', 'o toque de verdade é simulado pelo protocolo do Chrome')
    const contexto = await browser.newContext({ ...devices['Pixel 7'] })
    const page = await contexto.newPage()
    const erros = vigiarErros(page)
    await entrarComo(page, 2)
    await limparProgramadas(page)
    await page.goto(`/conversas/${CONVERSA}`)
    const cdp = await contexto.newCDPSession(page)
    async function tocar(alvo, ms) {
      const caixa = await alvo.boundingBox()
      const ponto = { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [ponto] })
      await page.waitForTimeout(ms)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    const campo = page.locator('#campo-mensagem')
    const enviar = botaoEnviar(page)

    // ao soltar o dedo, o "clique" cairia no botão da janela que abriu embaixo dele: não pode programar
    const texto = `Segurei com o dedo ${Date.now()}`
    await campo.fill(texto)
    await tocar(enviar, 800)
    const janela = page.getByRole('dialog', { name: 'Programar mensagem' })
    await expect(janela).toBeVisible()
    await page.waitForTimeout(600)
    await expect(janela).toBeVisible()
    expect(await programadasNaApi(page)).toEqual([])
    await expect(bolhaCom(page, texto)).toHaveCount(0)

    // tocar em "Amanhã" e numa hora das rodinhas e programar
    await janela.locator('.roda-dia button', { hasText: 'Amanhã' }).click()
    await expect(janela.getByRole('spinbutton', { name: 'Dia' })).toHaveAttribute('aria-valuetext', 'Amanhã')
    await janela.locator('.roda').nth(1).locator('button', { hasText: /^07$/ }).click()
    await expect(janela.getByRole('spinbutton', { name: 'Hora' })).toHaveAttribute('aria-valuetext', '07')
    await janela.locator('.pm-enviar').click()
    await expect(page.locator('.pm-aviso')).toBeInViewport()
    const [salva] = await programadasNaApi(page)
    expect(new Date(salva.enviar_em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })).toBe('07:00')
    await limparProgramadas(page)

    // toque rápido: envia na hora
    const rapida = `Toque rápido ${Date.now()}`
    await campo.fill(rapida)
    await tocar(enviar, 60)
    await expect(bolhaCom(page, rapida)).toHaveCount(1)
    await expect(janela).toHaveCount(0)
    expect(erros).toEqual([])
    await contexto.close()
  })
})
