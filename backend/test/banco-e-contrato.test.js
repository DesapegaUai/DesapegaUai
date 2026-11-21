// Banco de dados: as restrições do MySQL barram dado inválido mesmo se o código deixar passar.
// Contrato: as respostas seguem o que está documentado no OpenAPI (/api/docs).
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { especificacao } = await import('../src/docs/openapi.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const base = `http://127.0.0.1:${servidor.address().port}/api`
let cookie

before(async () => {
  const r = await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: 2 }) })
  cookie = r.headers.get('set-cookie').split(';')[0]
  await db.query('DELETE FROM localizacao_usuario WHERE usuario_id = 2')
})

after(async () => {
  await db.query('DELETE FROM localizacao_usuario WHERE usuario_id = 2')
  await db.query('DELETE FROM preferencia_localizacao WHERE usuario_id = 2')
  servidor.closeAllConnections()
  servidor.close()
  await db.end()
})

async function falhaNoBanco(sql, valores) {
  try {
    await db.query(sql, valores)
  } catch (erro) {
    return erro.code
  }
  assert.fail(`o banco aceitou: ${sql}`)
}

describe('Banco de dados', () => {
  test('a API conecta no MySQL', async () => {
    const r = await (await fetch(`${base}/saude`)).json()
    assert.deepEqual(r, { api: 'ok', banco: 'ok' })
  })

  test('as tabelas de localização existem com os índices da busca', async () => {
    const [indices] = await db.query(
      `SELECT TABLE_NAME AS tabela, INDEX_NAME AS indice FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('localizacao_anuncio', 'localizacao_usuario', 'preferencia_localizacao')`,
    )
    const nomes = new Set(indices.map((i) => i.indice))
    for (const indice of ['uq_localizacao_anuncio', 'ix_localizacao_anuncio_publica', 'uq_localizacao_usuario', 'ix_localizacao_usuario_coordenada', 'uq_preferencia_localizacao']) {
      assert.ok(nomes.has(indice), `faltou ${indice}`)
    }
  })

  test('coordenada fora do planeta, precisão negativa, raio inválido e CEP errado são recusados pelo banco', async () => {
    const codigos = [
      await falhaNoBanco("INSERT INTO localizacao_usuario (usuario_id, latitude, longitude, origem, cidade_id, capturada_em) VALUES (2, 95, -42, 'gps', 1, NOW())"),
      await falhaNoBanco("INSERT INTO localizacao_usuario (usuario_id, latitude, longitude, precisao_m, origem, cidade_id, capturada_em) VALUES (2, -20, -42, -1, 'gps', 1, NOW())"),
      await falhaNoBanco("INSERT INTO localizacao_usuario (usuario_id, latitude, longitude, origem, cidade_id, capturada_em) VALUES (2, -20, -42, 'satelite', 1, NOW())"),
      await falhaNoBanco('INSERT INTO preferencia_localizacao (usuario_id, raio_km) VALUES (2, 0)'),
      await falhaNoBanco("INSERT INTO preferencia_localizacao (usuario_id, modo) VALUES (2, 'radar')"),
      await falhaNoBanco("UPDATE localizacao_anuncio SET cep = '123' WHERE anuncio_id = 1"),
    ]
    for (const codigo of codigos) assert.ok(['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_CONSTRAINT_FAILED', 'WARN_DATA_TRUNCATED', 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD'].includes(codigo), codigo)
  })

  test('uma localização por usuário e uma por anúncio (sem histórico de deslocamento)', async () => {
    await db.query("INSERT INTO localizacao_usuario (usuario_id, latitude, longitude, origem, cidade_id, capturada_em) VALUES (2, -20.75, -42.88, 'gps', 1, NOW())")
    assert.equal(await falhaNoBanco("INSERT INTO localizacao_usuario (usuario_id, latitude, longitude, origem, cidade_id, capturada_em) VALUES (2, -20.76, -42.88, 'gps', 1, NOW())"), 'ER_DUP_ENTRY')
    assert.equal(await falhaNoBanco("INSERT INTO localizacao_anuncio (anuncio_id, latitude, longitude, latitude_publica, longitude_publica, origem, cidade_id, bairro_id, cidade, bairro) VALUES (1, -20.75, -42.88, -20.75, -42.88, 'bairro', 1, 1, 'Viçosa', 'Centro')"), 'ER_DUP_ENTRY')
  })

  test('integridade: excluir o anúncio apaga a localização dele; usuário e bairro precisam existir', async () => {
    const [anuncio] = await db.query("INSERT INTO anuncio (usuario_id, status, titulo) VALUES (2, 'rascunho', 'Teste de integridade')")
    await db.query("INSERT INTO localizacao_anuncio (anuncio_id, latitude, longitude, latitude_publica, longitude_publica, origem, cidade_id, bairro_id, cidade, bairro) VALUES (?, -20.75, -42.88, -20.75, -42.88, 'bairro', 1, 1, 'Viçosa', 'Centro')", [anuncio.insertId])
    await db.query('DELETE FROM anuncio WHERE id = ?', [anuncio.insertId])
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM localizacao_anuncio WHERE anuncio_id = ?', [anuncio.insertId])
    assert.equal(total, 0)
    assert.equal(await falhaNoBanco("INSERT INTO localizacao_usuario (usuario_id, latitude, longitude, origem, cidade_id, capturada_em) VALUES (999999, -20.75, -42.88, 'gps', 1, NOW())"), 'ER_NO_REFERENCED_ROW_2')
    assert.equal(await falhaNoBanco("INSERT INTO localizacao_anuncio (anuncio_id, latitude, longitude, latitude_publica, longitude_publica, origem, cidade_id, bairro_id, cidade, bairro) VALUES (12, -20.75, -42.88, -20.75, -42.88, 'bairro', 1, 99999999, 'Viçosa', 'X')"), 'ER_NO_REFERENCED_ROW_2')
  })

  test('a base da Zona da Mata está completa', async () => {
    const [[{ cidades }]] = await db.query('SELECT COUNT(*) AS cidades FROM cidade')
    const [[{ bairros }]] = await db.query('SELECT COUNT(*) AS bairros FROM bairro')
    const [[{ ruas }]] = await db.query('SELECT COUNT(*) AS ruas FROM rua WHERE cep IS NOT NULL')
    assert.equal(cidades, 142)
    assert.ok(bairros > 7000, `${bairros} bairros`)
    assert.ok(ruas > 50000, `${ruas} ruas com CEP`)
    const [semBairro] = await db.query('SELECT c.nome FROM cidade c LEFT JOIN bairro b ON b.cidade_id = c.id GROUP BY c.id HAVING COUNT(b.id) = 0')
    assert.deepEqual(semBairro, [], 'toda cidade tem pelo menos um bairro ou localidade')
  })
})

// --------------------------------------------------------------- contrato

function conferir(valor, esquema, caminho = 'resposta') {
  if (esquema.$ref) return conferir(valor, especificacao.components.schemas[esquema.$ref.split('/').pop()], caminho)
  if (valor === null) return assert.ok(esquema.nullable || esquema.allOf, `${caminho} veio null`)
  if (esquema.allOf) return esquema.allOf.forEach((parte) => conferir(valor, parte, caminho))
  if (esquema.oneOf) return
  const tipos = { number: 'number', integer: 'number', string: 'string', boolean: 'boolean', object: 'object', array: 'object' }
  if (esquema.type) assert.equal(typeof valor, tipos[esquema.type], `${caminho}: esperava ${esquema.type}`)
  if (esquema.type === 'integer') assert.ok(Number.isInteger(valor), `${caminho}: esperava inteiro`)
  if (esquema.type === 'array') {
    assert.ok(Array.isArray(valor), `${caminho}: esperava lista`)
    valor.forEach((item, i) => conferir(item, esquema.items ?? {}, `${caminho}[${i}]`))
  }
  if (esquema.enum) assert.ok(esquema.enum.includes(valor), `${caminho}: ${valor} fora de ${esquema.enum}`)
  for (const obrigatorio of esquema.required ?? []) assert.ok(obrigatorio in valor, `${caminho}.${obrigatorio} faltou`)
  for (const [nome, sub] of Object.entries(esquema.properties ?? {})) {
    if (valor[nome] !== undefined && !(sub.format === 'date-time' && typeof valor[nome] === 'string')) conferir(valor[nome], sub, `${caminho}.${nome}`)
  }
}

function esquemaDaResposta(rota, metodo, status) {
  const resposta = especificacao.paths[rota]?.[metodo]?.responses?.[status]
  assert.ok(resposta, `${metodo.toUpperCase()} ${rota} ${status} não está documentado`)
  return resposta.content?.['application/json']?.schema
}

describe('Contrato (OpenAPI)', () => {
  const casos = [
    ['GET', '/api/localizacao/raios', '/localizacao/raios', 200],
    ['GET', '/api/localizacao/proximos', '/localizacao/proximos?cidade_id=1&raio_km=50', 200],
    ['GET', '/api/localizacao/proximos', '/localizacao/proximos?raio_km=0&cidade_id=1', 400],
    ['GET', '/api/localizacao/proximos', '/localizacao/proximos?latitude=-19.9&longitude=-43.9', 422],
    ['GET', '/api/localizacao/endereco', '/localizacao/endereco?latitude=-20.757104&longitude=-42.875465', 200],
    ['GET', '/api/localizacao/anuncios/{id}', '/localizacao/anuncios/1', 200],
    ['GET', '/api/localizacao/anuncios/{id}', '/localizacao/anuncios/99999', 404],
    ['GET', '/api/localizacao/atual', '/localizacao/atual', 200, true],
    ['GET', '/api/localizacao/preferencias', '/localizacao/preferencias', 200, true],
    ['GET', '/api/localizacao/atual', '/localizacao/atual', 401],
  ]
  for (const [metodo, rota, url, status, comLogin] of casos) {
    test(`${metodo} ${url} responde ${status} no formato documentado`, async () => {
      const r = await fetch(base + url, { headers: comLogin ? { Cookie: cookie } : {} })
      assert.equal(r.status, status)
      const esquema = esquemaDaResposta(rota, metodo.toLowerCase(), status)
      if (esquema) conferir(await r.json(), esquema)
    })
  }

  test('POST /api/localizacao/atual devolve o formato documentado', async () => {
    await db.query('DELETE FROM localizacao_usuario WHERE usuario_id = 2')
    const r = await fetch(`${base}/localizacao/atual`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: -20.7547, longitude: -42.8819, precisao_m: 12 }) })
    assert.equal(r.status, 201)
    conferir(await r.json(), esquemaDaResposta('/api/localizacao/atual', 'post', 201))
  })

  test('todas as rotas de /api/localizacao estão documentadas', () => {
    const documentadas = Object.keys(especificacao.paths).filter((p) => p.startsWith('/api/localizacao'))
    for (const rota of ['/atual', '/preferencias', '/proximos', '/mapa', '/distancia', '/endereco', '/sugestoes', '/raios', '/cep/{cep}', '/anuncios/{id}']) {
      assert.ok(documentadas.includes(`/api/localizacao${rota}`), rota)
    }
  })
})
