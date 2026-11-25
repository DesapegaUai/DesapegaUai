// Alerta de queda de preço ("favoritou, acompanha") com o histórico na página do anúncio, sugestão de
// preço da IA ao anunciar (faixa embaixo do preço) e denúncia de anúncio pelos três pontinhos (3 pessoas
// diferentes tiram o anúncio da busca até a equipe revisar). A palavra Zorbix separa os anúncios do teste.
import { expect, test } from '@playwright/test'
import { bancoDosTestes, criarAnuncioPelaApi, entrarComo, semMapaDaInternet, vigiarErros } from './ajuda.js'

async function comVendedor(browser) {
  const contexto = await browser.newContext()
  const pagina = await contexto.newPage()
  await entrarComo(pagina, 3)
  return { contexto, pagina }
}

test.describe('Alerta de queda de preço', () => {
  test('quem favoritou recebe "Baixou!" no sininho na hora; a página mostra quanto baixou e o histórico do preço', async ({ page, browser }) => {
    const erros = vigiarErros(page)
    await semMapaDaInternet(page)
    const { contexto, pagina: vendedor } = await comVendedor(browser)
    const titulo = `Furadeira Zorbix ${Date.now()}`
    const anuncio = await criarAnuncioPelaApi(vendedor, { titulo, preco: '500' })

    await entrarComo(page, 2)
    await page.goto(`/anuncio/${anuncio.id}`)
    await expect(page.locator('.det-dica-preco')).toHaveText('Salve nos favoritos para ser avisado se o preço baixar.')
    await page.getByRole('button', { name: 'Favoritar' }).click()
    await expect(page.locator('.det-dica-preco')).toHaveText('Você é avisado se o preço baixar.')
    await expect(page.locator('.det-baixou')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Histórico do preço' })).toHaveCount(0) // ainda não mudou

    expect((await vendedor.request.put(`/api/anuncios/${anuncio.id}`, { data: { preco: 420 } })).ok()).toBeTruthy()
    await page.getByRole('button', { name: /Notificações/ }).click()
    await expect(page.locator('.notif-lista')).toContainText(`Baixou! ${titulo}`, { timeout: 15_000 })
    await expect(page.locator('.notif-lista')).toContainText(/De R\$\s500,00 por R\$\s420,00/)
    await page.keyboard.press('Escape')

    await page.reload()
    await expect(page.locator('.det-baixou')).toHaveText(/Baixou R\$\s80\s·\sera R\$\s500/)
    const historico = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Histórico do preço' }) })
    await expect(historico.getByRole('img')).toHaveAttribute('aria-label', /R\$\s500.*R\$\s420 hoje, com 1 mudança/)
    await expect(historico.locator('.hp-lista li')).toHaveCount(2)
    await expect(historico.locator('.hp-lista li').last()).toContainText('↓ baixou')

    await vendedor.request.delete(`/api/anuncios/${anuncio.id}`)
    await contexto.close()
    expect(erros).toEqual([])
  })
})

test.describe('Sugestão de preço ao anunciar', () => {
  test('a IA mostra a faixa dos parecidos perto, diz se o preço está acima da média e "Usar" preenche o preço', async ({ page, browser }) => {
    const erros = vigiarErros(page)
    await semMapaDaInternet(page)
    const { contexto, pagina: vendedor } = await comVendedor(browser)
    const ids = []
    for (const preco of ['380', '450', '520']) ids.push((await criarAnuncioPelaApi(vendedor, { titulo: `Bicicleta Zorbix aro 29 nº ${preco}`, preco, descricao: 'Aro 29, 21 marchas.' })).id)

    await entrarComo(page, 2)
    await page.goto('/anunciar')
    await page.getByLabel('Título do anúncio').fill('Bicicleta aro 29 Caloi')
    const sugestao = page.locator('.cad-sugestao')
    await expect(sugestao).toContainText(/A IA sugere entre R\$\s420 e R\$\s490/)
    await expect(sugestao).toContainText('3 bicicletas parecidas perto de você')

    await page.getByLabel('Preço').fill('600')
    await expect(sugestao).toContainText('Seu preço está 33% acima da média.')
    await sugestao.getByRole('button', { name: /Usar R\$\s450/ }).click()
    await expect(page.getByLabel('Preço')).toHaveValue('450')
    await expect(sugestao).toContainText('Seu preço está na média.')
    await expect(sugestao.getByRole('button')).toHaveCount(0) // já está no preço sugerido

    // produto que a IA não reconhece: não aparece nada
    await page.getByLabel('Título do anúncio').fill('Coisa sem nome nenhum')
    await expect(sugestao).toHaveCount(0)

    for (const id of ids) await vendedor.request.delete(`/api/anuncios/${id}`)
    await contexto.close()
    expect(erros).toEqual([])
  })
})

test.describe('Denunciar anúncio', () => {
  test('pelos três pontinhos: escolhe o motivo e envia; depois mostra que já denunciou; o dono só vê Compartilhar; sem login vai para entrar', async ({ page, browser }) => {
    const erros = vigiarErros(page)
    await semMapaDaInternet(page)
    const { contexto, pagina: vendedor } = await comVendedor(browser)
    const anuncio = await criarAnuncioPelaApi(vendedor, { titulo: `Liquidificador Zorbix ${Date.now()}`, preco: '90' })
    const menu = (pagina) => pagina.getByRole('menu', { name: 'Mais opções do anúncio' })
    const abrirMenu = (pagina) => pagina.getByRole('button', { name: 'Mais opções do anúncio' }).click()

    // sem login: Denunciar leva para a tela de entrar
    await page.goto(`/anuncio/${anuncio.id}`)
    await abrirMenu(page)
    await expect(menu(page).getByRole('menuitem')).toHaveText(['Compartilhar', 'Denunciar anúncio'])
    await menu(page).getByRole('menuitem', { name: 'Denunciar anúncio' }).click()
    await expect(page).toHaveURL(/\/entrar/)

    await entrarComo(page, 2)
    await page.goto(`/anuncio/${anuncio.id}`)
    await abrirMenu(page)
    await menu(page).getByRole('menuitem', { name: 'Denunciar anúncio' }).click()
    const janela = page.getByRole('dialog', { name: 'Denunciar anúncio' })
    await expect(janela).toBeVisible()
    const enviar = janela.getByRole('button', { name: 'Enviar denúncia' })
    await expect(enviar).toBeDisabled()
    await janela.getByText('Outro motivo').click()
    await expect(enviar).toBeDisabled() // "outro" precisa contar o que houve
    await janela.getByText('Parece golpe').click()
    await expect(enviar).toBeEnabled()
    await enviar.click()
    await expect(janela).toHaveCount(0)
    await expect(page.locator('.toast-area').filter({ hasText: 'Denúncia enviada' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mais opções do anúncio' })).toBeFocused() // o foco volta para os três pontinhos

    await abrirMenu(page)
    await menu(page).getByRole('menuitem', { name: 'Denunciar anúncio' }).click()
    const feita = page.getByRole('dialog', { name: 'Denúncia enviada' })
    await expect(feita).toContainText('Você já denunciou este anúncio (parece golpe)')
    await feita.getByRole('button', { name: 'Entendi' }).click()

    // o dono só compartilha
    await vendedor.goto(`/anuncio/${anuncio.id}`)
    await abrirMenu(vendedor)
    await expect(menu(vendedor).getByRole('menuitem')).toHaveText(['Compartilhar'])

    await vendedor.request.delete(`/api/anuncios/${anuncio.id}`)
    await contexto.close()
    expect(erros).toEqual([])
  })

  test('3 pessoas diferentes: sai da busca, o vendedor vê "Em análise" e o aviso; para os outros, o anúncio não existe', async ({ page, browser }) => {
    await semMapaDaInternet(page)
    const { contexto, pagina: vendedor } = await comVendedor(browser)
    const titulo = `Cafeteira Zorbix ${Date.now()}`
    const anuncio = await criarAnuncioPelaApi(vendedor, { titulo, preco: '120' })

    // a terceira pessoa é uma conta de teste criada só para isto
    const banco = await bancoDosTestes()
    const [criada] = await banco.query("INSERT INTO usuario (google_id, nome, email) VALUES ('teste-e2e-denuncia', 'Pessoa da denúncia', 'e2e-denuncia@example.com')")
    try {
      for (const usuario of [1, 2, criada.insertId]) {
        const contextoDaPessoa = await browser.newContext()
        const pessoa = await contextoDaPessoa.newPage()
        await entrarComo(pessoa, usuario)
        expect((await pessoa.request.post(`/api/anuncios/${anuncio.id}/denuncia`, { data: { motivo: 'falso' } })).status()).toBe(201)
        await contextoDaPessoa.close()
      }

      // o vendedor: aviso no sininho e "Em análise" em Meus anúncios, com a explicação
      await vendedor.goto('/meus-anuncios')
      const item = vendedor.locator('.ma-item').filter({ hasText: titulo })
      await expect(item.locator('.ma-tag')).toHaveText('Em análise')
      await expect(item.locator('.ma-analise')).toContainText('Saiu da busca porque recebeu denúncias')
      await vendedor.getByRole('button', { name: /Notificações/ }).click()
      await expect(vendedor.locator('.notif-lista')).toContainText(`Seu anúncio saiu da busca: ${titulo}`)

      // para os outros, a página do anúncio não existe e ele some da busca
      await entrarComo(page, 2)
      await page.goto(`/anuncio/${anuncio.id}`)
      await expect(page.getByText(/não (foi )?encontrado|não existe/i).first()).toBeVisible()
      await page.goto(`/busca?q=${encodeURIComponent(titulo)}`)
      await expect(page.locator('.card', { hasText: titulo })).toHaveCount(0)
    } finally {
      await vendedor.request.delete(`/api/anuncios/${anuncio.id}`)
      await banco.query("DELETE FROM usuario WHERE google_id = 'teste-e2e-denuncia'")
      await banco.end()
      await contexto.close()
    }
  })
})
