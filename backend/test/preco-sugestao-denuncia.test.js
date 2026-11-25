// Histórico e aviso de queda de preço ("favoritou, acompanha"), sugestão de preço ao anunciar (IA) e
// denúncia de anúncio (3 pessoas diferentes tiram o anúncio da busca até a equipe revisar).
// A palavra Zorbix separa os anúncios do teste; duas contas de teste extras são criadas e apagadas no fim.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import { after, before, describe, test } from 'node:test'
import { promisify } from 'node:util'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { pastaDoAnuncio } = await import('../src/utils/fotos.js')
const { liberarAnuncio, removerAnuncio } = await import('../src/services/denunciaAnuncioService.js')
const { quantoBaixou } = await import('../src/services/historicoDePrecoService.js')
const { arredondarPreco, calcularSugestao } = await import('../src/services/sugestaoDePrecoService.js')
const { desligarModeracao } = await import('../src/services/moderacaoDeImagem.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const base = `http://127.0.0.1:${servidor.address().port}/api`
const LOCAL = 'cidade_id=1&raio_km=30'
let vendedor // Usuário Teste (3): publica os anúncios
let comprador // Larissa (2)
let outro // Diego (1)
let extraA
let extraB
const anuncios = []
let foto

async function chamar(metodo, caminho, { cookie, json, form } = {}) {
  const r = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) },
    body: json ? JSON.stringify(json) : form,
  })
  const texto = await r.text()
  return { status: r.status, dados: texto ? JSON.parse(texto) : null }
}
const entrar = async (id) => (await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })).headers.getSetCookie()[0].split(';')[0]
async function publicar(campos, { status } = {}) {
  const f = new FormData()
  const dados = { categoria_id: '1', subcategoria_id: '1', bairro_id: '1', forma_entrega: 'retirada', condicao: 'usado', ...campos, ...(status ? { status } : {}) }
  for (const [k, v] of Object.entries(dados)) f.append(k, String(v))
  if (!status) f.append('fotos', new Blob([foto], { type: 'image/jpeg' }), 'f.jpg')
  const r = await chamar('POST', '/anuncios', { cookie: vendedor, form: f })
  assert.equal(r.status, 201, JSON.stringify(r.dados))
  anuncios.push(r.dados.id)
  return r.dados.id
}
const editar = (id, json) => chamar('PUT', `/anuncios/${id}`, { cookie: vendedor, json })
const ver = (id, cookie) => chamar('GET', `/anuncios/${id}`, { cookie })
const avisosDe = async (cookie) => (await chamar('GET', '/notificacoes?por_pagina=50', { cookie })).dados.itens
async function esperarAviso(cookie, teste) {
  for (let i = 0; i < 60; i += 1) {
    const achado = (await avisosDe(cookie)).find(teste)
    if (achado) return achado
    await new Promise((ok) => setTimeout(ok, 50))
  }
  return null
}
const statusNoBanco = async (id) => (await db.query('SELECT status, status_antes_da_analise FROM anuncio WHERE id = ?', [id]))[0][0]

before(async () => {
  foto = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#3E8B22' } }).jpeg().toBuffer()
  vendedor = await entrar(3)
  comprador = await entrar(2)
  outro = await entrar(1)
  await db.query("DELETE FROM usuario WHERE google_id LIKE 'teste-zorbix-%'")
  const extras = []
  for (const letra of ['a', 'b']) {
    const [r] = await db.query("INSERT INTO usuario (google_id, nome, email) VALUES (?, ?, ?)", [`teste-zorbix-${letra}`, `Pessoa Zorbix ${letra.toUpperCase()}`, `zorbix-${letra}@example.com`])
    extras.push(r.insertId)
  }
  extraA = await entrar(extras[0])
  extraB = await entrar(extras[1])
})

after(async () => {
  for (const id of anuncios) await db.query('DELETE FROM anuncio WHERE id = ?', [id])
  await db.query("DELETE FROM notificacao WHERE titulo LIKE '%Zorbix%'")
  await db.query("DELETE FROM usuario WHERE google_id LIKE 'teste-zorbix-%'")
  await desligarModeracao()
  servidor.closeAllConnections()
  servidor.close()
  await db.end()
})

// ---------------------------------------------------------------- histórico e queda de preço

describe('Histórico e queda de preço', () => {
  test('quantoBaixou: só quando a última mudança foi uma queda, e por 30 dias', () => {
    const agora = new Date('2026-11-25T12:00:00Z')
    const dias = (n) => new Date(agora.getTime() - n * 86400000)
    assert.equal(quantoBaixou([{ preco: 500, em: dias(40) }], agora), null)
    assert.deepEqual(quantoBaixou([{ preco: 500, em: dias(40) }, { preco: 420, em: dias(2) }], agora), { de: 500, para: 420, diferenca: 80, em: dias(2) })
    assert.equal(quantoBaixou([{ preco: 420, em: dias(40) }, { preco: 450, em: dias(2) }], agora), null) // subiu
    assert.equal(quantoBaixou([{ preco: 500, em: dias(40) }, { preco: 420, em: dias(31) }], agora), null) // faz mais de 30 dias
  })

  test('começa com o preço da publicação; baixar avisa quem favoritou (sininho); subir não; voltar ao mesmo valor não repete; baixar mais avisa de novo', async () => {
    const id = await publicar({ titulo: 'Furadeira Zorbix de impacto', preco: 500 })
    assert.ok([200, 201].includes((await chamar('POST', `/favoritos/${id}`, { cookie: comprador })).status))

    let detalhe = (await ver(id, comprador)).dados
    assert.deepEqual(detalhe.historico_preco.map((p) => p.preco), [500])
    assert.equal(detalhe.baixou, null)

    assert.equal((await editar(id, { preco: 420 })).status, 200)
    detalhe = (await ver(id, comprador)).dados
    assert.deepEqual(detalhe.historico_preco.map((p) => p.preco), [500, 420])
    assert.deepEqual({ de: detalhe.baixou.de, para: detalhe.baixou.para, diferenca: detalhe.baixou.diferenca }, { de: 500, para: 420, diferenca: 80 })
    const aviso = await esperarAviso(comprador, (a) => a.tipo === 'queda_preco' && a.anuncio_id === id)
    assert.ok(aviso, 'quem favoritou recebe o aviso')
    assert.equal(aviso.titulo, 'Baixou! Furadeira Zorbix de impacto')
    assert.match(aviso.texto, /^De R\$\s500,00 por R\$\s420,00 · Centro, Viçosa$/)
    // quem não favoritou e o próprio vendedor não recebem
    assert.equal((await avisosDe(outro)).some((a) => a.tipo === 'queda_preco' && a.anuncio_id === id), false)
    assert.equal((await avisosDe(vendedor)).some((a) => a.tipo === 'queda_preco' && a.anuncio_id === id), false)

    assert.equal((await editar(id, { preco: 450 })).status, 200) // subiu: não avisa, e o "baixou" sai
    assert.equal((await ver(id, comprador)).dados.baixou, null)
    assert.equal((await editar(id, { preco: 420 })).status, 200) // voltou ao menor preço recente: não repete o aviso
    assert.deepEqual({ de: (await ver(id, comprador)).dados.baixou.de, para: (await ver(id, comprador)).dados.baixou.para }, { de: 450, para: 420 })
    await new Promise((ok) => setTimeout(ok, 300))
    const contar = async () => (await avisosDe(comprador)).filter((a) => a.tipo === 'queda_preco' && a.anuncio_id === id).length
    assert.equal(await contar(), 1)

    assert.equal((await editar(id, { preco: 380 })).status, 200) // menor preço novo: avisa de novo
    assert.ok(await esperarAviso(comprador, (a) => a.tipo === 'queda_preco' && a.anuncio_id === id && /R\$\s380,00/.test(a.texto)))
    assert.equal(await contar(), 2)

    // editar outra coisa não mexe no histórico
    assert.equal((await editar(id, { titulo: 'Furadeira Zorbix de impacto 700W' })).status, 200)
    assert.deepEqual((await ver(id, comprador)).dados.historico_preco.map((p) => p.preco), [500, 420, 450, 420, 380])
  })

  test('rascunho não tem histórico (o preço só conta depois de publicado)', async () => {
    const id = await publicar({ titulo: 'Rascunho Zorbix', preco: 100 }, { status: 'rascunho' })
    assert.equal((await editar(id, { preco: 80 })).status, 200)
    const detalhe = (await ver(id, vendedor)).dados
    assert.deepEqual(detalhe.historico_preco, [])
    assert.equal(detalhe.baixou, null)
  })
})

// ---------------------------------------------------------------- sugestão de preço

describe('Sugestão de preço ao anunciar', () => {
  let maisCara
  before(async () => {
    for (const preco of [380, 450, 520]) await publicar({ titulo: `Bicicleta Zorbix aro 29 nº ${preco}`, preco, descricao: 'Aro 29, 21 marchas.' })
    maisCara = await publicar({ titulo: 'Bicicleta Zorbix aro 29 Sense', preco: 600, condicao: 'seminovo', descricao: 'Aro 29, 24 marchas.' })
    await publicar({ titulo: 'Capacete Zorbix para bicicleta', preco: 60, descricao: 'Tamanho M.' }) // acessório: não entra
  })
  const sugerir = (consulta, cookie = comprador) => chamar('GET', `/comparacao/sugestao-de-preco?${consulta}&${LOCAL}`, { cookie })

  test('a conta: faixa do meio (1º ao 3º quartil), preço do meio e média, com preços redondos', () => {
    assert.deepEqual(calcularSugestao([380, 450, 520, 600]), { de: 430, ate: 540, preco: 490, media: 488 })
    assert.deepEqual(calcularSugestao([380, 450, 520]), { de: 420, ate: 490, preco: 450, media: 450 })
    assert.equal(arredondarPreco(99.5), 100)
    assert.equal(arredondarPreco(12.4), 12)
    assert.equal(arredondarPreco(0.4), 1)
  })

  test('a IA entende o produto pelo título e sugere com os parecidos perto (o acessório fica de fora)', async () => {
    const r = await sugerir('titulo=Bicicleta aro 29 Caloi')
    assert.equal(r.status, 200)
    assert.equal(r.dados.tipo.nome, 'Bicicleta')
    assert.equal(r.dados.total, 4)
    assert.equal(r.dados.mesmo_estado, false)
    assert.deepEqual(r.dados.sugestao, { de: 430, ate: 540, preco: 490, media: 488 })
  })

  test('com o estado do formulário, usa só os do mesmo estado quando há pelo menos 3', async () => {
    const usado = (await sugerir('titulo=Bike aro 29&condicao=usado')).dados
    assert.equal(usado.total, 3)
    assert.equal(usado.mesmo_estado, true)
    assert.deepEqual(usado.sugestao, { de: 420, ate: 490, preco: 450, media: 450 })
    const novo = (await sugerir('titulo=Bicicleta aro 29&condicao=novo')).dados // nenhum novo: usa todos
    assert.equal(novo.total, 4)
    assert.equal(novo.mesmo_estado, false)
  })

  test('editando, o próprio anúncio não entra; os anúncios de quem pede também não; produto desconhecido não tem sugestão', async () => {
    assert.equal((await sugerir(`titulo=Bicicleta aro 29&anuncio_id=${maisCara}`)).dados.total, 3)
    const doVendedor = (await sugerir('titulo=Bicicleta aro 29', vendedor)).dados
    assert.equal(doVendedor.total, 0)
    assert.equal(doVendedor.sugestao, null)
    const desconhecido = (await sugerir('titulo=Coisa sem nome nenhum')).dados
    assert.equal(desconhecido.tipo, null)
    assert.equal(desconhecido.sugestao, null)
  })

  test('dados inválidos: 400', async () => {
    assert.equal((await chamar('GET', `/comparacao/sugestao-de-preco?${LOCAL}`)).status, 400)
    assert.equal((await sugerir('titulo=ab')).status, 400)
    assert.equal((await sugerir('titulo=Bicicleta&condicao=quebrado')).status, 400)
    assert.equal((await sugerir('titulo=Bicicleta&anuncio_id=abc')).status, 400)
  })
})

// ---------------------------------------------------------------- denúncia de anúncio

describe('Denúncia de anúncio', () => {
  test('regras: precisa de login, não denuncia o próprio, motivo válido, "outro" com descrição e uma vez por pessoa', async () => {
    const id = await publicar({ titulo: 'Liquidificador Zorbix', preco: 90 })
    assert.equal((await chamar('POST', `/anuncios/${id}/denuncia`, { json: { motivo: 'golpe' } })).status, 401)
    assert.equal((await chamar('POST', `/anuncios/${id}/denuncia`, { cookie: vendedor, json: { motivo: 'golpe' } })).status, 400)
    assert.equal((await chamar('POST', `/anuncios/${id}/denuncia`, { cookie: outro, json: { motivo: 'ofensa' } })).status, 400)
    assert.equal((await chamar('POST', `/anuncios/${id}/denuncia`, { cookie: outro, json: { motivo: 'outro' } })).status, 400)
    assert.equal((await chamar('POST', `/anuncios/${id}/denuncia`, { cookie: outro, json: { motivo: 'golpe', descricao: 'x'.repeat(501) } })).status, 400)
    assert.equal((await chamar('POST', '/anuncios/999999/denuncia', { cookie: outro, json: { motivo: 'golpe' } })).status, 404)

    const r = await chamar('POST', `/anuncios/${id}/denuncia`, { cookie: outro, json: { motivo: 'golpe', descricao: 'Pediu Pix adiantado.' } })
    assert.equal(r.status, 201)
    assert.deepEqual(Object.keys(r.dados.denuncia).sort(), ['criada_em', 'id', 'motivo']) // nada de quantas denúncias tem
    assert.equal((await chamar('GET', `/anuncios/${id}/denuncia`, { cookie: outro })).dados.denuncia.motivo, 'golpe')
    assert.equal((await chamar('GET', `/anuncios/${id}/denuncia`, { cookie: comprador })).dados.denuncia, null)
    assert.equal((await chamar('POST', `/anuncios/${id}/denuncia`, { cookie: outro, json: { motivo: 'falso' } })).status, 409)
    assert.equal((await statusNoBanco(id)).status, 'ativo') // uma denúncia só não tira da busca
  })

  test('3 pessoas diferentes: sai da busca e dos favoritos, só o dono vê, o vendedor é avisado; a equipe libera e volta como estava', async () => {
    const titulo = 'Cafeteira Zorbix italiana'
    const id = await publicar({ titulo, preco: 120 })
    assert.ok([200, 201].includes((await chamar('POST', `/favoritos/${id}`, { cookie: comprador })).status))
    assert.equal((await chamar('PATCH', `/anuncios/${id}/status`, { cookie: vendedor, json: { status: 'reservado' } })).status, 200)

    for (const cookie of [outro, comprador]) assert.equal((await chamar('POST', `/anuncios/${id}/denuncia`, { cookie, json: { motivo: 'falso' } })).status, 201)
    assert.equal((await statusNoBanco(id)).status, 'reservado')
    assert.equal((await chamar('POST', `/anuncios/${id}/denuncia`, { cookie: extraA, json: { motivo: 'proibido' } })).status, 201)
    assert.deepEqual(await statusNoBanco(id), { status: 'em_analise', status_antes_da_analise: 'reservado' })

    const aviso = await esperarAviso(vendedor, (a) => a.tipo === 'anuncio_em_analise' && a.anuncio_id === id)
    assert.ok(aviso)
    assert.equal(aviso.titulo, `Seu anúncio saiu da busca: ${titulo}`)
    // para os outros, não existe; para o dono, aparece em análise
    assert.equal((await ver(id, comprador)).status, 404)
    assert.equal((await ver(id)).status, 404)
    assert.equal((await ver(id, vendedor)).dados.status, 'em_analise')
    const busca = (await chamar('GET', `/anuncios?busca=Cafeteira%20Zorbix&${LOCAL}`, { cookie: comprador })).dados
    assert.equal(busca.itens.some((a) => a.id === id), false)
    assert.equal((await chamar('GET', '/favoritos', { cookie: comprador })).dados.itens.some((a) => a.id === id), false)
    assert.equal((await chamar('POST', `/favoritos/${id}`, { cookie: extraA })).status, 404)
    assert.equal((await chamar('POST', '/conversas', { cookie: extraA, json: { anuncio_id: id } })).status, 404)
    assert.equal((await chamar('POST', `/anuncios/${id}/denuncia`, { cookie: extraB, json: { motivo: 'golpe' } })).status, 404)
    assert.equal((await chamar('PATCH', `/anuncios/${id}/status`, { cookie: vendedor, json: { status: 'ativo' } })).status, 409) // só a equipe libera

    assert.deepEqual(await liberarAnuncio(id), { estavaEmAnalise: true })
    assert.deepEqual(await statusNoBanco(id), { status: 'reservado', status_antes_da_analise: null })
    const [situacoes] = await db.query('SELECT DISTINCT situacao FROM denuncia_anuncio WHERE anuncio_id = ?', [id])
    assert.deepEqual(situacoes.map((s) => s.situacao), ['improcedente'])
    assert.ok(await esperarAviso(vendedor, (a) => a.tipo === 'anuncio_liberado' && a.anuncio_id === id))
    assert.equal((await ver(id, comprador)).status, 200)
    assert.equal((await chamar('GET', '/favoritos', { cookie: comprador })).dados.itens.some((a) => a.id === id), true)
    // depois de liberado, as denúncias antigas não contam: uma nova não tira da busca
    assert.equal((await chamar('POST', `/anuncios/${id}/denuncia`, { cookie: extraB, json: { motivo: 'golpe' } })).status, 201)
    assert.equal((await statusNoBanco(id)).status, 'reservado')
  })

  test('a equipe remove: o anúncio sai de vez (com as fotos) e o vendedor é avisado', async () => {
    const titulo = 'Panela Zorbix elétrica'
    const id = await publicar({ titulo, preco: 70 })
    await access(pastaDoAnuncio(id))
    for (const cookie of [outro, comprador, extraA]) assert.equal((await chamar('POST', `/anuncios/${id}/denuncia`, { cookie, json: { motivo: 'improprio' } })).status, 201)
    assert.equal((await statusNoBanco(id)).status, 'em_analise')

    await removerAnuncio(id)
    assert.equal((await ver(id, vendedor)).status, 404)
    await assert.rejects(access(pastaDoAnuncio(id)))
    const aviso = await esperarAviso(vendedor, (a) => a.tipo === 'anuncio_removido' && a.titulo === `Seu anúncio foi removido: ${titulo}`)
    assert.ok(aviso)
    assert.equal(aviso.anuncio_id, null)
  })

  test('npm run denuncias lista para a equipe (sem dizer quem denunciou) e recusa opção errada', async () => {
    const id = await publicar({ titulo: 'Ventilador Zorbix de mesa', preco: 60 })
    assert.equal((await chamar('POST', `/anuncios/${id}/denuncia`, { cookie: outro, json: { motivo: 'golpe', descricao: 'Pediu o pagamento antes de mostrar.' } })).status, 201)
    const rodar = (args) => promisify(execFile)(process.execPath, ['database/denuncias.js', ...args], { cwd: new URL('..', import.meta.url), env: process.env })
    const { stdout } = await rodar([])
    assert.match(stdout, new RegExp(`#${id}\\s+Ventilador Zorbix de mesa`))
    assert.match(stdout, /parece golpe \(1\)/)
    assert.match(stdout, /Pediu o pagamento antes de mostrar\./)
    assert.doesNotMatch(stdout, /Diego/) // quem denunciou não aparece
    await assert.rejects(rodar(['--liberar', 'abc']), (erro) => erro.code === 1 && /npm run denuncias -- --liberar <id>/.test(erro.stderr))
  })
})
