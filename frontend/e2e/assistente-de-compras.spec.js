// IA do DesapegaUai (algoritmo próprio, sem serviço pago): comparação pronta no topo da busca, página
// "Comparar" lado a lado e lista de compras na aba de Favoritos. Tudo em tempo real e sem dado pessoal de
// ninguém: a IA só lê o que o anúncio mostra para todo mundo.
// Os anúncios do teste são do Usuário Teste (3) no Centro de Viçosa; a palavra Zorbix separa eles do seed.
import { expect, test } from '@playwright/test'
import { criarAnuncioPelaApi, entrarComo, vigiarErros } from './ajuda.js'

const BICICLETAS = {
  caloi: { titulo: 'Bicicleta Zorbix aro 29 Caloi', preco: '450', condicao: 'seminovo', descricao: 'Bicicleta aro 29, 21 marchas, quadro de alumínio e freio a disco. Pouco usada, sem arranhões, pneus novos.' },
  monark: { titulo: 'Bicicleta Zorbix Monark aro 26', preco: '380', condicao: 'usado', descricao: 'Aro 26, 18 marchas, quadro de aço. Pneu traseiro gasto.' },
  oggi: { titulo: 'Bicicleta Zorbix Oggi aro 29', preco: '520', condicao: 'seminovo', descricao: 'Aro 29 com 24 marchas, quadro de alumínio e suspensão dianteira. Revisada mês passado, nenhum defeito. Acompanha nota fiscal.' },
}
const NOVA = { titulo: 'Bicicleta Zorbix aro 26 Sense', preco: '300', condicao: 'usado', descricao: 'Aro 26, 21 marchas, freio v-brake.' }

let doVendedor
let vendedor
const ids = {}

test.beforeAll(async ({ browser }) => {
  doVendedor = await browser.newContext()
  vendedor = await doVendedor.newPage()
  await entrarComo(vendedor, 3)
  for (const [nome, campos] of Object.entries(BICICLETAS)) ids[nome] = (await criarAnuncioPelaApi(vendedor, campos)).id
})

test.afterAll(async () => {
  for (const id of Object.values(ids)) await vendedor.request.delete(`/api/anuncios/${id}`)
  await doVendedor.close()
})

const valorDe = (painel, rotulo) => painel.locator('.cmp-stat').filter({ hasText: rotulo }).locator('dd')

test.describe('Comparação inteligente na busca', () => {
  test('aparece pronta no topo com os preços e a nota de 0 a 10, muda sozinha quando um anúncio entra ou sai e não leva dado pessoal', async ({ page }) => {
    const erros = vigiarErros(page)
    await entrarComo(page, 2)
    const corpos = []
    page.on('response', (r) => { if (r.url().includes('/api/comparacao')) r.text().then((t) => corpos.push(t), () => {}) })
    await page.goto('/busca?q=zorbix')

    const painel = page.getByRole('region', { name: 'Comparação inteligente' })
    await expect(painel).toContainText('A IA comparou 3 bicicletas')
    await expect(painel).toContainText('Ao vivo')
    await expect(painel.locator('.cmp-linhas > li')).toHaveCount(3)
    await expect(valorDe(painel, 'Menor preço')).toHaveText('R$ 380')
    await expect(valorDe(painel, 'Maior preço')).toHaveText('R$ 520')
    await expect(painel.locator('.cmp-fita')).toHaveCount(1)
    await expect(painel.locator('.cmp-fita')).toHaveText('Melhor custo-benefício')
    // a melhor vem primeiro e cada uma tem a nota de 0 a 10
    const notas = await painel.getByRole('img', { name: /^Nota de custo-benefício/ }).evaluateAll((anéis) => anéis.map((a) => Number(a.getAttribute('aria-label').match(/benefício ([\d,]+) de 10/)[1].replace(',', '.'))))
    expect(notas).toHaveLength(3)
    for (const nota of notas) expect(nota).toBeGreaterThanOrEqual(0)
    for (const nota of notas) expect(nota).toBeLessThanOrEqual(10)
    expect(notas).toEqual([...notas].sort((a, b) => b - a))

    // nada de dado pessoal na resposta da IA (só o que o anúncio mostra para todo mundo)
    expect(corpos.length).toBeGreaterThan(0)
    for (const corpo of corpos) expect(corpo).not.toMatch(/"(email|telefone|cpf|senha|senha_hash|latitude|longitude)"/)

    // tempo real: entrou uma mais barata, a conta muda sem recarregar; saiu, volta como era
    let recarregou = false
    page.on('load', () => { recarregou = true })
    const nova = await criarAnuncioPelaApi(vendedor, NOVA)
    await expect(valorDe(painel, 'Menor preço')).toHaveText('R$ 300')
    await expect(painel.locator('.cmp-linhas > li')).toHaveCount(4)
    // a pessoa vê a nova (fotos carregadas na comparação e na grade) e só então o vendedor apaga
    const fotosDaNova = page.locator('.cmp-linhas > li, .card').filter({ hasText: NOVA.titulo }).locator('img')
    await expect(fotosDaNova).toHaveCount(2)
    await expect.poll(() => fotosDaNova.evaluateAll((fotos) => fotos.every((f) => f.complete && f.naturalWidth > 0))).toBe(true)
    await vendedor.request.delete(`/api/anuncios/${nova.id}`)
    await expect(valorDe(painel, 'Menor preço')).toHaveText('R$ 380')
    await expect(painel.locator('.cmp-linhas > li')).toHaveCount(3)
    expect(recarregou).toBe(false)

    // a comparação completa, lado a lado
    await painel.getByRole('link', { name: 'Ver comparação completa' }).click()
    await expect(page).toHaveURL(/\/comparar\?ids=\d+,\d+,\d+$/)
    await expect(page.locator('.cmp-titulo')).toHaveCount(3)
    await expect(page.locator('.cmp-tabela .cmp-fita')).toHaveCount(1)
    for (const rotulo of ['Estado', 'Pontos de atenção', 'Localização', 'Fotos e informações', 'Vendedor']) {
      await expect(page.locator('.cmp-rotulo').filter({ hasText: rotulo })).toHaveCount(1)
    }
    await expect(page.locator('.cmp-chip.atencao')).not.toHaveCount(0) // o pneu gasto da Monark
    expect(erros).toEqual([])
  })

  test('sem anúncios parecidos o bastante, a comparação não aparece', async ({ page }) => {
    await page.goto('/busca?q=geladeira')
    await expect(page.locator('.card').first()).toBeVisible()
    await expect(page.getByRole('region', { name: 'Comparação inteligente' })).toHaveCount(0)
  })
})

test.describe('Lista de compras', () => {
  test('a IA entende o pedido, mostra o que combina, avisa na hora quando aparece um novo; Comprei, tirar e desfazer', async ({ page }) => {
    const erros = vigiarErros(page)
    await entrarComo(page, 2)
    for (const item of (await (await page.request.get('/api/lista-compras')).json()).itens) await page.request.delete(`/api/lista-compras/${item.id}`)
    await page.goto('/favoritos?aba=lista')
    await expect(page.getByRole('button', { name: /Lista de compras/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Sua lista de compras está vazia')).toBeVisible()

    const campo = page.getByRole('textbox', { name: 'O que você quer encontrar?' })
    await campo.fill('a')
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.locator('#lc-erro')).toBeVisible() // curto demais

    await campo.fill('Bicicleta até R$ 500')
    await page.getByRole('button', { name: 'Adicionar' }).click()
    const item = page.locator('.lc-item').filter({ has: page.getByRole('heading', { name: 'Bicicleta até R$ 500' }) })
    await expect(item.locator('.lc-entendi .cmp-chip')).toContainText(['Bicicleta', 'Até R$ 500'])
    await expect(item.locator('.lc-minis')).toContainText(BICICLETAS.caloi.titulo)
    await expect(item.locator('.lc-minis')).toContainText(BICICLETAS.monark.titulo)
    await expect(item.locator('.lc-minis')).not.toContainText(BICICLETAS.oggi.titulo) // R$ 520 passa do limite
    await expect(campo).toHaveValue('')

    // tempo real: o vendedor publica uma que combina; aparece na lista sem recarregar e chega o aviso
    const nova = await criarAnuncioPelaApi(vendedor, NOVA)
    await expect(item.locator('.lc-minis')).toContainText(NOVA.titulo)
    await expect.poll(async () => (await (await page.request.get('/api/notificacoes')).json()).itens
      .some((aviso) => aviso.titulo.startsWith(`Apareceu na sua lista de compras: ${NOVA.titulo}`))).toBe(true)
    await vendedor.request.delete(`/api/anuncios/${nova.id}`)
    await expect(item.locator('.lc-minis')).not.toContainText(NOVA.titulo)

    // Comprei: o item fica marcado e para de mostrar anúncios; tocar de novo volta
    await item.getByRole('button', { name: 'Comprei' }).click()
    await expect(item.locator('.lc-status')).toHaveText('Comprado')
    await expect(item.getByRole('button', { name: 'Comprado' })).toHaveAttribute('aria-pressed', 'true')
    await expect(item.locator('.lc-minis')).toHaveCount(0)
    await item.getByRole('button', { name: 'Comprado' }).click()
    await expect(item.locator('.lc-minis')).toContainText(BICICLETAS.caloi.titulo)

    // tirar da lista e desfazer
    await item.getByRole('button', { name: 'Tirar "Bicicleta até R$ 500" da lista' }).click()
    await expect(page.locator('.aviso-flutuante')).toContainText('"Bicicleta até R$ 500" saiu da lista.')
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await expect(item).toBeVisible()
    await item.getByRole('button', { name: 'Tirar "Bicicleta até R$ 500" da lista' }).click()
    await expect(page.getByText('Sua lista de compras está vazia')).toBeVisible()

    // quem vende não fica sabendo o que a pessoa procura
    expect((await (await vendedor.request.get('/api/lista-compras')).json()).itens).toEqual([])
    expect(erros).toEqual([])
  })
})
