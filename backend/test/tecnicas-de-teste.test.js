// Casos montados com as técnicas de teste: valor-limite, tabela de decisão, transição de
// estados e teste exploratório (combinações de filtros).
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const base = `http://127.0.0.1:${servidor.address().port}/api`

const CENTRO = { latitude: -20.752736, longitude: -42.881906 } // centro do bairro 1 (Centro de Viçosa)
const RAIO_ESFERA_M = 6370986 // raio da esfera do ST_Distance_Sphere (MySQL e MariaDB)
const aoSul = (ponto, metros) => ({ latitude: ponto.latitude - (metros / RAIO_ESFERA_M) * (180 / Math.PI), longitude: ponto.longitude })

let vendedor
let comprador
let foto
const criados = []

async function chamar(metodo, caminho, { cookie, json, form } = {}) {
  const headers = cookie ? { Cookie: cookie } : {}
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) body = form
  const r = await fetch(base + caminho, { method: metodo, headers, body })
  const texto = await r.text()
  return { status: r.status, dados: texto ? JSON.parse(texto) : null }
}

const entrarComo = async (id) => (await fetch(`${base}/auth/teste`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }),
})).headers.get('set-cookie').split(';')[0]

function formulario(campos, comFoto = true) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.append(k, String(v))
  if (comFoto) f.append('fotos', new Blob([foto], { type: 'image/jpeg' }), 'f.jpg')
  return f
}

async function publicar(campos) {
  const tudo = { titulo: 'Anúncio das técnicas de teste', preco: '450', categoria_id: '4', subcategoria_id: '15', bairro_id: '1', condicao: 'usado', forma_entrega: 'retirada', ...campos }
  const r = await chamar('POST', '/anuncios', { cookie: vendedor, form: formulario(tudo) })
  if (r.status === 201) criados.push(r.dados.id)
  return r
}

async function proximos(parametros) {
  const r = await chamar('GET', `/localizacao/proximos?${new URLSearchParams({ por_pagina: 50, ...parametros })}`)
  assert.equal(r.status, 200, JSON.stringify(r.dados))
  return r.dados
}

before(async () => {
  foto = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#3E8B22' } }).jpeg().toBuffer()
  vendedor = await entrarComo(3)
  comprador = await entrarComo(2)
  await db.query('DELETE FROM localizacao_usuario WHERE usuario_id IN (2, 3)')
})

after(async () => {
  for (const id of criados) await chamar('DELETE', `/anuncios/${id}`, { cookie: vendedor })
  await db.query('DELETE FROM localizacao_usuario WHERE usuario_id IN (2, 3)')
  await db.query('DELETE FROM preferencia_localizacao WHERE usuario_id IN (2, 3)')
  servidor.closeAllConnections()
  servidor.close()
  await db.end()
})

describe('Valor-limite', () => {
  test('raio de 5 km: anúncio a 4,99 km aparece, a 5,00 km aparece e a 5,01 km não aparece', async () => {
    const { dados: anuncio } = await publicar({ bairro_id: '1' })
    for (const [metros, aparece] of [[4990, true], [5000, true], [5010, false]]) {
      const origem = aoSul(CENTRO, metros)
      const r = await proximos({ latitude: origem.latitude.toFixed(9), longitude: origem.longitude.toFixed(9), raio_km: 5 })
      const achado = r.itens.find((a) => a.id === anuncio.id)
      assert.equal(Boolean(achado), aparece, `${metros} m`)
      if (achado) assert.equal(achado.distancia_km, Number((metros / 1000).toFixed(1)))
    }
  })

  test('raio no limite: 1 e 300 km valem; 0 e 301 não', async () => {
    assert.equal((await chamar('GET', '/localizacao/proximos?cidade_id=1&raio_km=1')).status, 200)
    assert.equal((await chamar('GET', '/localizacao/proximos?cidade_id=1&raio_km=300')).status, 200)
    assert.equal((await chamar('GET', '/localizacao/proximos?cidade_id=1&raio_km=0')).status, 400)
    assert.equal((await chamar('GET', '/localizacao/proximos?cidade_id=1&raio_km=301')).status, 400)
  })

  test('coordenadas nos limites do planeta e no zero', async () => {
    const extremos = await chamar('GET', '/localizacao/distancia?de_latitude=90&de_longitude=180&para_latitude=-90&para_longitude=-180')
    assert.equal(extremos.status, 200, 'os limites válidos são aceitos')
    assert.ok(Math.abs(extremos.dados.distancia_km - 20015.1) < 1, 'de polo a polo')
    assert.equal((await chamar('GET', '/localizacao/distancia?de_latitude=90.0000001&de_longitude=0&para_latitude=0&para_longitude=1')).status, 400)
    assert.equal((await chamar('GET', '/localizacao/proximos?latitude=0&longitude=-42.88')).status, 422, 'latitude zero fica fora da região')
    assert.equal((await chamar('GET', '/localizacao/proximos?latitude=-20.75&longitude=0')).status, 422, 'longitude zero fica fora da região')
    assert.equal((await chamar('GET', '/localizacao/proximos?latitude=0&longitude=0')).status, 400, '0,0 é recusado')
  })

  test('divisa entre cidades: ponto dentro da cidade vizinha não vale para um bairro de Viçosa', async () => {
    const r = await publicar({ bairro_id: '1', origem_localizacao: 'gps', latitude: '-20.652995', longitude: '-42.857124' })
    assert.equal(r.status, 422, 'a sede de Teixeiras não é de Viçosa')
    assert.equal(r.dados.codigo, 'FORA_DA_CIDADE')
    const comprou = await chamar('POST', '/localizacao/atual', { cookie: comprador, json: { latitude: -20.652995, longitude: -42.857124 } })
    assert.equal(comprou.status, 201)
    assert.equal(comprou.dados.localizacao.cidade.nome, 'Teixeiras')
  })

  test('anúncio sem coordenadas (banco antigo) não entra na busca até ganhar a localização do bairro', async () => {
    const [resultado] = await db.query(
      `INSERT INTO anuncio (usuario_id, categoria_id, subcategoria_id, bairro_id, titulo, preco, condicao, forma_entrega, status, data_publicacao)
       VALUES (3, 1, 1, 1, 'Anúncio antigo sem localização', 10, 'usado', 'retirada', 'ativo', NOW())`,
    )
    criados.push(resultado.insertId)
    assert.ok(!(await proximos({ ...CENTRO, raio_km: 1 })).itens.some((a) => a.id === resultado.insertId))
    assert.equal((await chamar('GET', `/localizacao/anuncios/${resultado.insertId}`)).dados.localizacao, null)
    const posto = await chamar('POST', `/localizacao/anuncios/${resultado.insertId}`, { cookie: vendedor, json: { origem: 'bairro' } })
    assert.equal(posto.status, 201, JSON.stringify(posto.dados))
    assert.ok((await proximos({ ...CENTRO, raio_km: 1 })).itens.some((a) => a.id === resultado.insertId))
  })
})

describe('Tabela de decisão: localização x status do anúncio x raio', () => {
  test('só aparece com localização informada, anúncio ativo e raio válido que o alcance', async () => {
    const { dados: ativo } = await publicar({ bairro_id: '1' })
    const { dados: vendido } = await publicar({ bairro_id: '1' })
    await chamar('PATCH', `/anuncios/${vendido.id}/status`, { cookie: vendedor, json: { status: 'vendido' } })
    const casos = [
      { local: CENTRO, raio: 1, id: ativo.id, esperado: 'aparece' },
      { local: CENTRO, raio: 1, id: vendido.id, esperado: 'some' },
      { local: aoSul(CENTRO, 3000), raio: 1, id: ativo.id, esperado: 'some' },
      { local: aoSul(CENTRO, 3000), raio: 5, id: ativo.id, esperado: 'aparece' },
      { local: CENTRO, raio: 0, id: ativo.id, esperado: 400 },
      { local: null, raio: 1, id: ativo.id, esperado: 400 },
    ]
    for (const caso of casos) {
      const parametros = { raio_km: caso.raio, ...(caso.local ? { latitude: caso.local.latitude.toFixed(7), longitude: caso.local.longitude.toFixed(7) } : {}) }
      const r = await chamar('GET', `/localizacao/proximos?${new URLSearchParams(parametros)}`)
      if (typeof caso.esperado === 'number') {
        assert.equal(r.status, caso.esperado, JSON.stringify(caso))
        continue
      }
      assert.equal(r.dados.itens.some((a) => a.id === caso.id), caso.esperado === 'aparece', JSON.stringify(caso))
    }
  })
})

describe('Transição de estados', () => {
  test('localização: sem localização, GPS, manual, desativada e ativa de novo', async () => {
    await db.query('DELETE FROM localizacao_usuario WHERE usuario_id = 2')
    const estado = async () => (await chamar('GET', '/localizacao/atual', { cookie: comprador })).dados.localizacao
    const voltarRelogio = () => db.query('UPDATE localizacao_usuario SET atualizada_em = atualizada_em - INTERVAL 10 SECOND WHERE usuario_id = 2')
    assert.equal(await estado(), null)
    assert.equal((await chamar('POST', '/localizacao/atual', { cookie: comprador, json: CENTRO })).status, 201)
    assert.equal((await estado()).origem, 'gps')
    await voltarRelogio()
    assert.equal((await chamar('PATCH', '/localizacao/atual', { cookie: comprador, json: { origem: 'manual', cidade_id: 3 } })).status, 200)
    assert.equal((await estado()).cidade.nome, 'Ponte Nova')
    assert.equal((await chamar('PUT', '/localizacao/preferencias', { cookie: comprador, json: { compartilhar_localizacao: false } })).status, 200)
    assert.equal(await estado(), null, 'desativar apaga')
    assert.equal((await chamar('PATCH', '/localizacao/atual', { cookie: comprador, json: CENTRO })).status, 404, 'sem localização não há o que atualizar')
    assert.equal((await chamar('POST', '/localizacao/atual', { cookie: comprador, json: CENTRO })).status, 201)
    assert.equal((await chamar('GET', '/localizacao/preferencias', { cookie: comprador })).dados.compartilhar_localizacao, true)
  })

  test('anúncio: rascunho, publicado (ganha a localização do bairro), vendido e ativo de novo', async () => {
    const campos = { status: 'rascunho', titulo: 'Rascunho que vai ser publicado', preco: '80', categoria_id: '1', subcategoria_id: '1', bairro_id: '2', condicao: 'usado', forma_entrega: 'retirada' }
    const rascunho = await chamar('POST', '/anuncios', { cookie: vendedor, form: formulario(campos) })
    assert.equal(rascunho.status, 201)
    criados.push(rascunho.dados.id)
    const id = rascunho.dados.id
    const aparece = async () => (await proximos({ ...CENTRO, raio_km: 2 })).itens.some((a) => a.id === id)
    assert.equal(await aparece(), false, 'rascunho fica de fora')
    const publicado = await chamar('PATCH', `/anuncios/${id}/status`, { cookie: vendedor, json: { status: 'ativo' } })
    assert.equal(publicado.dados.localizacao_anuncio.bairro.nome, 'Ramos')
    assert.equal(await aparece(), true, 'publicado entra')
    await chamar('PATCH', `/anuncios/${id}/status`, { cookie: vendedor, json: { status: 'vendido' } })
    assert.equal(await aparece(), false, 'vendido sai')
    await chamar('PATCH', `/anuncios/${id}/status`, { cookie: vendedor, json: { status: 'ativo' } })
    assert.equal(await aparece(), true, 'reativado volta')
  })
})

describe('Exploratório: combinações de filtros', () => {
  test('qualquer combinação válida responde 200 e respeita todos os filtros ao mesmo tempo', async () => {
    const opcoes = {
      raio_km: [1, 5, 50, 300],
      ordenar: ['proximos', 'recentes', 'menor_preco', 'maior_preco'],
      categoria_id: [undefined, 1, 4, 7],
      condicao: [undefined, 'usado', 'novo,seminovo'],
      preco_min: [undefined, 0, 100],
      preco_max: [undefined, 300, 99999999],
      busca: [undefined, 'a', 'mesa', 'zq%', 'zq_'],
    }
    let semente = 7
    const sortear = (lista) => {
      semente = (semente * 1103515245 + 12345) % 2147483648
      return lista[semente % lista.length]
    }
    for (let i = 0; i < 60; i++) {
      const p = { ...CENTRO, por_pagina: 50 }
      for (const [chave, lista] of Object.entries(opcoes)) {
        const valor = sortear(lista)
        if (valor !== undefined) p[chave] = valor
      }
      if (p.preco_min !== undefined && p.preco_max !== undefined && p.preco_min > p.preco_max) continue
      const r = await chamar('GET', `/localizacao/proximos?${new URLSearchParams(p)}`)
      assert.equal(r.status, 200, JSON.stringify(p))
      for (const a of r.dados.itens) {
        assert.ok(a.distancia_km <= p.raio_km + 0.05, JSON.stringify(p))
        if (p.categoria_id) assert.equal(a.categoria_id, p.categoria_id)
        if (p.condicao) assert.ok(String(p.condicao).split(',').includes(a.condicao))
        if (p.preco_min !== undefined) assert.ok(a.preco >= p.preco_min)
        if (p.preco_max !== undefined) assert.ok(a.preco <= p.preco_max)
        if (String(p.busca).startsWith('zq')) assert.fail(`"${p.busca}" é texto, não curinga do LIKE`)
      }
      if (p.ordenar === 'proximos') {
        const d = r.dados.itens.map((a) => a.distancia_km)
        assert.deepEqual(d, [...d].sort((x, y) => x - y))
      }
    }
  })
})
