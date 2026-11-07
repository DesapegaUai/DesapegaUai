// Testes da API (parte da Rhayane). Com o MySQL ligado: npm run banco e depois npm test.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { after, describe, test } from 'node:test'
import jwt from 'jsonwebtoken'

// só neste teste: liga o login de teste e usa um ID do Google falso (o .env não muda)
process.env.PERMITIR_LOGIN_TESTE = 'true'
process.env.GOOGLE_CLIENT_ID = 'cliente-de-teste.apps.googleusercontent.com'

const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { env } = await import('../src/config/env.js')
const { PASTA_UPLOADS } = await import('../src/utils/fotos.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const porta = servidor.address().port
const base = `http://127.0.0.1:${porta}/api`

after(async () => {
  servidor.close()
  servidor.closeAllConnections()
  await db.end()
})

async function chamar(metodo, caminho, { corpo, cookie, origem } = {}) {
  const headers = {}
  if (corpo !== undefined) headers['Content-Type'] = 'application/json'
  if (cookie) headers.Cookie = cookie
  if (origem) headers.Origin = origem
  const resposta = await fetch(base + caminho, {
    method: metodo,
    headers,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  const texto = await resposta.text()
  let dados = texto
  try {
    dados = texto ? JSON.parse(texto) : null
  } catch {
    // não é JSON
  }
  return { status: resposta.status, dados, headers: resposta.headers }
}

async function entrarComo(usuarioId) {
  const { status, headers } = await chamar('POST', '/auth/teste', { corpo: { usuario_id: usuarioId } })
  assert.equal(status, 200, `O login de teste do usuário ${usuarioId} falhou. Rodou o npm run banco?`)
  return headers.get('set-cookie').split(';')[0]
}

// sem o fetch arrumar o caminho, para testar o ".."
function pedidoCru(caminho) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port: porta, path: caminho }, (resposta) => {
        let corpo = ''
        resposta.on('data', (parte) => (corpo += parte))
        resposta.on('end', () => resolve({ status: resposta.statusCode, corpo }))
      })
      .on('error', reject)
  })
}

describe('Banco e configuração', () => {
  test('GET /api/saude: API e banco conectados', async () => {
    const { status, dados } = await chamar('GET', '/saude')
    assert.equal(status, 200, `Banco sem conexão (${dados?.motivo}). O MySQL está ligado? O .env está certo?`)
    assert.deepEqual(dados, { api: 'ok', banco: 'ok' })
  })

  test('o banco recusa dado errado (regras do schema.sql)', async () => {
    await assert.rejects(
      db.query(`INSERT INTO anuncio (usuario_id, categoria_id, subcategoria_id, bairro_id, titulo, preco, condicao, forma_entrega)
                VALUES (1, 3, 5, 1, 'Camiseta', 30, 'usado', 'retirada')`),
      /fk_anuncio_subcategoria/,
      'o banco deveria recusar subcategoria de outra categoria (Moda + Celulares)',
    )
    await assert.rejects(
      db.query(`UPDATE usuario SET telefone = '(31) 99752-6486' WHERE id = 3`),
      /ck_usuario_telefone/,
      'o banco deveria recusar telefone fora do formato só números',
    )
    await assert.rejects(
      db.query(`INSERT INTO foto_anuncio (anuncio_id, arquivo) VALUES (1, '../../.env')`),
      /ck_foto_anuncio_arquivo/,
      'o banco deveria recusar nome de foto com ../',
    )
    await assert.rejects(
      db.query(`INSERT INTO mensagem (conversa_id, remetente_id, texto) VALUES (1, 2, '   ')`),
      /ck_mensagem_texto/,
      'o banco deveria recusar mensagem vazia',
    )
  })

  test('preço volta como número (decimalNumbers no db.js)', async () => {
    const [linhas] = await db.query('SELECT preco FROM anuncio WHERE id = 1')
    assert.equal(linhas[0].preco, 780)
  })

  test('CORS: só o front-end do .env pode chamar a API', async () => {
    const { headers } = await chamar('GET', '/saude', { origem: 'https://site-malicioso.example' })
    assert.equal(headers.get('access-control-allow-origin'), env.frontendUrl)
  })
})

describe('Categorias e cidades (sem login)', () => {
  test('GET /api/categorias: as 8 categorias na ordem das abas, com subcategorias', async () => {
    const { status, dados } = await chamar('GET', '/categorias')
    assert.equal(status, 200)
    assert.deepEqual(
      dados.map((c) => c.slug),
      ['casa', 'eletronicos', 'moda', 'veiculos', 'livros', 'games', 'servicos', 'outros'],
    )
    for (const categoria of dados) assert.equal(categoria.subcategorias.length, 4, categoria.nome)
    const moda = dados.find((c) => c.slug === 'moda')
    assert.equal(moda.rotulo_filtro, 'Tamanho')
    assert.deepEqual(
      moda.subcategorias.map((s) => s.nome),
      ['P', 'M', 'G', 'GG'],
    )
  })

  test('GET /api/cidades: 4 cidades em ordem alfabética, só id, nome e uf', async () => {
    const { status, dados } = await chamar('GET', '/cidades')
    assert.equal(status, 200)
    assert.deepEqual(
      dados.map((c) => c.nome),
      ['Ponte Nova', 'Teixeiras', 'Ubá', 'Viçosa'],
    )
    assert.deepEqual(Object.keys(dados[0]).sort(), ['id', 'nome', 'uf'])
  })

  test('GET /api/cidades/1/bairros: os 20 bairros de Viçosa em ordem alfabética', async () => {
    const { status, dados } = await chamar('GET', '/cidades/1/bairros')
    assert.equal(status, 200)
    assert.equal(dados.length, 20)
    const nomes = dados.map((b) => b.nome)
    for (const bairro of ['Centro', 'Silvestre', 'Santo Antônio', 'Nova Viçosa', 'Bom Jesus']) {
      assert.ok(nomes.includes(bairro), `faltou o bairro ${bairro}`)
    }
    assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  })

  test('cidade que não existe: 404; id inválido: 400', async () => {
    assert.equal((await chamar('GET', '/cidades/999/bairros')).status, 404)
    assert.equal((await chamar('GET', '/cidades/abc/bairros')).status, 400)
  })
})

describe('Login e sessão', () => {
  test('sem login: sessão vazia e as rotas protegidas respondem 401', async () => {
    assert.deepEqual((await chamar('GET', '/auth/sessao')).dados, { usuario: null })
    for (const [metodo, caminho] of [
      ['GET', '/perfil'],
      ['PUT', '/perfil'],
      ['GET', '/meus-anuncios'],
      ['POST', '/anuncios'],
      ['POST', '/favoritos/1'],
      ['GET', '/conversas'],
    ]) {
      assert.equal((await chamar(metodo, caminho)).status, 401, `${metodo} ${caminho} sem login`)
    }
  })

  test('login de teste: cookie httpOnly de 7 dias e a sessão mostra o Diego sem telefone', async () => {
    const resposta = await chamar('POST', '/auth/teste', { corpo: { usuario_id: 1 } })
    assert.equal(resposta.status, 200)
    const cookie = resposta.headers.get('set-cookie')
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /SameSite=Lax/)
    assert.match(cookie, /Max-Age=604800/)

    const { dados } = await chamar('GET', '/auth/sessao', { cookie: cookie.split(';')[0] })
    assert.equal(dados.usuario.nome, 'Diego Martins')
    assert.deepEqual(Object.keys(dados.usuario).sort(), ['email', 'foto_url', 'id', 'nome'])
  })

  test('login de teste nunca entra na conta de uma pessoa real', async () => {
    const [resultado] = await db.query(
      `INSERT INTO usuario (google_id, nome, email) VALUES ('109876543210987654321', 'Pessoa Real', 'pessoa.real@example.com')`,
    )
    try {
      const { status } = await chamar('POST', '/auth/teste', { corpo: { usuario_id: resultado.insertId } })
      assert.equal(status, 404)
    } finally {
      await db.query('DELETE FROM usuario WHERE id = ?', [resultado.insertId])
    }
  })

  test('login de teste com id inválido: 400', async () => {
    assert.equal((await chamar('POST', '/auth/teste', { corpo: { usuario_id: 'abc' } })).status, 400)
    assert.equal((await chamar('POST', '/auth/teste', { corpo: {} })).status, 400)
  })

  test('token falso, adulterado, sem assinatura ou vencido não entra', async () => {
    const semAssinatura =
      Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') +
      '.' +
      Buffer.from('{"sub":"1"}').toString('base64url') +
      '.'
    const tokens = {
      'texto qualquer': 'abc',
      'sem assinatura (alg none)': semAssinatura,
      'assinado com outro segredo': jwt.sign({}, randomBytes(32).toString('hex'), { subject: '1' }),
      vencido: jwt.sign({ exp: Math.floor(Date.now() / 1000) - 60 }, env.jwtSegredo, { subject: '1' }),
    }
    for (const [tipo, token] of Object.entries(tokens)) {
      const cookie = `token=${token}`
      assert.deepEqual((await chamar('GET', '/auth/sessao', { cookie })).dados, { usuario: null }, tipo)
      assert.equal((await chamar('GET', '/perfil', { cookie })).status, 401, tipo)
    }
  })

  test('login com Google: sem credential é 400, token inválido é 401', async () => {
    assert.equal((await chamar('POST', '/auth/google', { corpo: {} })).status, 400)
    assert.equal((await chamar('POST', '/auth/google', { corpo: { credential: 'abc' } })).status, 401)
  })

  test('logout responde 204 e apaga o cookie', async () => {
    const { status, headers } = await chamar('POST', '/auth/logout')
    assert.equal(status, 204)
    assert.match(headers.get('set-cookie'), /^token=;.*Expires=Thu, 01 Jan 1970/)
  })
})

describe('Perfil', () => {
  test('GET /api/perfil: dados do próprio usuário e os totais', async () => {
    const diego = (await chamar('GET', '/perfil', { cookie: await entrarComo(1) })).dados
    assert.equal(diego.nome, 'Diego Martins')
    assert.equal(diego.telefone, '31999990001')
    assert.equal(diego.total_anuncios_ativos, 10)
    assert.equal(diego.total_favoritos, 0)
    assert.equal(diego.total_conversas, 1)

    const larissa = (await chamar('GET', '/perfil', { cookie: await entrarComo(2) })).dados
    assert.equal(larissa.total_anuncios_ativos, 0)
    assert.equal(larissa.total_favoritos, 2)
    assert.equal(larissa.total_conversas, 1)
  })

  test('PUT /api/perfil: limpa o telefone, valida os campos e não muda o e-mail', async () => {
    const cookie = await entrarComo(3)
    try {
      const editado = await chamar('PUT', '/perfil', {
        cookie,
        corpo: { telefone: '(31) 99752-6486', bio: '  Estudante da UFV  ', email: 'outro@example.com' },
      })
      assert.equal(editado.status, 200)
      assert.equal(editado.dados.telefone, '31997526486')
      assert.equal(editado.dados.bio, 'Estudante da UFV')
      assert.equal(editado.dados.email, 'usuario.teste@example.com')

      for (const corpo of [{ nome: 'A' }, { telefone: '123' }, { bio: 'x'.repeat(301) }, [1, 2]]) {
        assert.equal((await chamar('PUT', '/perfil', { cookie, corpo })).status, 400, JSON.stringify(corpo))
      }

      const apagado = await chamar('PUT', '/perfil', { cookie, corpo: { telefone: '', bio: null } })
      assert.equal(apagado.dados.telefone, null)
      assert.equal(apagado.dados.bio, null)
    } finally {
      await db.query(`UPDATE usuario SET nome = 'Usuário Teste', telefone = NULL, bio = NULL WHERE id = 3`)
    }
  })
})

describe('Fotos (/api/uploads)', () => {
  test('serve a foto com o cabeçalho que libera para o front', async () => {
    const pasta = path.join(PASTA_UPLOADS, 'anuncios', '999999')
    await fs.mkdir(pasta, { recursive: true })
    try {
      await fs.writeFile(path.join(pasta, 'teste-400.webp'), 'imagem')
      const { status, headers } = await chamar('GET', '/uploads/anuncios/999999/teste-400.webp')
      assert.equal(status, 200)
      assert.equal(headers.get('cross-origin-resource-policy'), 'cross-origin')
    } finally {
      await fs.rm(pasta, { recursive: true, force: true })
    }
  })

  test('não deixa sair da pasta uploads com ".."', async () => {
    for (const caminho of ['/api/uploads/../../package.json', '/api/uploads/..%2f..%2fpackage.json']) {
      const { status, corpo } = await pedidoCru(caminho)
      assert.notEqual(status, 200, caminho)
      assert.ok(!corpo.includes('desapegauai-backend'), `vazou o package.json por ${caminho}`)
    }
  })
})

describe('Rotas da Marina e do Anthony', () => {
  test('já estão ligadas (respondem, mesmo antes de ficarem prontas)', async () => {
    const cookie = await entrarComo(1)
    assert.notEqual((await chamar('GET', '/anuncios')).status, 404, 'GET /api/anuncios')
    for (const caminho of ['/meus-anuncios', '/favoritos', '/conversas', '/conversas/nao-lidas']) {
      assert.notEqual((await chamar('GET', caminho, { cookie })).status, 404, `GET /api${caminho}`)
    }
  })
})
