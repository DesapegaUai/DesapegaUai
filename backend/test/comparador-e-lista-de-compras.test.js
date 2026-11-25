// IA do DesapegaUai: comparador de preços, nota de custo-benefício e lista de compras.
// Regras que valem sempre: a IA só lê o que é público no anúncio; vendido e excluído saem na hora;
// a lista é particular; os próprios anúncios não entram na lista de quem anunciou.
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const ia = await import('../src/services/assistenteDeCompras.js')
const { paraAIA } = await import('../src/services/comparacaoService.js')
const servidor = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)) })
const base = `http://127.0.0.1:${servidor.address().port}/api`
let vendedor, comprador, outro, foto
const anuncios = []
const ids = {}

async function chamar(metodo, caminho, { cookie, json, form } = {}) {
  const headers = cookie ? { Cookie: cookie } : {}
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(base + caminho, { method: metodo, headers, body: json !== undefined ? JSON.stringify(json) : form })
  const t = await r.text()
  return { status: r.status, dados: t ? JSON.parse(t) : null, texto: t }
}
const entrar = async (id) => (await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })).headers.getSetCookie()[0].split(';')[0]
async function publicar(campos, fotos = 1) {
  const f = new FormData()
  const dados = { categoria_id: '1', subcategoria_id: '1', bairro_id: '1', forma_entrega: 'retirada', ...campos }
  for (const [k, v] of Object.entries(dados)) f.append(k, String(v))
  for (let i = 0; i < fotos; i += 1) f.append('fotos', new Blob([foto], { type: 'image/jpeg' }), `f${i}.jpg`)
  const r = await chamar('POST', '/anuncios', { cookie: vendedor, form: f })
  assert.equal(r.status, 201, r.texto)
  anuncios.push(r.dados.id)
  return r.dados.id
}
const avisosDe = async (cookie) => (await chamar('GET', '/notificacoes', { cookie })).dados.itens
async function esperarAviso(cookie, teste, vezes = 40) {
  for (let i = 0; i < vezes; i += 1) {
    const achado = (await avisosDe(cookie)).find(teste)
    if (achado) return achado
    await new Promise((ok) => setTimeout(ok, 50))
  }
  return null
}
const LOCAL = 'cidade_id=1&raio_km=10'

before(async () => {
  vendedor = await entrar(3); comprador = await entrar(2); outro = await entrar(1)
  foto = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#3E8B22' } }).jpeg().toBuffer()
  for (const cookie of [vendedor, comprador, outro]) {
    for (const item of (await chamar('GET', `/lista-compras?${LOCAL}`, { cookie })).dados.itens) await chamar('DELETE', `/lista-compras/${item.id}`, { cookie })
  }
  // o exemplo da ideia: três bicicletas parecidas, uma infantil e um capacete (a palavra Zorbix separa as do teste)
  ids.a = await publicar({ titulo: 'Bicicleta Zorbix aro 29 Caloi', preco: 450, condicao: 'seminovo', descricao: 'Bicicleta aro 29, 21 marchas, quadro de alumínio e freio a disco. Pouco usada, sem arranhões, pneus novos.' }, 5)
  ids.b = await publicar({ titulo: 'Bicicleta Zorbix Monark aro 26', preco: 380, condicao: 'usado', descricao: 'Aro 26, 18 marchas, quadro de aço. Pneu traseiro gasto.' }, 1)
  ids.c = await publicar({ titulo: 'Bicicleta Zorbix Oggi aro 29', preco: 520, condicao: 'seminovo', descricao: 'Aro 29 com 24 marchas, quadro de alumínio e suspensão dianteira. Revisada mês passado, nenhum defeito. Acompanha nota fiscal.' }, 4)
  ids.infantil = await publicar({ titulo: 'Bicicleta Zorbix infantil aro 16', preco: 150, condicao: 'usado', descricao: 'Para criança de 5 a 8 anos, com rodinhas.' }, 1)
  ids.capacete = await publicar({ titulo: 'Capacete Zorbix para bicicleta', preco: 60, condicao: 'novo', descricao: 'Tamanho M, sem uso.' }, 1)
})

after(async () => {
  for (const id of anuncios) await chamar('DELETE', `/anuncios/${id}`, { cookie: vendedor })
  for (const cookie of [vendedor, comprador, outro]) {
    for (const item of (await chamar('GET', `/lista-compras?${LOCAL}`, { cookie })).dados?.itens ?? []) await chamar('DELETE', `/lista-compras/${item.id}`, { cookie })
  }
  await db.query("DELETE FROM notificacao WHERE tipo = 'lista_compras'")
  servidor.close(); servidor.closeAllConnections(); await db.end()
})

describe('IA: leitura dos anúncios', () => {
  test('normaliza sem mudar o tamanho (dá para mostrar o trecho original com acento)', () => {
    for (const texto of ['Pneu traseiro gasto', 'Arranhões na tampa, ÓTIMO estado', 'Fogão 4 bocas — ç ã õ', 'TV 42” 😀 ok']) {
      assert.equal(ia.normalizar(texto).length, texto.normalize('NFC').length)
    }
    assert.equal(ia.normalizar('Fogão AÇO Ótimo'), 'fogao aco otimo')
    assert.deepEqual(['mesas', 'celulares', 'colchoes', 'cadeiras', 'tenis', 'ps4'].map(ia.singular), ['mesa', 'celular', 'colchao', 'cadeira', 'tenis', 'ps4'])
    assert.deepEqual(ia.palavras('Colchões e MESAS de jantar'), ['colchao', 'e', 'mesa', 'de', 'jantar'])
  })

  test('descobre o tipo pelo título e separa acessório e variação', () => {
    const tipo = (t) => { const d = ia.descobrirTipo(t); return [d.tipo?.id ?? null, d.variante?.id ?? null, d.acessorio] }
    assert.deepEqual(tipo('iPhone 11 com capa e película'), ['celular', null, false])
    assert.deepEqual(tipo('Capa para iPhone 11'), ['celular', null, true])
    assert.deepEqual(tipo('Galaxy Tab A7'), ['tablet', null, false])
    assert.deepEqual(tipo('Samsung Galaxy A15 128GB'), ['celular', null, false])
    assert.deepEqual(tipo('Suporte de TV 42"'), ['tv', null, true])
    assert.deepEqual(tipo('Mesa com 4 cadeiras'), ['mesa', null, false])
    assert.deepEqual(tipo('Escrivaninha com gaveta'), ['mesa', 'escritorio', false])
    assert.deepEqual(tipo('Bike infantil'), ['bicicleta', 'infantil', false])
    assert.deepEqual(tipo('PS4 Slim com 2 controles'), ['videogame', 'ps4', false])
    assert.deepEqual(tipo('Micro-ondas Electrolux 20L'), ['microondas', null, false])
    assert.deepEqual(tipo('Livro de cálculo'), [null, null, false])
    assert.deepEqual(tipo('Moto G54 128GB'), ['celular', null, false])
    assert.deepEqual(tipo('Redmi Note 12'), ['celular', null, false])
    assert.deepEqual(tipo('Moto Honda CG 160'), [null, null, false])
  })

  test('lê as características do tipo e ignora as negadas', () => {
    const carac = (titulo, descricao) => ia.lerAnuncio({ titulo, descricao }).caracteristicas
    assert.deepEqual(carac('Bicicleta aro 29', '21 marchas, quadro de alumínio, freio a disco e suspensão. Revisada.'), ['Aro 29', '21 marchas', 'Alumínio', 'Freio a disco', 'Suspensão', 'Revisada'])
    assert.deepEqual(carac('Bicicleta aro 26', 'Sem suspensão, quadro de aço.'), ['Aro 26', 'Aço'])
    assert.deepEqual(carac('Moto G54', '128GB, 8GB de RAM, bateria 89%, 5G, dual chip, com caixa e nota fiscal.'), ['128 GB', '8 GB de RAM', 'Bateria 89%', '5G', 'Dual chip', 'Com caixa', 'Com nota fiscal'])
    assert.deepEqual(carac('Smart TV 50" 4K', 'Sem garantia.'), ['50 polegadas', 'Smart', '4K'])
  })

  test('acha os defeitos citados, com as palavras de perto, e não conta os negados', () => {
    const atencao = (descricao) => ia.lerAnuncio({ titulo: 'Celular Moto G', descricao }).atencao
    assert.deepEqual(ia.lerAnuncio({ titulo: 'Bicicleta', descricao: 'Aro 26. Pneu traseiro gasto.' }).atencao, ['Pneu traseiro gasto'])
    assert.deepEqual(atencao('Tela trincada no canto, mas funciona.'), ['Tela trincada'])
    assert.deepEqual(atencao('Arranhões na tampa e na tela. Bateria viciada mas liga.'), ['Arranhões na tampa', 'Bateria viciada'])
    assert.deepEqual(atencao('Não liga. Vendo para peças.'), ['Não liga'])
    assert.deepEqual(atencao('Sem arranhões, sem riscos, nenhum defeito, zero manchas.'), [])
    assert.deepEqual(atencao('Possui pequeno amassado na lateral.'), ['Pequeno amassado'])
    // a negação vale para a lista toda, mas para no fim da frase e num "mas"
    assert.deepEqual(atencao('Sem riscos, amassados ou manchas.'), [])
    assert.deepEqual(atencao('Sem uso, mas tem um risco na lateral.'), ['Risco na lateral'])
    const oggi = ia.lerAnuncio({ titulo: 'Bicicleta aro 29', descricao: 'Revisada mês passado, nenhum defeito. Acompanha nota fiscal.' })
    assert.deepEqual([oggi.caracteristicas, oggi.atencao], [['Aro 29', 'Revisada', 'Com nota fiscal'], []])
  })
})

describe('IA: nota de custo-benefício', () => {
  const grupo = [
    { id: 1, titulo: 'Bicicleta aro 29 Caloi', preco: 450, condicao: 'seminovo', total_fotos: 6, distancia_km: 1.2, descricao: 'Bicicleta aro 29, 21 marchas, quadro de alumínio e freio a disco. Pouco usada, sem arranhões, pneus novos. Retiro no Centro.' },
    { id: 2, titulo: 'Bicicleta Monark aro 26', preco: 380, condicao: 'usado', total_fotos: 2, distancia_km: 4.8, descricao: 'Aro 26, 18 marchas, quadro de aço. Pneu traseiro gasto.' },
    { id: 3, titulo: 'Bicicleta Oggi aro 29', preco: 520, condicao: 'seminovo', total_fotos: 8, distancia_km: 2.5, descricao: 'Aro 29 com 24 marchas, quadro de alumínio e suspensão dianteira. Revisada mês passado, tudo funcionando, nenhum defeito. Acompanha nota fiscal.' },
  ]

  test('nem sempre o mais barato é o melhor: a bicicleta de R$ 450 ganha da de R$ 380', () => {
    const { precos, anuncios: avaliados } = ia.avaliarGrupo(grupo)
    assert.deepEqual(precos, { menor: 380, media: 450, maior: 520 })
    const porId = Object.fromEntries(avaliados.map((a) => [a.id, a]))
    assert.equal(porId[1].melhor, true)
    assert.equal(avaliados.filter((a) => a.melhor).length, 1)
    assert.ok(porId[1].nota > porId[3].nota && porId[3].nota > porId[2].nota, JSON.stringify(avaliados.map((a) => [a.id, a.nota])))
    assert.deepEqual(porId[1].faixa, { tipo: 'media', diferenca: 0 })
    assert.deepEqual(porId[2].faixa, { tipo: 'abaixo', diferenca: 70 })
    assert.deepEqual(porId[3].faixa, { tipo: 'acima', diferenca: 70 })
    for (const a of avaliados) {
      assert.ok(a.nota >= 0 && a.nota <= 10)
      for (const parte of Object.values(a.partes)) assert.ok(parte >= 0 && parte <= 100)
    }
  })

  test('o motivo explica com o que o vendedor escreveu', () => {
    const porId = Object.fromEntries(ia.avaliarGrupo(grupo).anuncios.map((a) => [a.id, a]))
    assert.equal(porId[1].motivo, 'Preço na média, estado seminovo, a 1,2 km e 6 fotos. Destaque: freio a disco.')
    assert.equal(porId[2].motivo, 'Menor preço (R$ 70 abaixo da média), mas estado usado, o vendedor cita pneu traseiro gasto e só 2 fotos.')
    assert.match(porId[3].motivo, /^Estado seminovo e 8 fotos, mas R\$ 70 acima da média\. Destaques: suspensão e revisada\.$/)
  })

  test('os pesos somam 100%; anúncio sozinho não ganha o selo de melhor', () => {
    assert.equal(Math.round(Object.values(ia.PESOS).reduce((s, p) => s + p, 0) * 100), 100)
    assert.equal(ia.avaliarGrupo([grupo[0]]).anuncios[0].melhor, false)
    assert.deepEqual(ia.avaliarGrupo([]), { precos: null, anuncios: [] })
  })

  test('separa da conta o que não é do mesmo tipo, com o motivo', () => {
    const { tipo, parecidos, fora } = ia.separarParecidos('bicicleta', [
      ...grupo,
      { id: 4, titulo: 'Bicicleta infantil aro 16', preco: 150, descricao: '' },
      { id: 5, titulo: 'Capacete para bicicleta', preco: 60, descricao: '' },
      { id: 6, titulo: 'Bicicleta aro 20', preco: 200, descricao: '' },
    ])
    assert.equal(tipo.nome, 'Bicicleta')
    assert.deepEqual(parecidos.map((a) => a.id), [1, 2, 3])
    assert.deepEqual(fora.map((f) => [f.id, f.motivo]), [[4, 'não é do mesmo tipo (infantil)'], [5, 'é acessório, não o produto'], [6, 'não é do mesmo tipo (infantil)']])
  })
})

describe('IA: lista de compras', () => {
  test('entende o que a pessoa escreveu (tipo, variação, estado e valor máximo)', () => {
    const entendi = (t) => { const i = ia.entenderItem(t); return [i.tipo?.id ?? null, i.variante?.id ?? null, i.condicao, i.precoMax, i.entendi] }
    assert.deepEqual(entendi('Celular usado até R$ 800'), ['celular', null, 'usado', 800, ['Celular', 'Usado', 'Até R$ 800']])
    assert.deepEqual(entendi('Mesa de escritório'), ['mesa', 'escritorio', null, null, ['Mesa', 'Escritório']])
    assert.deepEqual(entendi('notebook i5 até 2 mil'), ['notebook', null, null, 2000, ['Notebook', 'Até R$ 2.000']])
    assert.deepEqual(entendi('geladeira frost free ate 1.500,00'), ['geladeira', null, null, 1500, ['Geladeira', 'Até R$ 1.500']])
    assert.deepEqual(entendi('Fone até R$ 99,90'), [null, null, null, 99.9, ['Fone', 'Até R$ 99,90']])
    assert.deepEqual(entendi('Quero um PS4 seminovo por até 1200 reais'), ['videogame', 'ps4', 'seminovo', 1200, ['Videogame', 'PS4', 'Seminovo', 'Até R$ 1.200']])
    assert.deepEqual(ia.entenderItem('Violão Yamaha').termos, ['violao', 'yamaha'])
  })

  test('combina pelo tipo, a variação, o estado e o preço (acessório nunca entra)', () => {
    const item = ia.entenderItem('Celular usado até R$ 800')
    assert.equal(ia.combinaComItem(item, { titulo: 'iPhone 11 64GB', preco: 790, condicao: 'seminovo' }), true)
    assert.equal(ia.combinaComItem(item, { titulo: 'iPhone 11 64GB', preco: 850, condicao: 'usado' }), false)
    assert.equal(ia.combinaComItem(item, { titulo: 'Capa para iPhone 11', preco: 30, condicao: 'novo' }), false)
    assert.equal(ia.combinaComItem(item, { titulo: 'Moto G54 lacrado', preco: 700, condicao: 'novo' }), false)
    const escritorio = ia.entenderItem('Mesa de escritório')
    assert.equal(ia.combinaComItem(escritorio, { titulo: 'Escrivaninha 120 cm', preco: 180 }), true)
    assert.equal(ia.combinaComItem(escritorio, { titulo: 'Mesa de jantar 4 lugares', preco: 400 }), false)
    assert.equal(ia.combinaComItem(ia.entenderItem('Mesa'), { titulo: 'Mesa de jantar 4 lugares', preco: 400 }), true)
    // variação especial só para quem pediu: "Bicicleta" não traz a infantil; "bicicleta infantil" traz
    assert.equal(ia.combinaComItem(ia.entenderItem('Bicicleta'), { titulo: 'Bicicleta infantil aro 16', preco: 150 }), false)
    assert.equal(ia.combinaComItem(ia.entenderItem('Bicicleta'), { titulo: 'Bicicleta aro 20', preco: 150 }), false)
    assert.equal(ia.combinaComItem(ia.entenderItem('bicicleta infantil'), { titulo: 'Bicicleta aro 16 para criança', preco: 150 }), true)
    assert.equal(ia.combinaComItem(ia.entenderItem('Videogame'), { titulo: 'PS5 com 2 controles', preco: 3000 }), true)
    const violao = ia.entenderItem('Violão Yamaha')
    assert.equal(ia.combinaComItem(violao, { titulo: 'Violão', descricao: 'Yamaha C40, cordas novas.', preco: 500 }), true)
    assert.equal(ia.combinaComItem(violao, { titulo: 'Violão Giannini', descricao: '', preco: 300 }), false)
  })
})

describe('IA: só dados públicos', () => {
  test('a IA recebe só o que qualquer pessoa vê no anúncio (nada do vendedor nem de quem busca)', () => {
    const card = { id: 9, titulo: 'X', preco: 10, condicao: 'novo', categoria_id: 1, distancia_km: 2, usuario_id: 5, email: 'a@b.com', telefone: '31999999999', vendedor: { nome: 'Fulano' }, latitude: -20.7 }
    const entrada = paraAIA(card, { descricao: 'd', total_fotos: 2, vendedor: { nome: 'Fulano', email: 'a@b.com' } })
    assert.deepEqual(Object.keys(entrada).sort(), ['categoria_id', 'condicao', 'descricao', 'distancia_km', 'id', 'preco', 'titulo', 'total_fotos'])
  })
})

describe('Comparador na busca (API)', () => {
  test('compara as parecidas da busca, com menor preço, média e maior; infantil e capacete ficam fora', async () => {
    const r = await chamar('GET', `/comparacao/busca?busca=zorbix&${LOCAL}`)
    assert.equal(r.status, 200, r.texto)
    assert.equal(r.dados.tipo.nome, 'Bicicleta')
    assert.deepEqual(r.dados.precos, { menor: 380, media: 450, maior: 520 })
    assert.deepEqual(r.dados.anuncios.map((a) => a.id), [ids.a, ids.c, ids.b]) // pela nota
    assert.equal(r.dados.anuncios[0].melhor, true)
    assert.deepEqual(r.dados.fora.map((f) => f.id).sort(), [ids.infantil, ids.capacete].sort())
    const b = r.dados.anuncios.find((a) => a.id === ids.b)
    assert.deepEqual(b.atencao, ['Pneu traseiro gasto'])
    assert.equal(b.total_fotos, 1)
    assert.equal(typeof b.distancia_km, 'number')
  })

  test('nada de dado sensível na resposta: o vendedor sai só com o que o perfil público mostra', async () => {
    const r = await chamar('GET', `/comparacao/busca?busca=zorbix&${LOCAL}`)
    for (const a of r.dados.anuncios) assert.deepEqual(Object.keys(a.vendedor).sort(), ['avaliacao', 'foto_url', 'id', 'nome', 'vinculo_academico'])
    assert.doesNotMatch(r.texto, /email|telefone|senha|latitude|longitude|@/i)
  })

  test('sem login também compara; com login vem o coração dos favoritos', async () => {
    assert.equal((await chamar('GET', `/comparacao/busca?busca=zorbix&${LOCAL}`)).dados.anuncios[0].favoritado, false)
    await chamar('POST', `/favoritos/${ids.a}`, { cookie: comprador })
    const r = await chamar('GET', `/comparacao/busca?busca=zorbix&${LOCAL}`, { cookie: comprador })
    assert.equal(r.dados.anuncios.find((a) => a.id === ids.a).favoritado, true)
    await chamar('DELETE', `/favoritos/${ids.a}`, { cookie: comprador })
  })

  test('busca sem termo, com um anúncio só ou sem parecidos não monta comparação', async () => {
    assert.deepEqual((await chamar('GET', `/comparacao/busca?${LOCAL}`)).dados.anuncios, [])
    assert.deepEqual((await chamar('GET', `/comparacao/busca?busca=capacete%20zorbix&${LOCAL}`)).dados.anuncios, [])
    assert.equal((await chamar('GET', `/comparacao/busca?busca=zorbix&cidade_id=999999`)).status, 404)
    assert.equal((await chamar('GET', '/comparacao/busca?busca=zorbix')).status, 400) // sem referência de local e sem login
    assert.equal((await chamar('GET', `/comparacao/busca?busca=${'x'.repeat(101)}`)).status, 400)
  })
})

describe('Comparação escolhida (API)', () => {
  test('compara de 2 a 4 anúncios, na ordem pedida', async () => {
    const r = await chamar('GET', `/comparacao?ids=${ids.b},${ids.a}&${LOCAL}`)
    assert.equal(r.status, 200, r.texto)
    assert.deepEqual(r.dados.anuncios.map((a) => a.id), [ids.b, ids.a])
    assert.equal(r.dados.tipo.plural, 'bicicletas')
    assert.equal(r.dados.anuncios.filter((a) => a.melhor).length, 1)
  })

  test('quantidade e ids inválidos respondem 400', async () => {
    for (const consulta of [`ids=${ids.a}`, `ids=${ids.a},${ids.b},${ids.c},${ids.infantil},${ids.capacete}`, `ids=${ids.a},abc`, 'ids=', `ids=${ids.a},-1`]) {
      assert.equal((await chamar('GET', `/comparacao?${consulta}`)).status, 400, consulta)
    }
  })

  test('em tempo real: preço novo entra na hora; vendido sai da comparação', async () => {
    assert.equal((await chamar('PUT', `/anuncios/${ids.b}`, { cookie: vendedor, json: { preco: 300 } })).status, 200)
    let r = await chamar('GET', `/comparacao/busca?busca=zorbix&${LOCAL}`)
    assert.equal(r.dados.precos.menor, 300)
    assert.equal(r.dados.anuncios.find((a) => a.id === ids.b).faixa.tipo, 'abaixo')

    assert.equal((await chamar('PATCH', `/anuncios/${ids.c}/status`, { cookie: vendedor, json: { status: 'vendido' } })).status, 200)
    r = await chamar('GET', `/comparacao/busca?busca=zorbix&${LOCAL}`)
    assert.deepEqual(r.dados.anuncios.map((a) => a.id).sort(), [ids.a, ids.b].sort())
    r = await chamar('GET', `/comparacao?ids=${ids.a},${ids.b},${ids.c}&${LOCAL}`)
    assert.deepEqual(r.dados.fora, [{ id: ids.c, titulo: null, motivo: 'não está mais à venda' }])
    assert.equal((await chamar('GET', `/comparacao?ids=${ids.a},${ids.c}`)).status, 404)
  })
})

describe('Lista de compras (API)', () => {
  test('precisa de login', async () => {
    assert.equal((await chamar('GET', '/lista-compras')).status, 401)
    assert.equal((await chamar('POST', '/lista-compras', { json: { texto: 'Celular' } })).status, 401)
    assert.equal((await chamar('PATCH', '/lista-compras/1', { json: { comprado: true } })).status, 401)
    assert.equal((await chamar('DELETE', '/lista-compras/1')).status, 401)
  })

  test('valida o texto, a cidade e não deixa repetir', async () => {
    for (const texto of [undefined, '', '   ', 'a', 'x'.repeat(81), 123, '??', 'até R$ 50']) {
      assert.equal((await chamar('POST', '/lista-compras', { cookie: comprador, json: { texto } })).status, 400, String(texto))
    }
    assert.equal((await chamar('POST', '/lista-compras', { cookie: comprador, json: { texto: 'Bicicleta', cidade_id: 999999 } })).status, 400)
    const r = await chamar('POST', '/lista-compras', { cookie: comprador, json: { texto: 'Bicicleta até R$ 500', cidade_id: 1 } })
    assert.equal(r.status, 201, r.texto)
    assert.deepEqual(r.dados.entendi, ['Bicicleta', 'Até R$ 500'])
    assert.equal((await chamar('POST', '/lista-compras', { cookie: comprador, json: { texto: '  bicicleta ATÉ r$ 500 ' } })).status, 409)
  })

  test('mostra os anúncios que combinam, com a nota, e o total pelos melhores de cada item', async () => {
    const r = await chamar('GET', `/lista-compras?${LOCAL}`, { cookie: comprador })
    assert.equal(r.status, 200, r.texto)
    const item = r.dados.itens.find((i) => i.texto === 'Bicicleta até R$ 500')
    const nossos = item.anuncios.filter((a) => anuncios.includes(a.id)).map((a) => a.id)
    assert.ok(nossos.includes(ids.a) && nossos.includes(ids.b), JSON.stringify(item))
    assert.ok(!nossos.includes(ids.infantil) && !nossos.includes(ids.capacete)) // variação e acessório: não; vendida (C): também não
    assert.ok(item.anuncios.every((a) => a.preco <= 500 && typeof a.nota === 'number'))
    assert.ok(item.total >= 2)
    assert.equal(r.dados.total_estimado, r.dados.itens.filter((i) => i.anuncios.length).reduce((s, i) => s + i.anuncios[0].preco, 0))
    assert.doesNotMatch(r.texto, /email|telefone|@/i)
  })

  test('os próprios anúncios não aparecem na lista de quem anunciou', async () => {
    assert.equal((await chamar('POST', '/lista-compras', { cookie: vendedor, json: { texto: 'Bicicleta', cidade_id: 1 } })).status, 201)
    const r = await chamar('GET', `/lista-compras?${LOCAL}`, { cookie: vendedor })
    assert.ok(r.dados.itens[0].anuncios.every((a) => !anuncios.includes(a.id)), JSON.stringify(r.dados.itens[0].anuncios))
  })

  test('a lista é particular: outra pessoa não vê, não marca e não apaga', async () => {
    const meu = (await chamar('GET', `/lista-compras?${LOCAL}`, { cookie: comprador })).dados.itens[0]
    assert.ok(!(await chamar('GET', `/lista-compras?${LOCAL}`, { cookie: outro })).dados.itens.some((i) => i.id === meu.id))
    assert.equal((await chamar('PATCH', `/lista-compras/${meu.id}`, { cookie: outro, json: { comprado: true } })).status, 404)
    assert.equal((await chamar('DELETE', `/lista-compras/${meu.id}`, { cookie: outro })).status, 404)
    assert.equal((await chamar('GET', `/lista-compras?${LOCAL}`, { cookie: comprador })).dados.itens[0].comprado, false)
  })

  test('marcar como comprado (só true ou false); o comprado não busca anúncios', async () => {
    const meu = (await chamar('GET', `/lista-compras?${LOCAL}`, { cookie: comprador })).dados.itens[0]
    for (const comprado of ['sim', 1, null, undefined]) {
      assert.equal((await chamar('PATCH', `/lista-compras/${meu.id}`, { cookie: comprador, json: { comprado } })).status, 400)
    }
    assert.equal((await chamar('PATCH', `/lista-compras/${meu.id}`, { cookie: comprador, json: { comprado: true } })).dados.comprado, true)
    const depois = (await chamar('GET', `/lista-compras?${LOCAL}`, { cookie: comprador })).dados.itens.find((i) => i.id === meu.id)
    assert.equal(depois.comprado, true)
    assert.deepEqual(depois.anuncios, [])
    assert.equal((await chamar('PATCH', `/lista-compras/${meu.id}`, { cookie: comprador, json: { comprado: false } })).dados.comprado, false)
    assert.equal((await chamar('PATCH', '/lista-compras/abc', { cookie: comprador, json: { comprado: true } })).status, 400)
  })

  test('no máximo 30 itens', async () => {
    const ja = (await chamar('GET', `/lista-compras?${LOCAL}`, { cookie: outro })).dados.itens.length
    for (let i = ja; i < 30; i += 1) assert.equal((await chamar('POST', '/lista-compras', { cookie: outro, json: { texto: `Livro número ${i}` } })).status, 201)
    assert.equal((await chamar('POST', '/lista-compras', { cookie: outro, json: { texto: 'Livro número 31' } })).status, 409)
    for (const item of (await chamar('GET', `/lista-compras?${LOCAL}`, { cookie: outro })).dados.itens) {
      assert.equal((await chamar('DELETE', `/lista-compras/${item.id}`, { cookie: outro })).status, 204)
    }
    assert.equal((await chamar('DELETE', '/lista-compras/999999', { cookie: outro })).status, 404)
  })

  test('aviso em tempo real: anúncio novo que combina avisa a dona do item, e só ela', async () => {
    // a compradora quer bicicleta até R$ 600 em Viçosa; o Diego quer bicicleta em Juiz de Fora (longe); o vendedor tem o item, mas o anúncio é dele
    assert.equal((await chamar('POST', '/lista-compras', { cookie: comprador, json: { texto: 'Bicicleta até R$ 600', cidade_id: 1 } })).status, 201)
    assert.equal((await chamar('POST', '/lista-compras', { cookie: outro, json: { texto: 'Bicicleta', cidade_id: 57 } })).status, 201)
    ids.nova = await publicar({ titulo: 'Bicicleta Zorbix aro 29 Sense', preco: 550, condicao: 'seminovo', descricao: 'Aro 29, 24 marchas, freio a disco.' }, 2)
    const aviso = await esperarAviso(comprador, (n) => n.tipo === 'lista_compras' && n.anuncio_id === ids.nova)
    assert.ok(aviso, 'a compradora não recebeu o aviso')
    assert.match(aviso.titulo, /^Apareceu na sua lista de compras: Bicicleta Zorbix aro 29 Sense/)
    assert.match(aviso.texto, /^Bicicleta até R\$ 600 · R\$\s550,00 · Centro, Viçosa$/)
    await new Promise((ok) => setTimeout(ok, 300))
    assert.ok(!(await avisosDe(outro)).some((n) => n.tipo === 'lista_compras' && n.anuncio_id === ids.nova), 'avisou quem está longe')
    assert.ok(!(await avisosDe(vendedor)).some((n) => n.tipo === 'lista_compras'), 'avisou o próprio vendedor (a lista é particular)')
  })

  test('anúncio editado que passou a combinar (o preço baixou) avisa uma vez só', async () => {
    ids.caro = await publicar({ titulo: 'Bicicleta Zorbix Houston aro 29', preco: 900, condicao: 'usado', descricao: 'Aro 29, 21 marchas.' }, 1)
    await new Promise((ok) => setTimeout(ok, 300))
    assert.ok(!(await avisosDe(comprador)).some((n) => n.anuncio_id === ids.caro), 'avisou com o preço acima do máximo')
    assert.equal((await chamar('PUT', `/anuncios/${ids.caro}`, { cookie: vendedor, json: { preco: 590 } })).status, 200)
    const aviso = await esperarAviso(comprador, (n) => n.tipo === 'lista_compras' && n.anuncio_id === ids.caro)
    assert.ok(aviso, 'não avisou quando o preço baixou')
    assert.match(aviso.titulo, /^Agora combina com a sua lista de compras/)
    assert.equal((await chamar('PUT', `/anuncios/${ids.caro}`, { cookie: vendedor, json: { preco: 580 } })).status, 200)
    await new Promise((ok) => setTimeout(ok, 300))
    assert.equal((await avisosDe(comprador)).filter((n) => n.anuncio_id === ids.caro).length, 1)
  })
})
