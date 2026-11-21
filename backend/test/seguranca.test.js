// Testes de segurança da API (autenticação, permissões, injeção, dados maliciosos, abuso,
// exposição de dados e logs).
import assert from 'node:assert/strict'
import http from 'node:http'
import { after, before, describe, test } from 'node:test'
import jwt from 'jsonwebtoken'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'
process.env.TESTAR_LIMITES = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { env } = await import('../src/config/env.js')
const { registrar } = await import('../src/utils/log.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const base = `http://127.0.0.1:${servidor.address().port}/api`
const VICOSA = { latitude: -20.761234, longitude: -42.870567 }
const criados = []
let dono
let outro
let anuncioGps

async function chamar(metodo, caminho, { cookie, json, form, cabecalhos = {}, corpoCru } = {}) {
  const headers = { ...cabecalhos }
  if (cookie) headers.Cookie = cookie
  let body = corpoCru
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) body = form
  const resposta = await fetch(base + caminho, { method: metodo, headers, body })
  const texto = await resposta.text()
  let dados = texto
  try { dados = texto ? JSON.parse(texto) : null } catch { /* não é JSON */ }
  return { status: resposta.status, dados, texto }
}

// O fetch do Node descarta os cabeçalhos Sec-Fetch-*, que só o navegador manda: este pedido vai pelo http.
function chamarComoLink(caminho, cabecalhos) {
  return new Promise((ok, falha) => {
    const pedido = http.request(base + caminho, { method: 'GET', headers: cabecalhos }, (resposta) => {
      let texto = ''
      resposta.on('data', (parte) => { texto += parte })
      resposta.on('end', () => {
        let dados = texto
        try { dados = JSON.parse(texto) } catch { /* não é JSON */ }
        ok({ status: resposta.statusCode, dados })
      })
    })
    pedido.on('error', falha)
    pedido.end()
  })
}

async function entrarComo(usuarioId) {
  const r = await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: usuarioId }) })
  return r.headers.get('set-cookie').split(';')[0]
}

const tokenCom = (segredo, opcoes) => `token=${jwt.sign({}, segredo, { subject: '3', algorithm: 'HS256', ...opcoes })}`

before(async () => {
  dono = await entrarComo(3)
  outro = await entrarComo(1)
  const foto = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#3E8B22' } }).jpeg().toBuffer()
  const f = new FormData()
  for (const [k, v] of Object.entries({ titulo: 'Anúncio do teste de segurança', preco: '99', categoria_id: '1', subcategoria_id: '1', bairro_id: '1', condicao: 'usado', forma_entrega: 'retirada', ...VICOSA, origem_localizacao: 'gps', rua: 'Rua da Casa do Vendedor', cep: '36570087' })) f.append(k, String(v))
  f.append('fotos', new Blob([foto], { type: 'image/jpeg' }), 'f.jpg')
  const r = await chamar('POST', '/anuncios', { cookie: dono, form: f })
  assert.equal(r.status, 201, JSON.stringify(r.dados))
  anuncioGps = r.dados
  criados.push(r.dados.id)
})

after(async () => {
  for (const id of criados) await chamar('DELETE', `/anuncios/${id}`, { cookie: dono })
  await db.query('DELETE FROM localizacao_usuario WHERE usuario_id IN (1, 3)')
  await db.query('DELETE FROM preferencia_localizacao WHERE usuario_id IN (1, 3)')
  servidor.closeAllConnections()
  servidor.close()
  await db.end()
})

describe('Autenticação', () => {
  const ROTAS_PROTEGIDAS = [
    ['POST', '/localizacao/atual'], ['GET', '/localizacao/atual'], ['PATCH', '/localizacao/atual'], ['DELETE', '/localizacao/atual'],
    ['GET', '/localizacao/preferencias'], ['PUT', '/localizacao/preferencias'],
    ['POST', '/localizacao/anuncios/1'], ['PATCH', '/localizacao/anuncios/1'],
    ['GET', '/notificacoes'], ['PATCH', '/notificacoes/lidas'], ['PUT', '/notificacoes/preferencias'], ['POST', '/notificacoes/push'],
    ['GET', '/perfil'], ['GET', '/meus-anuncios'], ['GET', '/favoritos'], ['GET', '/conversas'], ['POST', '/anuncios'],
    ['PUT', '/anuncios/1'], ['DELETE', '/anuncios/1'],
  ]

  test('sem login: 401 em todas as rotas privadas', async () => {
    for (const [metodo, rota] of ROTAS_PROTEGIDAS) {
      const r = await chamar(metodo, rota, metodo === 'GET' ? {} : { json: {} })
      assert.equal(r.status, 401, `${metodo} ${rota}`)
      assert.equal(r.dados.codigo, 'NAO_AUTENTICADO')
    }
  })

  test('token inválido, de outro segredo, vencido ou sem assinatura: 401', async () => {
    const vencido = tokenCom(env.jwtSegredo, { expiresIn: -60 })
    const outroSegredo = tokenCom('um-segredo-qualquer-com-mais-de-32-caracteres!!')
    const semAssinatura = `token=${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"3"}').toString('base64url')}.`
    for (const cookie of ['token=abc', 'token=', vencido, outroSegredo, semAssinatura]) {
      assert.equal((await chamar('GET', '/localizacao/atual', { cookie })).status, 401, cookie.slice(0, 30))
    }
    assert.equal((await chamar('GET', '/localizacao/atual', { cookie: tokenCom(env.jwtSegredo, { expiresIn: 60 }) })).status, 200, 'token bom funciona')
  })
})

describe('Permissões', () => {
  test('não consulta nem altera a localização de outra pessoa', async () => {
    await chamar('POST', '/localizacao/atual', { cookie: dono, json: VICOSA })
    const visto = await chamar('GET', '/localizacao/atual', { cookie: outro })
    assert.equal(visto.dados.localizacao, null, 'cada um só vê a sua')
    for (const rota of ['/localizacao/atual/3', '/localizacao/usuarios/3', '/localizacao/atual?usuario_id=3']) {
      const r = await chamar('GET', rota, { cookie: outro })
      assert.ok(r.status === 404 || r.dados.localizacao === null, rota)
    }
    const r = await chamar('PATCH', '/localizacao/atual', { cookie: outro, json: { ...VICOSA, usuario_id: 3 } })
    assert.equal(r.status, 404, 'o usuario_id do corpo é ignorado: o outro não tinha localização')
    const doDono = await chamar('GET', '/localizacao/atual', { cookie: dono })
    assert.equal(doDono.dados.localizacao.latitude, VICOSA.latitude)
  })

  test('não edita anúncio de outra pessoa nem a localização dele', async () => {
    const id = anuncioGps.id
    assert.equal((await chamar('PUT', `/anuncios/${id}`, { cookie: outro, json: { titulo: 'Invadido' } })).status, 403)
    assert.equal((await chamar('PATCH', `/anuncios/${id}/status`, { cookie: outro, json: { status: 'vendido' } })).status, 403)
    assert.equal((await chamar('DELETE', `/anuncios/${id}`, { cookie: outro })).status, 403)
    assert.equal((await chamar('PATCH', `/localizacao/anuncios/${id}`, { cookie: outro, json: { origem: 'bairro', bairro_id: 2 } })).status, 403)
    assert.equal((await chamar('GET', `/anuncios/${id}`)).dados.titulo, 'Anúncio do teste de segurança')
  })
})

describe('Injeção e dados maliciosos', () => {
  test('SQL injection em busca, filtros, ordenação e bbox não executa nada', async () => {
    const [[{ antes }]] = await db.query('SELECT COUNT(*) AS antes FROM anuncio')
    const ataques = [
      `/localizacao/proximos?latitude=-20.75&longitude=-42.88&busca=${encodeURIComponent("' OR 1=1 -- ")}`,
      `/localizacao/proximos?latitude=-20.75&longitude=-42.88&ordenar=${encodeURIComponent('proximos; DROP TABLE anuncio')}`,
      `/localizacao/proximos?latitude=-20.75&longitude=-42.88&categoria_id=${encodeURIComponent('1 OR 1=1')}`,
      `/localizacao/proximos?latitude=${encodeURIComponent('-20.75) OR (1=1')}&longitude=-42.88`,
      `/localizacao/mapa?bbox=${encodeURIComponent('-42.9,-20.8,-42.8,-20.7);DELETE FROM anuncio;--')}`,
      `/cidades/1/ruas?busca=${encodeURIComponent("%' UNION SELECT email FROM usuario -- ")}`,
      `/localizacao/sugestoes?busca=${encodeURIComponent("_%' OR '1'='1")}`,
    ]
    for (const url of ataques) {
      const r = await chamar('GET', url)
      assert.ok(r.status === 400 || r.status === 200, `${url}: ${r.status}`)
      assert.ok(!r.texto.includes('@example.com'), 'não vazou e-mail')
      if (r.status === 200 && r.dados.itens) assert.equal(r.dados.total, 0, 'o texto foi tratado como texto')
    }
    const [[{ depois }]] = await db.query('SELECT COUNT(*) AS depois FROM anuncio')
    assert.equal(depois, antes)
  })

  test('SQL injection em ids, gravações e Procura-se: vira 400 ou texto comum, nunca erro 500', async () => {
    const [[{ antes }]] = await db.query('SELECT COUNT(*) AS antes FROM usuario')
    const ataque = "1' OR '1'='1' -- "
    // ids no caminho e no corpo: só número inteiro passa
    for (const url of [`/anuncios/${encodeURIComponent(ataque)}`, `/usuarios/${encodeURIComponent('1 OR 1=1')}`, `/procuras?cidade_id=${encodeURIComponent('1; DROP TABLE procura')}`]) {
      assert.equal((await chamar('GET', url)).status, 400, url)
    }
    assert.equal((await chamar('POST', '/auth/teste', { json: { usuario_id: '1 OR 1=1' } })).status, 400)
    assert.equal((await chamar('POST', '/conversas', { cookie: dono, json: { anuncio_id: ataque } })).status, 400)
    assert.equal((await chamar('PATCH', '/anuncios/1/status', { cookie: dono, json: { status: "ativo' OR '1'='1" } })).status, 403) // não é o dono: nem chega a validar

    // objeto no lugar de número ou texto (JSON malicioso): 400, não 500
    for (const valor of [{ id: 1 }, [1], { toString: 'x' }, true]) {
      assert.equal((await chamar('POST', '/auth/teste', { json: { usuario_id: valor } })).status, 400, JSON.stringify(valor))
      assert.equal((await chamar('POST', '/conversas', { cookie: dono, json: { anuncio_id: valor } })).status, 400, JSON.stringify(valor))
      assert.equal((await chamar('POST', '/procuras', { cookie: dono, json: { titulo: 'Mesa', bairro_id: valor } })).status, 400, JSON.stringify(valor))
      assert.equal((await chamar('PUT', '/localizacao/preferencias', { cookie: dono, json: { raio_km: valor } })).status, 400, JSON.stringify(valor))
      assert.equal((await chamar('PUT', '/perfil', { cookie: dono, json: { telefone: valor } })).status, 400, JSON.stringify(valor))
    }

    // texto de ataque em campo de texto fica guardado como texto
    const titulo = "Mesa'); DROP TABLE procura; --"
    const pedido = await chamar('POST', '/procuras', { cookie: dono, json: { titulo, bairro_id: 1 } })
    assert.equal(pedido.status, 201)
    assert.equal(pedido.dados.titulo, titulo)
    assert.equal((await chamar('DELETE', `/procuras/${pedido.dados.id}`, { cookie: dono })).status, 204)

    const [[{ depois }]] = await db.query('SELECT COUNT(*) AS depois FROM usuario')
    assert.equal(depois, antes)
    const [[{ tabelas }]] = await db.query("SELECT COUNT(*) AS tabelas FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'procura'")
    assert.equal(tabelas, 1, 'a tabela procura continua existindo')
  })

  test('JSON quebrado, corpo grande demais, tipos errados e __proto__', async () => {
    assert.equal((await chamar('POST', '/localizacao/atual', { cookie: dono, cabecalhos: { 'Content-Type': 'application/json' }, corpoCru: '{"latitude":' })).status, 400)
    assert.equal((await chamar('POST', '/localizacao/atual', { cookie: dono, json: { ...VICOSA, lixo: 'x'.repeat(200_000) } })).status, 413)
    assert.equal((await chamar('POST', '/localizacao/atual', { cookie: dono, json: [VICOSA] })).status, 400)
    assert.equal((await chamar('POST', '/localizacao/atual', { cookie: dono, json: { latitude: { $gt: 0 }, longitude: -42.88 } })).status, 400)
    const r = await chamar('PUT', '/localizacao/preferencias', { cookie: dono, cabecalhos: { 'Content-Type': 'application/json' }, corpoCru: '{"__proto__":{"admin":true},"raio_km":10}' })
    assert.equal(r.status, 200)
    assert.equal({}.admin, undefined, 'não poluiu o Object.prototype')
  })

  test('texto com HTML volta como texto puro (a tela escapa); nada é executado na API', async () => {
    const r = await chamar('PATCH', `/localizacao/anuncios/${anuncioGps.id}`, { cookie: dono, json: { origem: 'bairro', rua: '<script>alert(1)</script>' } })
    assert.equal(r.status, 200)
    assert.equal(r.dados.localizacao.rua, '<script>alert(1)</script>')
    assert.match((await fetch(`${base}/localizacao/anuncios/${anuncioGps.id}`)).headers.get('content-type'), /application\/json/)
  })
})

describe('Exposição de dados', () => {
  test('nenhuma resposta pública leva coordenada exata, rua, CEP, e-mail ou telefone do vendedor', async () => {
    await chamar('PATCH', `/localizacao/anuncios/${anuncioGps.id}`, { cookie: dono, json: { origem: 'gps', ...VICOSA, rua: 'Rua da Casa do Vendedor', cep: '36570087' } })
    const respostas = [
      await chamar('GET', `/anuncios/${anuncioGps.id}`, { cookie: outro }),
      await chamar('GET', `/localizacao/anuncios/${anuncioGps.id}`),
      await chamar('GET', `/localizacao/proximos?latitude=-20.75&longitude=-42.88&raio_km=10&por_pagina=50`),
      await chamar('GET', '/localizacao/mapa?bbox=-42.95,-20.80,-42.80,-20.70&limite=500'),
      await chamar('GET', '/anuncios?por_pagina=50'),
    ]
    for (const r of respostas) {
      assert.equal(r.status, 200)
      for (const proibido of [String(VICOSA.latitude), String(VICOSA.longitude), 'Rua da Casa do Vendedor', '36570087', '@example.com', '31999990001']) {
        assert.ok(!r.texto.includes(proibido), `vazou ${proibido}`)
      }
    }
  })

  test('erros não mostram SQL, pilha nem caminho de arquivo', async () => {
    const r = await chamar('GET', '/localizacao/proximos?latitude=abc&longitude=1')
    assert.equal(r.status, 400)
    for (const proibido of ['SELECT', 'at ', '\\src\\', '/src/', 'mysql']) assert.ok(!r.texto.includes(proibido), proibido)
  })

  test('o log das operações não guarda coordenada, rua nem CEP', async () => {
    const linhas = []
    const original = console.log
    const silencio = env.silenciarLogs
    env.silenciarLogs = false
    console.log = (texto) => linhas.push(String(texto))
    try {
      registrar('localizacao.teste', { usuario_id: 3, latitude: VICOSA.latitude, longitude: VICOSA.longitude, rua: 'Rua X', cep: '36570087' })
      await chamar('DELETE', '/localizacao/atual', { cookie: outro })
    } finally {
      console.log = original
      env.silenciarLogs = silencio
    }
    const tudo = linhas.join('\n')
    assert.ok(tudo.includes('localizacao.teste'))
    for (const proibido of [String(VICOSA.latitude), 'Rua X', '36570087']) assert.ok(!tudo.includes(proibido), `log com ${proibido}`)
  })
})

describe('Abuso de requisições (rate limiting)', () => {
  test('consulta de endereço: a 31ª no mesmo minuto é 429 no formato padrão', async () => {
    let ultima
    for (let i = 0; i < 31; i++) ultima = await chamar('GET', '/localizacao/endereco?latitude=-20.7547&longitude=-42.8819', { cookie: outro })
    assert.equal(ultima.status, 429)
    assert.equal(ultima.dados.codigo, 'MUITAS_REQUISICOES')
  })

  test('mensagens pela API: a 61ª no mesmo minuto é 429 (o tempo real não é o único caminho)', async () => {
    const larissa = await entrarComo(2) // compradora da conversa 1 do seed
    let ultima
    for (let i = 1; i <= 61; i++) ultima = await chamar('POST', '/conversas/1/mensagens', { cookie: larissa, json: { texto: `limite de teste ${i}` } })
    assert.equal(ultima.status, 429)
    assert.equal(ultima.dados.codigo, 'MUITAS_REQUISICOES')
    const [[{ gravadas }]] = await db.query("SELECT COUNT(*) AS gravadas FROM mensagem WHERE conversa_id = 1 AND texto LIKE 'limite de teste %'")
    assert.equal(gravadas, 60)
    await db.query("DELETE FROM mensagem WHERE conversa_id = 1 AND texto LIKE 'limite de teste %'")
  })
})

describe('Sessão e pedidos de outro site', () => {
  test('sair da conta invalida o token: o cookie de antes não entra mais', async () => {
    const sessao = await entrarComo(2)
    assert.equal((await chamar('GET', '/perfil', { cookie: sessao })).status, 200)
    assert.equal((await chamar('POST', '/auth/logout', { cookie: sessao, json: {} })).status, 204)
    assert.equal((await chamar('GET', '/perfil', { cookie: sessao })).status, 401)
    assert.equal((await chamar('GET', '/auth/sessao', { cookie: sessao })).dados.usuario, null)
    // um login novo funciona, e os das outras contas não foram afetados
    assert.equal((await chamar('GET', '/perfil', { cookie: await entrarComo(2) })).status, 200)
    assert.equal((await chamar('GET', '/perfil', { cookie: dono })).status, 200)
  })

  test('link de outro site apontando para a API é recusado; foto e rota de saúde continuam abrindo', async () => {
    const link = { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' }
    const larissa = await entrarComo(2)
    const [[{ antes }]] = await db.query('SELECT COUNT(*) AS antes FROM mensagem WHERE conversa_id = 1 AND lida = FALSE')
    const r = await chamarComoLink('/conversas/1/mensagens', { ...link, Cookie: larissa })
    assert.equal(r.status, 403)
    assert.equal(r.dados.codigo, 'ORIGEM_NAO_PERMITIDA')
    const [[{ depois }]] = await db.query('SELECT COUNT(*) AS depois FROM mensagem WHERE conversa_id = 1 AND lida = FALSE')
    assert.equal(depois, antes, 'nenhuma mensagem foi marcada como lida')
    assert.equal((await chamarComoLink('/saude', link)).status, 200)
    assert.equal((await chamarComoLink(anuncioGps.fotos[0].pequena.replace('/api', ''), link)).status, 200)
    // o site chamando a API (fetch) não é link: continua valendo
    assert.equal((await chamarComoLink('/conversas/1/mensagens', { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors', Cookie: larissa })).status, 200)
  })
})
