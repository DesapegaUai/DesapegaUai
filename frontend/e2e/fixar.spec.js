// Fixar conversa (até 3 no topo da minha lista) e fixar mensagem (até 3 no topo da conversa, para as duas
// pessoas, por 24 horas, 7 dias ou 30 dias), como no WhatsApp.
// Conversa 1 do seed: Larissa (2) comprando a air fryer do Diego (1).
import { expect, test } from '@playwright/test'
import { entrarComo, vigiarErros } from './ajuda.js'

const CONVERSA = 1

test.describe('Fixar conversa', () => {
  test('pelos três pontinhos: vai para o topo com o alfinete; a 4ª é recusada com o aviso; arquivar tira a fixação', async ({ page }) => {
    const erros = vigiarErros(page)
    await entrarComo(page, 2)
    // mais 3 conversas da Larissa (anúncios 1, 2 e 3 do Diego): ela fica com 4
    const extras = []
    for (const anuncioId of [1, 2, 3]) extras.push((await (await page.request.post('/api/conversas', { data: { anuncio_id: anuncioId } })).json()).conversa.id)
    for (const id of [CONVERSA, ...extras]) await page.request.delete(`/api/conversas/${id}/fixar`)

    await page.goto('/conversas')
    const item = (id) => page.locator('.item-conv-caixa').filter({ has: page.locator(`.item-conv[href$="/conversas/${id}"]`) })
    const fixarPeloMenu = async (id, rotulo) => {
      await item(id).getByRole('button', { name: /Mais opções da conversa/ }).click()
      await page.getByRole('menuitem', { name: rotulo }).click()
    }

    await fixarPeloMenu(CONVERSA, 'Fixar conversa')
    await expect(page.locator('.item-conv').first()).toHaveAttribute('href', `/conversas/${CONVERSA}`)
    await expect(item(CONVERSA).locator('.item-fixada')).toBeVisible()
    await fixarPeloMenu(extras[0], 'Fixar conversa')
    await fixarPeloMenu(extras[1], 'Fixar conversa')
    await expect(page.locator('.item-conv').first()).toHaveAttribute('href', `/conversas/${extras[1]}`) // a última fixada no alto
    await expect(page.locator('.item-fixada')).toHaveCount(3)

    await fixarPeloMenu(extras[2], 'Fixar conversa')
    await expect(page.locator('.toast-area').filter({ hasText: 'Não foi possível fixar a conversa' })).toContainText('até 3 conversas')
    await expect(page.locator('.item-fixada')).toHaveCount(3)

    await fixarPeloMenu(extras[1], 'Desafixar conversa')
    await expect(page.locator('.item-fixada')).toHaveCount(2)
    // arquivar uma fixada tira a fixação (como no WhatsApp)
    await fixarPeloMenu(extras[0], 'Arquivar conversa')
    await expect(page.locator('.item-fixada')).toHaveCount(1)
    await expect.poll(async () => (await (await page.request.get('/api/conversas')).json()).itens.filter((c) => c.fixada).map((c) => c.id)).toEqual([CONVERSA])

    // limpa: desafixa, desarquiva e tira as extras da lista
    await page.request.delete(`/api/conversas/${CONVERSA}/fixar`)
    await page.evaluate(() => localStorage.clear())
    for (const id of extras) await page.request.delete(`/api/conversas/${id}`)
    expect(erros.filter((e) => !/status of 409/.test(e))).toEqual([])
  })
})

test.describe('Fixar mensagem', () => {
  test('escolhe o prazo; a faixa aparece para as duas pessoas na hora; leva até a mensagem; a 4ª tira a mais antiga; desafixar pelo menu', async ({ browser }) => {
    const daCompradora = await browser.newContext()
    const doVendedor = await browser.newContext()
    const compradora = await daCompradora.newPage()
    const vendedor = await doVendedor.newPage()
    const erros = vigiarErros(compradora)
    await entrarComo(compradora, 2)
    await entrarComo(vendedor, 1)
    for (const f of (await (await compradora.request.get(`/api/conversas/${CONVERSA}/mensagens-fixadas`)).json()).fixadas) {
      await compradora.request.delete(`/api/conversas/${CONVERSA}/mensagens/${f.mensagem_id}/fixar`)
    }
    const marca = Date.now()
    const textos = [1, 2, 3, 4].map((n) => `Fixar mensagem ${marca} nº ${n}`)
    for (const texto of textos) expect((await compradora.request.post(`/api/conversas/${CONVERSA}/mensagens`, { data: { texto } })).ok()).toBeTruthy()

    await compradora.goto(`/conversas/${CONVERSA}`)
    await vendedor.goto(`/conversas/${CONVERSA}`)
    const bolha = (pagina, texto) => pagina.locator('.msgs .bolha').filter({ hasText: texto })
    const faixa = (pagina) => pagina.getByRole('button', { name: /^Mensagem fixada/ })
    async function fixar(texto, prazo) {
      await bolha(compradora, texto).click()
      await compradora.getByRole('menu', { name: 'Opções da mensagem' }).getByRole('menuitem', { name: 'Fixar' }).click()
      const janela = compradora.getByRole('dialog', { name: 'Fixar mensagem' })
      await expect(janela.getByRole('radio', { name: '7 dias' })).toBeChecked() // 7 dias já vem escolhido
      if (prazo) await janela.getByText(prazo, { exact: true }).click()
      await janela.getByRole('button', { name: 'Fixar' }).click()
      return janela
    }

    let janela = await fixar(textos[0], '24 horas')
    await expect(janela).toHaveCount(0)
    await expect(compradora.locator('.toast-area').filter({ hasText: 'Mensagem fixada' })).toContainText('por 24 horas')
    await expect(faixa(compradora)).toContainText(textos[0])
    await expect(faixa(vendedor)).toContainText(textos[0]) // a outra pessoa vê na hora
    await expect(bolha(compradora, textos[0]).locator('.fixada')).toBeVisible()

    await fixar(textos[1])
    await fixar(textos[2], '30 dias')
    await expect(faixa(compradora)).toContainText('Mensagem fixada 1 de 3')
    await expect(faixa(compradora)).toContainText(textos[2]) // a mais nova primeiro

    // a 4ª: avisa e oferece tirar a mais antiga
    janela = await fixar(textos[3])
    await expect(janela.locator('.fx-aviso')).toContainText('Já há 3 mensagens fixadas')
    await janela.getByRole('button', { name: 'Tirar a mais antiga e fixar' }).click()
    await expect(janela).toHaveCount(0)
    await expect(faixa(compradora)).toContainText(textos[3])
    await expect(bolha(compradora, textos[0]).locator('.fixada')).toHaveCount(0)
    await expect(faixa(vendedor)).toContainText(textos[3])

    // tocar na faixa leva até a mensagem (ela pisca) e a faixa passa para a próxima
    await faixa(compradora).click()
    await expect(compradora.locator('.linha-msg.realcada')).toContainText(textos[3])
    await expect(faixa(compradora)).toContainText('Mensagem fixada 2 de 3')

    // o Diego desafixa pelo menu da mensagem; a Larissa vê na hora
    await bolha(vendedor, textos[3]).click()
    await vendedor.getByRole('menu', { name: 'Opções da mensagem' }).getByRole('menuitem', { name: 'Desafixar' }).click()
    await expect(faixa(compradora)).toContainText(/de 2/)
    await expect(bolha(compradora, textos[3]).locator('.fixada')).toHaveCount(0)

    // Esc fecha a janela sem fixar
    await bolha(compradora, textos[0]).click()
    await compradora.getByRole('menuitem', { name: 'Fixar' }).click()
    await compradora.keyboard.press('Escape')
    await expect(compradora.getByRole('dialog', { name: 'Fixar mensagem' })).toHaveCount(0)
    expect((await (await compradora.request.get(`/api/conversas/${CONVERSA}/mensagens-fixadas`)).json()).fixadas).toHaveLength(2)

    for (const f of (await (await compradora.request.get(`/api/conversas/${CONVERSA}/mensagens-fixadas`)).json()).fixadas) {
      await compradora.request.delete(`/api/conversas/${CONVERSA}/mensagens/${f.mensagem_id}/fixar`)
    }
    expect(erros.filter((e) => !/status of 409/.test(e))).toEqual([])
    await daCompradora.close()
    await doVendedor.close()
  })
})
