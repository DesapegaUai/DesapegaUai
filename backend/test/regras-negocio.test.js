// Regras de negócio da localização (RN-LOC), cenário por cenário, e conflitos entre regras.
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { distanciaKm } = await import('../src/utils/geo.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const base = `http://127.0.0.1:${servidor.address().port}/api`

const CENTRO = { latitude: -20.752736, longitude: -42.881906 } // centro do bairro 1 (Centro de Viçosa)
// 7 km ao sul do Centro: os anúncios do bairro Centro ficam a 7 km daqui
const SETE_KM_AO_SUL = { latitude: Number((CENTRO.latitude - 7 / 111.195).toFixed(6)), longitude: CENTRO.longitude }

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

async function publicar(campos) {
  const f = new FormData()
  const tudo = { titulo: 'Bicicleta das regras de negócio', preco: '450', categoria_id: '4', subcategoria_id: '15', bairro_id: '1', condicao: 'usado', forma_entrega: 'retirada', ...campos }
  for (const [k, v] of Object.entries(tudo)) f.append(k, String(v))
  f.append('fotos', new Blob([foto], { type: 'image/jpeg' }), 'f.jpg')
  const r = await chamar('POST', '/anuncios', { cookie: vendedor, form: f })
  assert.equal(r.status, 201, JSON.stringify(r.dados))
  criados.push(r.dados.id)
  return r.dados
}

const idsProximos = async (parametros) => {
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

describe('Cenários', () => {
  test('RN-LOC-002 / 011: usuário que não autoriza o GPS usa cidade e bairro', async () => {
    const r = await chamar('POST', '/localizacao/atual', { cookie: comprador, json: { origem: 'manual', cidade_id: 1, bairro_id: 1 } })
    assert.ok([200, 201].includes(r.status), JSON.stringify(r.dados))
    const busca = await chamar('GET', '/localizacao/proximos?origem=atual&raio_km=5', { cookie: comprador })
    assert.equal(busca.status, 200)
    assert.equal(busca.dados.origem.tipo, 'localizacao_atual')
    assert.ok(busca.dados.total > 0)
    const semNada = await chamar('GET', '/localizacao/proximos')
    assert.equal(semNada.status, 400, 'sem GPS e sem escolha: a API pede a localização manual')
    assert.equal(semNada.dados.codigo, 'LOCALIZACAO_OBRIGATORIA')
    assert.deepEqual(semNada.dados.campos, ['latitude', 'longitude', 'bairro_id', 'cidade_id'])
  })

  test('RN-LOC-005 / 006 / 007: anúncio a 7 km não aparece na busca de 5 km e aparece na de 10 km', async () => {
    const anuncio = await publicar({ bairro_id: '1' })
    const real = distanciaKm(SETE_KM_AO_SUL.latitude, SETE_KM_AO_SUL.longitude, anuncio.localizacao_anuncio.latitude, anuncio.localizacao_anuncio.longitude)
    assert.ok(Math.abs(real - 7) < 0.01, `o anúncio está a ${real} km`)

    const cinco = await idsProximos({ ...SETE_KM_AO_SUL, raio_km: 5 })
    assert.ok(!cinco.itens.some((a) => a.id === anuncio.id), 'a 7 km não entra no raio de 5 km')
    const dez = await idsProximos({ ...SETE_KM_AO_SUL, raio_km: 10 })
    const achado = dez.itens.find((a) => a.id === anuncio.id)
    assert.ok(achado, 'entra no raio de 10 km')
    assert.equal(achado.distancia_km, 7)
  })

  test('RN-LOC-004: o vendedor muda de cidade e o anúncio continua onde está', async () => {
    const anuncio = await publicar({ origem_localizacao: 'gps', latitude: '-20.7560', longitude: '-42.8790' })
    const antes = (await chamar('GET', `/localizacao/anuncios/${anuncio.id}`, { cookie: vendedor })).dados.localizacao
    const viajou = await chamar('POST', '/localizacao/atual', { cookie: vendedor, json: { latitude: -21.7642, longitude: -43.3503 } })
    assert.ok([200, 201].includes(viajou.status))
    assert.equal(viajou.dados.localizacao.cidade.nome, 'Juiz de Fora')
    const depois = (await chamar('GET', `/localizacao/anuncios/${anuncio.id}`, { cookie: vendedor })).dados.localizacao
    assert.deepEqual(depois.exata, antes.exata)
    assert.equal(depois.cidade.nome, 'Viçosa')
  })

  test('RN-LOC-008: anúncio excluído não aparece mais', async () => {
    const anuncio = await publicar({ bairro_id: '1' })
    assert.ok((await idsProximos({ ...CENTRO, raio_km: 1 })).itens.some((a) => a.id === anuncio.id))
    assert.equal((await chamar('DELETE', `/anuncios/${anuncio.id}`, { cookie: vendedor })).status, 204)
    assert.ok(!(await idsProximos({ ...CENTRO, raio_km: 1 })).itens.some((a) => a.id === anuncio.id))
  })

  test('usuário que tenta editar anúncio alheio tem a operação negada', async () => {
    const anuncio = await publicar({ bairro_id: '1' })
    assert.equal((await chamar('PUT', `/anuncios/${anuncio.id}`, { cookie: comprador, json: { preco: 1 } })).status, 403)
    assert.equal((await chamar('PATCH', `/localizacao/anuncios/${anuncio.id}`, { cookie: comprador, json: { origem: 'bairro', bairro_id: 2 } })).status, 403)
  })

  test('RN-LOC-003: coordenadas inválidas são rejeitadas', async () => {
    for (const ponto of [{ latitude: 100, longitude: -42 }, { latitude: -20, longitude: 200 }, { latitude: 'x', longitude: 'y' }]) {
      assert.equal((await chamar('POST', '/localizacao/atual', { cookie: comprador, json: ponto })).status, 400)
      assert.equal((await chamar('GET', `/localizacao/proximos?${new URLSearchParams(ponto)}`)).status, 400)
    }
  })

  test('RN-LOC-009: mudar a referência muda os resultados', async () => {
    const emViçosa = await idsProximos({ cidade_id: 1, raio_km: 5 })
    const emPonteNova = await idsProximos({ cidade_id: 3, raio_km: 5 })
    assert.notDeepEqual(emViçosa.itens.map((a) => a.id), emPonteNova.itens.map((a) => a.id))
  })

  test('RN-LOC-012: localização antiga é identificada para pedir atualização', async () => {
    await db.query('DELETE FROM localizacao_usuario WHERE usuario_id = 2')
    assert.equal((await chamar('POST', '/localizacao/atual', { cookie: comprador, json: CENTRO })).status, 201)
    await db.query('UPDATE localizacao_usuario SET capturada_em = capturada_em - INTERVAL 2 HOUR, atualizada_em = atualizada_em - INTERVAL 2 HOUR WHERE usuario_id = 2')
    const r = await chamar('GET', '/localizacao/proximos?origem=atual', { cookie: comprador })
    assert.equal(r.dados.origem.desatualizada, true)
  })
})

describe('Conflitos entre regras', () => {
  test('dentro do raio, mas vendido: não aparece', async () => {
    const anuncio = await publicar({ bairro_id: '1' })
    assert.equal((await chamar('PATCH', `/anuncios/${anuncio.id}/status`, { cookie: vendedor, json: { status: 'vendido' } })).status, 200)
    assert.ok(!(await idsProximos({ ...CENTRO, raio_km: 1 })).itens.some((a) => a.id === anuncio.id))
  })

  test('dentro do raio, mas rascunho: não aparece', async () => {
    const f = new FormData()
    for (const [k, v] of Object.entries({ status: 'rascunho', titulo: 'Rascunho no Centro', bairro_id: '1' })) f.append(k, v)
    const rascunho = await chamar('POST', '/anuncios', { cookie: vendedor, form: f })
    assert.equal(rascunho.status, 201)
    criados.push(rascunho.dados.id)
    assert.ok(!(await idsProximos({ ...CENTRO, raio_km: 1 })).itens.some((a) => a.id === rascunho.dados.id))
  })

  test('dentro do raio, mas de outra categoria ou acima do preço: não aparece', async () => {
    const anuncio = await publicar({ bairro_id: '1', preco: '5000' })
    const ids = async (extra) => (await idsProximos({ ...CENTRO, raio_km: 1, ...extra })).itens.map((a) => a.id)
    assert.ok((await ids({})).includes(anuncio.id))
    assert.ok(!(await ids({ categoria_id: 1 })).includes(anuncio.id))
    assert.ok(!(await ids({ preco_max: 1000 })).includes(anuncio.id))
  })

  test('vendido volta a ficar ativo: aparece de novo, no mesmo lugar', async () => {
    const anuncio = await publicar({ bairro_id: '1' })
    await chamar('PATCH', `/anuncios/${anuncio.id}/status`, { cookie: vendedor, json: { status: 'vendido' } })
    await chamar('PATCH', `/anuncios/${anuncio.id}/status`, { cookie: vendedor, json: { status: 'ativo' } })
    const achado = (await idsProximos({ ...CENTRO, raio_km: 1 })).itens.find((a) => a.id === anuncio.id)
    assert.ok(achado)
    assert.equal(achado.distancia_km, 0)
  })
})
