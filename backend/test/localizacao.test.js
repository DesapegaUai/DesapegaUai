// Testes de integração do módulo de localização (/api/localizacao), com o banco do npm run banco.
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import sharp from 'sharp'
import { io as conectarSocket } from 'socket.io-client'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { encerrarSocket, iniciarSocket } = await import('../src/socket.js')
const { aplicarRetencao } = await import('../src/services/localizacaoService.js')
const { distanciaKm } = await import('../src/utils/geo.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
iniciarSocket(servidor)
const base = `http://127.0.0.1:${servidor.address().port}/api`
const origemSocket = `http://127.0.0.1:${servidor.address().port}`

const CENTRO_VICOSA = { latitude: -20.752736, longitude: -42.881906 } // bairro 1 do seed
const RAMOS = { latitude: -20.754992, longitude: -42.88322 } // bairro 2
const PERTO_DA_UFV = { latitude: -20.7612, longitude: -42.8702 }
const JUIZ_DE_FORA = { latitude: -21.7642, longitude: -43.3503 }
const BELO_HORIZONTE = { latitude: -19.9191, longitude: -43.9386 }

let dono // Usuário Teste (3)
let diego // Diego (1)
let larissa // Larissa (2)
const criados = []
let foto

async function chamar(metodo, caminho, { cookie, json, form, origem } = {}) {
  const headers = {}
  if (cookie) headers.Cookie = cookie
  if (origem) headers.Origin = origem
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    body = form
  }
  const resposta = await fetch(base + caminho, { method: metodo, headers, body })
  const texto = await resposta.text()
  return { status: resposta.status, dados: texto ? JSON.parse(texto) : null, cabecalhos: resposta.headers }
}

async function entrarComo(usuarioId) {
  const resposta = await fetch(`${base}/auth/teste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: usuarioId }),
  })
  assert.equal(resposta.status, 200)
  return resposta.headers.get('set-cookie').split(';')[0]
}

const qs = (parametros) => new URLSearchParams(parametros).toString()

function formulario(campos, fotos = 1) {
  const f = new FormData()
  for (const [chave, valor] of Object.entries(campos)) f.append(chave, String(valor))
  for (let i = 0; i < fotos; i++) f.append('fotos', new Blob([foto], { type: 'image/jpeg' }), 'foto.jpg')
  return f
}

const ANUNCIO = {
  titulo: 'Bicicleta de teste da localização',
  preco: '300',
  categoria_id: '4',
  subcategoria_id: '15',
  bairro_id: '1',
  condicao: 'usado',
  forma_entrega: 'retirada',
}

async function publicar(campos = {}, cookie = dono) {
  const r = await chamar('POST', '/anuncios', { cookie, form: formulario({ ...ANUNCIO, ...campos }) })
  if (r.status === 201) criados.push(r.dados.id)
  return r
}

// volta o relógio da localização guardada (em vez de esperar o intervalo mínimo)
const envelhecer = (usuarioId, segundos) =>
  db.query('UPDATE localizacao_usuario SET atualizada_em = atualizada_em - INTERVAL ? SECOND, capturada_em = capturada_em - INTERVAL ? SECOND WHERE usuario_id = ?', [segundos, segundos, usuarioId])

before(async () => {
  foto = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#3E8B22' } }).jpeg().toBuffer()
  dono = await entrarComo(3)
  diego = await entrarComo(1)
  larissa = await entrarComo(2)
  await db.query('DELETE FROM localizacao_usuario WHERE usuario_id IN (1, 2, 3)')
  await db.query('DELETE FROM preferencia_localizacao WHERE usuario_id IN (1, 2, 3)')
})

after(async () => {
  for (const id of criados) await chamar('DELETE', `/anuncios/${id}`, { cookie: dono })
  await db.query('DELETE FROM localizacao_usuario WHERE usuario_id IN (1, 2, 3)')
  await db.query('DELETE FROM preferencia_localizacao WHERE usuario_id IN (1, 2, 3)')
  await encerrarSocket()
  servidor.closeAllConnections()
  await db.end()
})

describe('Raios', () => {
  test('GET /api/localizacao/raios: os sugeridos, o padrão de 5 km e os limites', async () => {
    const { status, dados } = await chamar('GET', '/localizacao/raios')
    assert.equal(status, 200)
    assert.deepEqual(dados.raios.map((r) => r.km), [1, 3, 5, 10, 15, 25, 50])
    assert.equal(dados.padrao_km, 5)
    assert.equal(dados.minimo_km, 1)
    assert.equal(dados.maximo_km, 300)
  })
})

describe('Localização do usuário (/atual)', () => {
  test('exige login e valida as coordenadas no servidor', async () => {
    assert.equal((await chamar('POST', '/localizacao/atual', { json: CENTRO_VICOSA })).status, 401)
    const casos = [
      [{ latitude: 91, longitude: -42.88 }, 400],
      [{ latitude: -20.75, longitude: -181 }, 400],
      [{ latitude: 0, longitude: 0 }, 400],
      [{ latitude: 'abc', longitude: -42.88 }, 400],
      [{ latitude: -20.75 }, 400],
      [{ ...CENTRO_VICOSA, precisao_m: -3 }, 400],
      [{ ...CENTRO_VICOSA, capturada_em: Date.now() + 3_600_000 }, 400],
      [BELO_HORIZONTE, 422],
    ]
    for (const [corpo, esperado] of casos) {
      const r = await chamar('POST', '/localizacao/atual', { cookie: dono, json: corpo })
      assert.equal(r.status, esperado, JSON.stringify(corpo))
      assert.ok(r.dados.erro && r.dados.codigo, 'erro no formato padrão')
    }
    const fora = await chamar('POST', '/localizacao/atual', { cookie: dono, json: BELO_HORIZONTE })
    assert.equal(fora.dados.codigo, 'FORA_DA_AREA')
  })

  test('registra o GPS com precisão e horário e acha a cidade e o bairro', async () => {
    const capturadaEm = new Date(Date.now() - 5000).toISOString()
    const r = await chamar('POST', '/localizacao/atual', { cookie: dono, json: { ...CENTRO_VICOSA, precisao_m: 15.5, capturada_em: capturadaEm } })
    assert.equal(r.status, 201, JSON.stringify(r.dados))
    assert.equal(r.dados.criada, true)
    const l = r.dados.localizacao
    assert.equal(l.origem, 'gps')
    assert.equal(l.precisao_m, 15.5)
    assert.equal(l.cidade.nome, 'Viçosa')
    assert.ok(l.bairro?.nome)
    assert.equal(l.desatualizada, false)
    assert.ok(Math.abs(new Date(l.capturada_em) - new Date(capturadaEm)) <= 1000, 'horário em que o aparelho mediu')
    assert.ok(new Date(l.expira_em) - Date.now() > 29 * 86_400_000, 'expira em 30 dias')

    const consulta = await chamar('GET', '/localizacao/atual', { cookie: dono })
    assert.equal(consulta.dados.localizacao.latitude, CENTRO_VICOSA.latitude)
  })

  test('mudança menor que 50 m não grava nada', async () => {
    const r = await chamar('PATCH', '/localizacao/atual', { cookie: dono, json: { latitude: -20.75285, longitude: -42.88195, precisao_m: 15 } })
    assert.equal(r.status, 200)
    assert.equal(r.dados.atualizada, false)
    assert.equal(r.dados.localizacao.latitude, CENTRO_VICOSA.latitude)
  })

  test('intervalo mínimo entre gravações: 429 com Retry-After', async () => {
    await db.query('UPDATE localizacao_usuario SET atualizada_em = UTC_TIMESTAMP() WHERE usuario_id = 3')
    const r = await chamar('PATCH', '/localizacao/atual', { cookie: dono, json: { ...PERTO_DA_UFV, precisao_m: 10 } })
    assert.equal(r.status, 429)
    assert.equal(r.dados.codigo, 'MUITAS_REQUISICOES')
    assert.ok(Number(r.cabecalhos.get('retry-after')) >= 1)
  })

  test('mudança significativa atualiza a referência', async () => {
    await envelhecer(3, 10)
    const r = await chamar('PATCH', '/localizacao/atual', { cookie: dono, json: { ...PERTO_DA_UFV, precisao_m: 10 } })
    assert.equal(r.status, 200, JSON.stringify(r.dados))
    assert.equal(r.dados.atualizada, true)
    assert.equal(r.dados.localizacao.latitude, PERTO_DA_UFV.latitude)
  })

  test('localização antiga vem marcada como desatualizada (pede atualização)', async () => {
    await envelhecer(3, 41 * 60)
    const { dados } = await chamar('GET', '/localizacao/atual', { cookie: dono })
    assert.equal(dados.localizacao.desatualizada, true)
    assert.ok(dados.localizacao.idade_min >= 40)
  })

  test('localização manual (cidade e bairro), sem GPS', async () => {
    await envelhecer(3, 10)
    const r = await chamar('POST', '/localizacao/atual', { cookie: dono, json: { origem: 'manual', cidade_id: 1, bairro_id: 2 } })
    assert.equal(r.status, 200, JSON.stringify(r.dados))
    assert.equal(r.dados.localizacao.origem, 'manual')
    assert.equal(r.dados.localizacao.bairro.nome, 'Ramos')
    assert.equal(r.dados.localizacao.latitude, RAMOS.latitude)
    assert.equal(r.dados.localizacao.precisao_m, null)

    const errado = await chamar('POST', '/localizacao/atual', { cookie: dono, json: { origem: 'manual', cidade_id: 2, bairro_id: 2 } })
    assert.equal(errado.status, 400, 'bairro de outra cidade')
    assert.equal((await chamar('POST', '/localizacao/atual', { cookie: dono, json: { origem: 'manual' } })).status, 400)
  })

  test('cada um só vê a sua: o outro usuário não tem localização e não há rota com id', async () => {
    const { dados } = await chamar('GET', '/localizacao/atual', { cookie: diego })
    assert.equal(dados.localizacao, null)
    assert.equal((await chamar('GET', '/localizacao/atual/3', { cookie: diego })).status, 404)
    assert.equal((await chamar('PATCH', '/localizacao/atual', { cookie: diego, json: CENTRO_VICOSA })).status, 404)
  })

  test('DELETE revoga: apaga a localização e desliga o compartilhamento', async () => {
    assert.equal((await chamar('DELETE', '/localizacao/atual', { cookie: dono })).status, 204)
    assert.equal((await chamar('GET', '/localizacao/atual', { cookie: dono })).dados.localizacao, null)
    assert.equal((await chamar('GET', '/localizacao/preferencias', { cookie: dono })).dados.compartilhar_localizacao, false)
  })

  test('retenção: localização parada há mais de 30 dias some', async () => {
    await chamar('POST', '/localizacao/atual', { cookie: larissa, json: CENTRO_VICOSA })
    await db.query('UPDATE localizacao_usuario SET atualizada_em = UTC_TIMESTAMP() - INTERVAL 31 DAY WHERE usuario_id = 2')
    assert.equal((await chamar('GET', '/localizacao/atual', { cookie: larissa })).dados.localizacao, null)
    assert.ok((await aplicarRetencao()) >= 1)
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM localizacao_usuario WHERE usuario_id = 2')
    assert.equal(total, 0)
  })
})

describe('Preferências', () => {
  test('padrão de 5 km, alterar raio, modo e referência manual', async () => {
    const padrao = await chamar('GET', '/localizacao/preferencias', { cookie: diego })
    assert.equal(padrao.dados.raio_km, 5)
    const r = await chamar('PUT', '/localizacao/preferencias', { cookie: diego, json: { raio_km: 15, modo: 'manual', cidade_id: 1, bairro_id: 2 } })
    assert.equal(r.status, 200, JSON.stringify(r.dados))
    assert.equal(r.dados.raio_km, 15)
    assert.equal(r.dados.bairro_manual.nome, 'Ramos')
    for (const corpo of [{ raio_km: 0 }, { raio_km: 301 }, { modo: 'satelite' }, { compartilhar_localizacao: 'sim' }, { cidade_id: 2, bairro_id: 2 }]) {
      assert.equal((await chamar('PUT', '/localizacao/preferencias', { cookie: diego, json: corpo })).status, 400, JSON.stringify(corpo))
    }
  })

  test('sem localização guardada, a busca usa a referência manual e o raio das preferências', async () => {
    const r = await chamar('GET', '/localizacao/proximos', { cookie: diego })
    assert.equal(r.status, 200, JSON.stringify(r.dados))
    assert.equal(r.dados.origem.tipo, 'bairro')
    assert.equal(r.dados.origem.bairro.nome, 'Ramos')
    assert.equal(r.dados.raio_km, 15)
  })
})

describe('Busca por proximidade (/proximos)', () => {
  test('só anúncios ativos dentro do raio, com a distância, do mais perto ao mais longe', async () => {
    const r = await chamar('GET', `/localizacao/proximos?${qs({ ...CENTRO_VICOSA, raio_km: 3, por_pagina: 50 })}`)
    assert.equal(r.status, 200, JSON.stringify(r.dados))
    assert.equal(r.dados.distancia, 'em linha reta')
    assert.ok(r.dados.total > 0)
    const distancias = r.dados.itens.map((a) => a.distancia_km)
    assert.deepEqual(distancias, [...distancias].sort((a, b) => a - b))
    for (const a of r.dados.itens) {
      assert.ok(a.distancia_km <= 3, `${a.titulo} a ${a.distancia_km} km`)
      assert.equal(a.status, 'ativo')
      const real = distanciaKm(CENTRO_VICOSA.latitude, CENTRO_VICOSA.longitude, a.localizacao_aproximada.latitude, a.localizacao_aproximada.longitude)
      assert.ok(Math.abs(real - a.distancia_km) <= 0.051, 'distância do MySQL igual à Haversine')
    }
    const ids = r.dados.itens.map((a) => a.id)
    assert.ok(!ids.includes(11), 'vendido não aparece')
    assert.ok(!ids.includes(12), 'rascunho não aparece')
    assert.ok(!ids.includes(8), 'Ponte Nova fica fora de 3 km')
  })

  test('aumentar o raio inclui as cidades vizinhas', async () => {
    const r = await chamar('GET', `/localizacao/proximos?${qs({ ...CENTRO_VICOSA, raio_km: 50, por_pagina: 50 })}`)
    const ids = r.dados.itens.map((a) => a.id)
    assert.ok(ids.includes(8), 'bicicleta de Ponte Nova em até 50 km')
    assert.ok(ids.includes(10), 'mesa de Teixeiras em até 50 km')
  })

  test('combina categoria, preço e palavra-chave com a distância', async () => {
    const r = await chamar('GET', `/localizacao/proximos?${qs({ ...CENTRO_VICOSA, raio_km: 50, categoria_id: 1, preco_max: 300, busca: 'a' })}`)
    assert.equal(r.status, 200)
    for (const a of r.dados.itens) {
      assert.equal(a.categoria_id, 1)
      assert.ok(a.preco <= 300)
    }
  })

  test('sem anúncio no raio: avisa e sugere um raio maior', async () => {
    const r = await chamar('GET', `/localizacao/proximos?${qs({ ...CENTRO_VICOSA, raio_km: 5, categoria_id: 4, subcategoria_id: 15, busca: 'aro 29' })}`)
    assert.equal(r.status, 200)
    assert.equal(r.dados.total, 0)
    assert.match(r.dados.mensagem, /Nenhum anúncio em até 5 km/)
    assert.equal(r.dados.ampliar.raio_km, 50)
    assert.ok(r.dados.ampliar.total >= 1)
  })

  test('paginação com no máximo 50 por página', async () => {
    const r = await chamar('GET', `/localizacao/proximos?${qs({ ...CENTRO_VICOSA, raio_km: 50, por_pagina: 2, pagina: 1 })}`)
    assert.equal(r.dados.itens.length, 2)
    assert.equal(r.dados.total_paginas, Math.ceil(r.dados.total / 2))
    const grande = await chamar('GET', `/localizacao/proximos?${qs({ ...CENTRO_VICOSA, raio_km: 50, por_pagina: 500 })}`)
    assert.equal(grande.dados.por_pagina, 50)
  })

  test('origem manual por cidade ou bairro, ou a localização guardada (com login)', async () => {
    const porCidade = await chamar('GET', `/localizacao/proximos?${qs({ cidade_id: 3, raio_km: 5 })}`)
    assert.equal(porCidade.dados.origem.tipo, 'cidade')
    assert.ok(porCidade.dados.itens.some((a) => a.id === 8))
    assert.equal((await chamar('GET', '/localizacao/proximos?origem=atual')).status, 401)
    assert.equal((await chamar('GET', '/localizacao/proximos?origem=atual', { cookie: larissa })).status, 404)
    assert.equal((await chamar('GET', '/localizacao/proximos')).status, 400)
  })

  test('raio e origem inválidos', async () => {
    for (const raio of ['0', '301', '2.5', 'dez']) {
      assert.equal((await chamar('GET', `/localizacao/proximos?${qs({ ...CENTRO_VICOSA, raio_km: raio })}`)).status, 400, raio)
    }
    assert.equal((await chamar('GET', `/localizacao/proximos?${qs({ ...BELO_HORIZONTE, raio_km: 5 })}`)).status, 422)
  })

  test('GET /api/anuncios também aceita latitude e longitude como origem', async () => {
    const r = await chamar('GET', `/anuncios?${qs({ ...CENTRO_VICOSA, distancia_max: 1, ordenar: 'proximos' })}`)
    assert.equal(r.status, 200)
    for (const a of r.dados.itens) assert.ok(a.distancia_km <= 1)
  })
})

describe('Mapa, distância, endereço, sugestões e CEP', () => {
  test('marcadores do mapa na área visível, com o ponto aproximado', async () => {
    const r = await chamar('GET', '/localizacao/mapa?bbox=-42.95,-20.80,-42.80,-20.70')
    assert.equal(r.status, 200)
    assert.ok(r.dados.marcadores.length > 0)
    for (const m of r.dados.marcadores) {
      assert.ok(m.latitude >= -20.8 && m.latitude <= -20.7 && m.longitude >= -42.95 && m.longitude <= -42.8)
      assert.ok(!('rua' in m) && !('cep' in m))
    }
    assert.equal((await chamar('GET', '/localizacao/mapa')).status, 400)
    assert.equal((await chamar('GET', '/localizacao/mapa?bbox=-49,-25,-40,-15')).status, 400)
  })

  test('distância entre dois pontos e até um anúncio', async () => {
    const r = await chamar('GET', `/localizacao/distancia?${qs({ de_latitude: CENTRO_VICOSA.latitude, de_longitude: CENTRO_VICOSA.longitude, para_latitude: JUIZ_DE_FORA.latitude, para_longitude: JUIZ_DE_FORA.longitude })}`)
    assert.equal(r.status, 200)
    assert.equal(r.dados.metodo, 'haversine')
    assert.ok(Math.abs(r.dados.distancia_km - distanciaKm(CENTRO_VICOSA.latitude, CENTRO_VICOSA.longitude, JUIZ_DE_FORA.latitude, JUIZ_DE_FORA.longitude)) < 0.001)
    const ateAnuncio = await chamar('GET', `/localizacao/distancia?${qs({ de_latitude: CENTRO_VICOSA.latitude, de_longitude: CENTRO_VICOSA.longitude, anuncio_id: 1 })}`)
    assert.equal(ateAnuncio.dados.distancia_km, 0)
    assert.equal((await chamar('GET', '/localizacao/distancia?de_latitude=91&de_longitude=0&para_latitude=0&para_longitude=1')).status, 400)
    assert.equal((await chamar('GET', `/localizacao/distancia?${qs({ de_latitude: -20.7, de_longitude: -42.8, anuncio_id: 12 })}`)).status, 404, 'rascunho')
  })

  test('endereço aproximado de um ponto (rua e CEP do IBGE)', async () => {
    const r = await chamar('GET', `/localizacao/endereco?${qs({ latitude: -20.757104, longitude: -42.875465 })}`)
    assert.equal(r.status, 200, JSON.stringify(r.dados))
    assert.equal(r.dados.cidade.nome, 'Viçosa')
    assert.equal(r.dados.precisao, 'rua')
    assert.ok(r.dados.rua)
    assert.match(r.dados.cep, /^365[0-9]{5}$/)
    assert.equal((await chamar('GET', `/localizacao/endereco?${qs(BELO_HORIZONTE)}`)).status, 422)
  })

  test('sugestões por nome e por proximidade', async () => {
    const nome = await chamar('GET', '/localizacao/sugestoes?busca=Juiz')
    assert.ok(nome.dados.sugestoes.some((s) => s.tipo === 'cidade' && s.nome === 'Juiz de Fora'))
    const perto = await chamar('GET', `/localizacao/sugestoes?${qs(CENTRO_VICOSA)}`)
    const distancias = perto.dados.sugestoes.map((s) => s.distancia_km)
    assert.deepEqual(distancias, [...distancias].sort((a, b) => a - b))
    assert.equal((await chamar('GET', '/localizacao/sugestoes')).status, 400)
  })

  test('CEP de rua, CEP geral da cidade, inválido e fora da região', async () => {
    const [[rua]] = await db.query("SELECT cep FROM rua WHERE cidade_id = 1 AND nome = 'Avenida Peter Henry Rolfs' AND cep IS NOT NULL LIMIT 1")
    const r = await chamar('GET', `/localizacao/cep/${rua.cep}`)
    assert.equal(r.status, 200)
    assert.equal(r.dados.cep_de_rua, true)
    assert.equal(r.dados.rua, 'Avenida Peter Henry Rolfs')
    assert.equal(r.dados.cidade.nome, 'Viçosa')
    const [[teixeiras]] = await db.query('SELECT cep_geral FROM cidade WHERE id = 2')
    const geral = await chamar('GET', `/localizacao/cep/${teixeiras.cep_geral}`)
    assert.equal(geral.dados.cep_de_rua, false)
    assert.equal(geral.dados.cidade.nome, 'Teixeiras')
    assert.equal((await chamar('GET', '/localizacao/cep/123')).status, 400)
    assert.equal((await chamar('GET', '/localizacao/cep/01001000')).status, 404)
  })
})

describe('Localização do anúncio', () => {
  let anuncio

  test('publicar com GPS: guarda o ponto exato e mostra só o aproximado para os outros', async () => {
    const r = await publicar({ ...PERTO_DA_UFV, origem_localizacao: 'gps', precisao_m: 8, rua: 'Avenida Peter Henry Rolfs', cep: '36570087' })
    assert.equal(r.status, 201, JSON.stringify(r.dados))
    anuncio = r.dados
    const doDono = r.dados.localizacao_anuncio
    assert.equal(doDono.origem, 'gps')
    assert.equal(doDono.exata.latitude, PERTO_DA_UFV.latitude)
    assert.equal(doDono.rua, 'Avenida Peter Henry Rolfs')
    assert.equal(doDono.cep, '36570087')

    const publico = (await chamar('GET', `/anuncios/${anuncio.id}`, { cookie: diego })).dados.localizacao_anuncio
    assert.equal(publico.aproximada, true)
    assert.ok(!('exata' in publico) && !('rua' in publico) && !('cep' in publico), 'nada exato para os outros')
    const metros = distanciaKm(PERTO_DA_UFV.latitude, PERTO_DA_UFV.longitude, publico.latitude, publico.longitude) * 1000
    assert.ok(metros > 0 && metros <= 200, `ponto público a ${metros} m`)

    const rota = await chamar('GET', `/localizacao/anuncios/${anuncio.id}`)
    assert.equal(rota.status, 200)
    assert.equal(rota.dados.eh_meu, false)
    assert.ok(!('exata' in rota.dados.localizacao))
  })

  test('valida a localização na publicação: o ponto tem que ser da cidade do bairro', async () => {
    const r = await publicar({ ...JUIZ_DE_FORA, origem_localizacao: 'gps' })
    assert.equal(r.status, 422)
    assert.equal(r.dados.codigo, 'FORA_DA_CIDADE')
    assert.equal((await publicar({ latitude: '95', longitude: '-42.8' })).status, 400)
  })

  test('sem GPS, o anúncio fica com a localização aproximada do bairro', async () => {
    const r = await publicar({ bairro_id: '2' })
    assert.equal(r.status, 201)
    assert.equal(r.dados.localizacao_anuncio.origem, 'bairro')
    assert.equal(r.dados.localizacao_anuncio.latitude, RAMOS.latitude)
  })

  test('só o dono altera; POST em quem já tem localização é 409', async () => {
    const novo = { origem: 'manual', latitude: -20.7535, longitude: -42.8810 }
    assert.equal((await chamar('PATCH', `/localizacao/anuncios/${anuncio.id}`, { json: novo })).status, 401)
    assert.equal((await chamar('PATCH', `/localizacao/anuncios/${anuncio.id}`, { cookie: diego, json: novo })).status, 403)
    assert.equal((await chamar('POST', `/localizacao/anuncios/${anuncio.id}`, { cookie: dono, json: novo })).status, 409)
    const r = await chamar('PATCH', `/localizacao/anuncios/${anuncio.id}`, { cookie: dono, json: novo })
    assert.equal(r.status, 200, JSON.stringify(r.dados))
    assert.equal(r.dados.localizacao.origem, 'manual')
    assert.equal(r.dados.localizacao.exata.latitude, -20.7535)
  })

  test('o GPS do vendedor não muda a localização do anúncio (ele pode viajar)', async () => {
    const antes = (await chamar('GET', `/localizacao/anuncios/${anuncio.id}`, { cookie: dono })).dados.localizacao.exata
    await db.query('DELETE FROM localizacao_usuario WHERE usuario_id = 3')
    const viajou = await chamar('POST', '/localizacao/atual', { cookie: dono, json: JUIZ_DE_FORA })
    assert.equal(viajou.status, 201)
    const depois = (await chamar('GET', `/localizacao/anuncios/${anuncio.id}`, { cookie: dono })).dados.localizacao.exata
    assert.deepEqual(depois, antes)
  })

  test('trocar o bairro para outra cidade leva a localização para o novo bairro', async () => {
    const r = await chamar('PUT', `/anuncios/${anuncio.id}`, { cookie: dono, json: { bairro_id: 24 } })
    assert.equal(r.status, 200, JSON.stringify(r.dados))
    assert.equal(r.dados.localizacao_anuncio.cidade.nome, 'Ubá')
    assert.equal(r.dados.localizacao_anuncio.origem, 'bairro')
  })

  test('rascunho de outra pessoa não existe; excluído e vendido saem da busca', async () => {
    assert.equal((await chamar('GET', '/localizacao/anuncios/12', { cookie: larissa })).status, 404, 'o rascunho 12 é do Diego')
    assert.equal((await chamar('GET', '/localizacao/anuncios/12', { cookie: dono })).status, 404)
    assert.equal((await chamar('GET', '/localizacao/anuncios/12')).status, 404)
    assert.equal((await chamar('GET', '/localizacao/anuncios/12', { cookie: diego })).status, 200, 'o dono vê o próprio rascunho')

    const vendido = await publicar({ bairro_id: '1' })
    assert.equal((await chamar('PATCH', `/anuncios/${vendido.dados.id}/status`, { cookie: dono, json: { status: 'vendido' } })).status, 200)
    const excluido = await publicar({ bairro_id: '1' })
    const visitante = conectarSocket(origemSocket, { path: '/api/socket.io', transports: ['websocket'], reconnection: false })
    await new Promise((ok) => visitante.once('connect', ok))
    const removido = new Promise((ok) => visitante.once('anuncio_removido', ok))
    assert.equal((await chamar('DELETE', `/anuncios/${excluido.dados.id}`, { cookie: dono })).status, 204)
    assert.deepEqual(await removido, { id: excluido.dados.id, motivo: 'excluido' })
    visitante.disconnect()

    const r = await chamar('GET', `/localizacao/proximos?${qs({ ...CENTRO_VICOSA, raio_km: 1, por_pagina: 50 })}`)
    const ids = r.dados.itens.map((a) => a.id)
    assert.ok(!ids.includes(vendido.dados.id), 'vendido some')
    assert.ok(!ids.includes(excluido.dados.id), 'excluído some')
    assert.equal((await chamar('GET', `/localizacao/anuncios/${excluido.dados.id}`)).status, 404)
  })
})

describe('Segurança', () => {
  test('pedido que altera dados vindo de outro site é recusado', async () => {
    const r = await chamar('POST', '/localizacao/atual', { cookie: dono, json: CENTRO_VICOSA, origem: 'https://site-malicioso.example' })
    assert.equal(r.status, 403)
    assert.equal(r.dados.codigo, 'ORIGEM_NAO_PERMITIDA')
  })

  test('erros no formato padrão', async () => {
    const r = await chamar('GET', '/localizacao/nao-existe')
    assert.equal(r.status, 404)
    assert.deepEqual(Object.keys(r.dados).sort(), ['codigo', 'erro', 'status'])
  })
})
