// Testes das rotas da Marina (anúncios, fotos e favoritos), conferindo o Contrato da API.
// Com o MySQL ligado: npm run banco e depois npm test.
// O dono dos anúncios aqui é o Usuário Teste (3): o api.test.js roda junto e confere os números
// do Diego e da Larissa, então este arquivo não cria nem favorita nada em nome deles.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'

const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { PASTA_UPLOADS } = await import('../src/utils/fotos.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const base = `http://127.0.0.1:${servidor.address().port}/api`

const criados = new Set()
let dono // Usuário Teste (3)
let outro // Diego (1)

async function chamar(metodo, caminho, { cookie, json, form } = {}) {
  const headers = {}
  if (cookie) headers.Cookie = cookie
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    body = form
  }
  const resposta = await fetch(base + caminho, { method: metodo, headers, body })
  const texto = await resposta.text()
  let dados = texto
  try {
    dados = texto ? JSON.parse(texto) : null
  } catch {
    // não é JSON
  }
  return { status: resposta.status, dados }
}

async function entrarComo(usuarioId) {
  const resposta = await fetch(`${base}/auth/teste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: usuarioId }),
  })
  assert.equal(resposta.status, 200, `O login de teste do usuário ${usuarioId} falhou. Rodou o npm run banco?`)
  return resposta.headers.get('set-cookie').split(';')[0]
}

const fotoPng = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#2E9E4F' } })
  .png()
  .toBuffer()

const CAMPOS_VALIDOS = {
  titulo: 'Cadeira de escritório',
  descricao: 'Usada por 1 ano.',
  preco: '250.5',
  categoria_id: '1', // Casa
  subcategoria_id: '1', // Móveis
  bairro_id: '1', // Centro, Viçosa
  condicao: 'usado',
  forma_entrega: 'retirada',
}

function formulario(campos, { fotos = 1, conteudo = fotoPng, tipo = 'image/png' } = {}) {
  const form = new FormData()
  for (const [campo, valor] of Object.entries(campos)) form.append(campo, String(valor))
  for (let i = 0; i < fotos; i++) form.append('fotos', new Blob([conteudo], { type: tipo }), `foto${i}.png`)
  return form
}

async function publicar(campos = CAMPOS_VALIDOS, opcoes) {
  const resposta = await chamar('POST', '/anuncios', { cookie: dono, form: formulario(campos, opcoes) })
  if (resposta.status === 201) criados.add(resposta.dados.id)
  return resposta
}

async function arquivosNaPasta(anuncioId) {
  try {
    return (await fs.readdir(path.join(PASTA_UPLOADS, 'anuncios', String(anuncioId)))).length
  } catch {
    return 0
  }
}

before(async () => {
  dono = await entrarComo(3)
  outro = await entrarComo(1)
})

after(async () => {
  for (const id of criados) {
    await db.query('DELETE FROM anuncio WHERE id = ?', [id])
    await fs.rm(path.join(PASTA_UPLOADS, 'anuncios', String(id)), { recursive: true, force: true })
  }
  await db.query('DELETE FROM favorito WHERE usuario_id = 3')
  servidor.close()
  servidor.closeAllConnections()
  await db.end()
})

describe('M1. Publicar anúncio', () => {
  test('201 no formato do M2, com 3 WebP por foto e o vendedor sem telefone e e-mail', async () => {
    const { status, dados } = await publicar(CAMPOS_VALIDOS, { fotos: 2 })
    assert.equal(status, 201, JSON.stringify(dados))

    assert.equal(dados.titulo, 'Cadeira de escritório')
    assert.equal(dados.preco, 250.5)
    assert.equal(dados.status, 'ativo')
    assert.equal(dados.categoria, 'Casa')
    assert.equal(dados.subcategoria, 'Móveis')
    assert.equal(dados.bairro, 'Centro')
    assert.equal(dados.cidade, 'Viçosa')
    assert.equal(dados.uf, 'MG')
    assert.deepEqual(Object.keys(dados.vendedor).sort(), ['criado_em', 'foto_url', 'id', 'nome'])
    assert.equal(dados.vendedor.id, 3)
    assert.equal(dados.eh_meu, true)
    assert.equal(dados.favoritado, false)

    assert.deepEqual(
      dados.fotos.map((foto) => foto.ordem),
      [0, 1],
    )
    assert.match(dados.fotos[0].pequena, new RegExp(`^/api/uploads/anuncios/${dados.id}/[a-f0-9]{32}-400\\.webp$`))
    assert.equal(await arquivosNaPasta(dados.id), 6)

    // a foto de 2000 px vira 400, 800 e 1600; a foto servida abre
    const grande = await fetch(base.replace('/api', '') + dados.fotos[0].grande)
    assert.equal(grande.status, 200)
    assert.equal((await sharp(Buffer.from(await grande.arrayBuffer())).metadata()).width, 1600)
  })

  test('Serviços pode ficar sem condição', async () => {
    const { status, dados } = await publicar({
      ...CAMPOS_VALIDOS,
      categoria_id: '7',
      subcategoria_id: '26',
      condicao: '',
    })
    assert.equal(status, 201, JSON.stringify(dados))
    assert.equal(dados.condicao, null)
  })

  test('dado inválido é 400 (nunca 500) e não sobra anúncio nem pasta', async () => {
    const [{ total: antes }] = (await db.query('SELECT COUNT(*) AS total FROM anuncio WHERE usuario_id = 3'))[0]

    const casos = {
      'sem foto': [CAMPOS_VALIDOS, { fotos: 0 }],
      'categoria que não existe': [{ ...CAMPOS_VALIDOS, categoria_id: '999', subcategoria_id: '' }],
      'bairro que não existe': [{ ...CAMPOS_VALIDOS, bairro_id: '999' }],
      'subcategoria de outra categoria (Casa + Celulares)': [{ ...CAMPOS_VALIDOS, subcategoria_id: '5' }],
      'sem condição fora de Serviços': [{ ...CAMPOS_VALIDOS, condicao: '' }],
      'preço zero': [{ ...CAMPOS_VALIDOS, preco: '0' }],
      'preço que arredonda para zero': [{ ...CAMPOS_VALIDOS, preco: '0.001' }],
      'preço maior que o banco aceita': [{ ...CAMPOS_VALIDOS, preco: '1000000000' }],
      'título curto': [{ ...CAMPOS_VALIDOS, titulo: 'ab' }],
      'arquivo que diz ser PNG mas não é imagem': [CAMPOS_VALIDOS, { conteudo: Buffer.from('não sou foto') }],
      'GIF': [CAMPOS_VALIDOS, { tipo: 'image/gif' }],
      '9 fotos': [CAMPOS_VALIDOS, { fotos: 9 }],
    }

    for (const [caso, [campos, opcoes]] of Object.entries(casos)) {
      const { status, dados } = await publicar(campos, opcoes)
      assert.equal(status, 400, `${caso}: ${JSON.stringify(dados)}`)
      assert.equal(typeof dados.erro, 'string', caso)
    }

    const [{ total: depois }] = (await db.query('SELECT COUNT(*) AS total FROM anuncio WHERE usuario_id = 3'))[0]
    assert.equal(depois, antes, 'sobrou anúncio de publicação que falhou')
  })

  test('sem login é 401', async () => {
    assert.equal((await chamar('POST', '/anuncios', { form: formulario(CAMPOS_VALIDOS) })).status, 401)
  })
})

describe('M2. Ver anúncio', () => {
  test('sem login abre e soma 1 visualização; o dono vendo não soma', async () => {
    const { dados: anuncio } = await publicar()

    const primeira = await chamar('GET', `/anuncios/${anuncio.id}`)
    assert.equal(primeira.status, 200)
    assert.equal(primeira.dados.visualizacoes, 1)
    assert.equal(primeira.dados.eh_meu, false)
    assert.equal(primeira.dados.favoritado, false)

    const doDono = await chamar('GET', `/anuncios/${anuncio.id}`, { cookie: dono })
    assert.equal(doDono.dados.visualizacoes, 1)
    assert.equal(doDono.dados.eh_meu, true)

    const deOutro = await chamar('GET', `/anuncios/${anuncio.id}`, { cookie: outro })
    assert.equal(deOutro.dados.visualizacoes, 2)
    assert.equal(deOutro.dados.eh_meu, false)
  })

  test('não existe: 404; id inválido: 400', async () => {
    assert.equal((await chamar('GET', '/anuncios/999999')).status, 404)
    assert.equal((await chamar('GET', '/anuncios/abc')).status, 400)
  })
})

describe('M3. Meus anúncios', () => {
  test('cards do Contrato, com visualizacoes e total_favoritos', async () => {
    const { dados: anuncio } = await publicar()
    const { status, dados } = await chamar('GET', '/meus-anuncios', { cookie: dono })
    assert.equal(status, 200)

    const card = dados.find((item) => item.id === anuncio.id)
    assert.deepEqual(Object.keys(card).sort(), [
      'bairro',
      'cidade',
      'condicao',
      'data_publicacao',
      'favoritado',
      'foto_capa',
      'id',
      'preco',
      'status',
      'titulo',
      'total_favoritos',
      'uf',
      'visualizacoes',
    ])
    assert.equal(card.foto_capa.ordem, 0)
    assert.equal(card.total_favoritos, 0)

    // anúncio do seed, sem foto: foto_capa null
    const doDiego = await chamar('GET', '/meus-anuncios', { cookie: outro })
    assert.equal(doDiego.dados.find((item) => item.id === 1).foto_capa, null)
  })
})

describe('M4 a M6. Editar, vendido e excluir', () => {
  test('editar: só o dono; valida igual ao M1; trocar a categoria limpa a subcategoria', async () => {
    const { dados: anuncio } = await publicar()

    assert.equal((await chamar('PUT', `/anuncios/${anuncio.id}`, { cookie: outro, json: { titulo: 'Invadido' } })).status, 403)
    assert.equal((await chamar('PUT', `/anuncios/${anuncio.id}`, { cookie: dono })).status, 400, 'sem corpo')
    assert.equal((await chamar('PUT', `/anuncios/${anuncio.id}`, { cookie: dono, json: {} })).status, 400)
    assert.equal((await chamar('PUT', `/anuncios/${anuncio.id}`, { cookie: dono, json: { preco: -1 } })).status, 400)
    assert.equal(
      (await chamar('PUT', `/anuncios/${anuncio.id}`, { cookie: dono, json: { subcategoria_id: 5 } })).status,
      400,
      'subcategoria de outra categoria',
    )

    const editado = await chamar('PUT', `/anuncios/${anuncio.id}`, {
      cookie: dono,
      json: { titulo: '  Fone Bluetooth  ', categoria_id: 2 },
    })
    assert.equal(editado.status, 200, JSON.stringify(editado.dados))
    assert.equal(editado.dados.titulo, 'Fone Bluetooth')
    assert.equal(editado.dados.categoria, 'Eletrônicos')
    assert.equal(editado.dados.subcategoria_id, null)
    assert.ok(editado.dados.atualizado_em)
  })

  test('vendido: só o dono; continua em Meus anúncios', async () => {
    const { dados: anuncio } = await publicar()

    assert.equal((await chamar('PATCH', `/anuncios/${anuncio.id}/status`, { cookie: dono })).status, 400, 'sem corpo')
    assert.equal(
      (await chamar('PATCH', `/anuncios/${anuncio.id}/status`, { cookie: outro, json: { status: 'vendido' } })).status,
      403,
    )

    const vendido = await chamar('PATCH', `/anuncios/${anuncio.id}/status`, { cookie: dono, json: { status: 'vendido' } })
    assert.equal(vendido.status, 200)
    assert.equal(vendido.dados.status, 'vendido')

    const meus = await chamar('GET', '/meus-anuncios', { cookie: dono })
    assert.equal(meus.dados.find((item) => item.id === anuncio.id).status, 'vendido')
  })

  test('excluir: só o dono; 204 e a pasta de fotos some', async () => {
    const { dados: anuncio } = await publicar()

    assert.equal((await chamar('DELETE', `/anuncios/${anuncio.id}`, { cookie: outro })).status, 403)

    const excluido = await chamar('DELETE', `/anuncios/${anuncio.id}`, { cookie: dono })
    assert.equal(excluido.status, 204)
    assert.equal(await arquivosNaPasta(anuncio.id), 0)
    assert.equal((await chamar('GET', `/anuncios/${anuncio.id}`)).status, 404)
  })
})

describe('M8. Fotos na edição', () => {
  test('completa até 8, fica pelo menos 1 e a capa passa para a próxima', async () => {
    const { dados: anuncio } = await publicar(CAMPOS_VALIDOS, { fotos: 2 })
    const caminho = `/anuncios/${anuncio.id}/fotos`

    assert.equal((await chamar('POST', caminho, { cookie: outro, form: formulario({}) })).status, 403)
    assert.equal((await chamar('POST', caminho, { cookie: dono, form: formulario({}, { fotos: 7 }) })).status, 400, '2 + 7 passa de 8')

    const completou = await chamar('POST', caminho, { cookie: dono, form: formulario({}, { fotos: 6 }) })
    assert.equal(completou.status, 200)
    assert.equal(completou.dados.fotos.length, 8)
    assert.equal((await chamar('POST', caminho, { cookie: dono, form: formulario({}) })).status, 400, 'já tem 8')

    const [capa, segunda] = completou.dados.fotos
    assert.equal((await chamar('DELETE', `${caminho}/${capa.id}`, { cookie: outro })).status, 403)

    const semCapa = await chamar('DELETE', `${caminho}/${capa.id}`, { cookie: dono })
    assert.equal(semCapa.status, 200)
    assert.equal(semCapa.dados.fotos[0].id, segunda.id)
    assert.deepEqual(
      semCapa.dados.fotos.map((foto) => foto.ordem),
      [0, 1, 2, 3, 4, 5, 6],
    )
    assert.equal(await arquivosNaPasta(anuncio.id), 21)

    let fotos = semCapa.dados.fotos
    while (fotos.length > 1) {
      fotos = (await chamar('DELETE', `${caminho}/${fotos[0].id}`, { cookie: dono })).dados.fotos
    }
    const ultima = await chamar('DELETE', `${caminho}/${fotos[0].id}`, { cookie: dono })
    assert.equal(ultima.status, 400, 'a última foto não sai')
    assert.equal((await chamar('DELETE', `${caminho}/999999`, { cookie: dono })).status, 404)
  })
})

describe('M7. Favoritos', () => {
  test('201, depois 200; não favorita o próprio; lista paginada com filtro; remove com 204', async () => {
    const { dados: meu } = await publicar()

    assert.equal((await chamar('POST', `/favoritos/${meu.id}`, { cookie: dono })).status, 400, 'o próprio anúncio')
    assert.equal((await chamar('POST', '/favoritos/999999', { cookie: dono })).status, 404)

    assert.equal((await chamar('POST', '/favoritos/1', { cookie: dono })).status, 201) // Sofá, Casa
    assert.equal((await chamar('POST', '/favoritos/1', { cookie: dono })).status, 200)
    assert.equal((await chamar('POST', '/favoritos/7', { cookie: dono })).status, 201) // iPhone, Eletrônicos

    const todos = await chamar('GET', '/favoritos', { cookie: dono })
    assert.equal(todos.status, 200)
    assert.deepEqual(Object.keys(todos.dados).sort(), ['itens', 'pagina', 'por_pagina', 'total', 'total_paginas'])
    assert.equal(todos.dados.total, 2)
    assert.deepEqual(
      todos.dados.itens.map((card) => card.id),
      [7, 1],
      'salvos mais recentemente primeiro',
    )
    assert.equal(todos.dados.itens[0].favoritado, true)
    assert.equal(todos.dados.itens[0].bairro, 'Centro')

    const casa = await chamar('GET', '/favoritos?categoria_id=1', { cookie: dono })
    assert.deepEqual(
      casa.dados.itens.map((card) => card.id),
      [1],
    )

    const pagina2 = await chamar('GET', '/favoritos?pagina=2&por_pagina=1', { cookie: dono })
    assert.deepEqual(
      pagina2.dados.itens.map((card) => card.id),
      [1],
    )
    assert.equal(pagina2.dados.total_paginas, 2)

    assert.equal((await chamar('GET', '/favoritos?pagina=abc', { cookie: dono })).status, 400)

    const doDetalhe = await chamar('GET', '/anuncios/1', { cookie: dono })
    assert.equal(doDetalhe.dados.favoritado, true)
    await db.query('UPDATE anuncio SET visualizacoes = visualizacoes - 1 WHERE id = 1') // devolve a visualização do seed

    assert.equal((await chamar('DELETE', '/favoritos/1', { cookie: dono })).status, 204)
    assert.equal((await chamar('DELETE', '/favoritos/7', { cookie: dono })).status, 204)
    assert.equal((await chamar('GET', '/favoritos', { cookie: dono })).dados.total, 0)
  })
})
