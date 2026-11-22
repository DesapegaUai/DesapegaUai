import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { io as conectarSocket } from 'socket.io-client'

process.env.PERMITIR_LOGIN_TESTE = 'true'

const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { encerrarSocket, iniciarSocket } = await import('../src/socket.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
iniciarSocket(servidor)
const base = `http://127.0.0.1:${servidor.address().port}/api`
const origemSocket = `http://127.0.0.1:${servidor.address().port}`

let anuncioVendido
let conversaVendida
let anuncioAtivo
let conversaAtiva
let anuncioSemConversa
let conversaSemConversa
let comprador
let vendedor

async function chamar(metodo, caminho, { cookie, json } = {}) {
  const headers = {}
  if (cookie) headers.Cookie = cookie
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  }
  const resposta = await fetch(base + caminho, { method: metodo, headers, body })
  const texto = await resposta.text()
  return { status: resposta.status, dados: texto ? JSON.parse(texto) : null }
}

async function entrar(usuarioId) {
  const resposta = await fetch(`${base}/auth/teste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: usuarioId }),
  })
  assert.equal(resposta.status, 200)
  return resposta.headers.get('set-cookie').split(';')[0]
}

async function abrirSocket(cookie) {
  const socket = conectarSocket(origemSocket, {
    path: '/api/socket.io',
    transports: ['websocket'],
    extraHeaders: { Cookie: cookie },
    reconnection: false,
  })
  await new Promise((resolver, rejeitar) => {
    const tempoLimite = setTimeout(() => rejeitar(new Error('Socket.IO não conectou a tempo.')), 5000)
    socket.once('connect', () => {
      clearTimeout(tempoLimite)
      resolver()
    })
    socket.once('connect_error', (erro) => {
      clearTimeout(tempoLimite)
      rejeitar(erro)
    })
  })
  return socket
}

function esperarEvento(socket, evento) {
  return new Promise((resolver, rejeitar) => {
    const tempoLimite = setTimeout(() => rejeitar(new Error(`O evento ${evento} não chegou a tempo.`)), 5000)
    socket.once(evento, (dados) => {
      clearTimeout(tempoLimite)
      resolver(dados)
    })
  })
}

async function criarAnuncio(status, { conversaram = true } = {}) {
  const [resultado] = await db.query(
    `INSERT INTO anuncio
       (usuario_id, categoria_id, subcategoria_id, bairro_id, titulo, descricao,
        preco, condicao, forma_entrega, status, data_publicacao)
     VALUES (3, 1, 1, 1, ?, 'Anúncio criado para testar avaliações.', 25,
             'usado', 'retirada', ?, NOW())`,
    [`Produto de teste ${Date.now()}-${status}`, status],
  )
  const [conversa] = await db.query(
    'INSERT INTO conversa (anuncio_id, comprador_id) VALUES (?, 2)',
    [resultado.insertId],
  )
  if (conversaram) {
    await db.query(
      "INSERT INTO mensagem (conversa_id, remetente_id, texto) VALUES (?, 2, 'Ainda está disponível?'), (?, 3, 'Está sim.')",
      [conversa.insertId, conversa.insertId],
    )
  }
  return { anuncioId: resultado.insertId, conversaId: conversa.insertId }
}

before(async () => {
  comprador = await entrar(2)
  vendedor = await entrar(3)
  const vendido = await criarAnuncio('vendido')
  anuncioVendido = vendido.anuncioId
  conversaVendida = vendido.conversaId
  const ativo = await criarAnuncio('ativo')
  anuncioAtivo = ativo.anuncioId
  conversaAtiva = ativo.conversaId
  const semConversa = await criarAnuncio('vendido', { conversaram: false })
  anuncioSemConversa = semConversa.anuncioId
  conversaSemConversa = semConversa.conversaId
})

after(async () => {
  await db.query('DELETE FROM anuncio WHERE id IN (?, ?, ?)', [anuncioVendido, anuncioAtivo, anuncioSemConversa])
  await db.query("DELETE FROM avaliacao WHERE avaliador_id = 2 AND anuncio_titulo LIKE 'Produto de teste %'")
  await db.query("DELETE FROM notificacao WHERE usuario_id = 3 AND tipo = 'nova_avaliacao'")
  await encerrarSocket()
  servidor.closeAllConnections()
  await db.end()
})

test('persiste a avaliação e envia atualização em tempo real às duas contas', async () => {
  const socketComprador = await abrirSocket(comprador)
  const socketVendedor = await abrirSocket(vendedor)
  try {
    const eventoComprador = esperarEvento(socketComprador, 'nova_avaliacao')
    const eventoVendedor = esperarEvento(socketVendedor, 'nova_avaliacao')
    const avisoVendedor = esperarEvento(socketVendedor, 'nova_notificacao')
    const resposta = await chamar('POST', `/avaliacoes/conversas/${conversaVendida}`, {
      cookie: comprador,
      // qualidades repetidas e fora de ordem voltam sem repetição, na ordem padrão
      json: { nota: 5, qualidades: ['pontual', 'respondeu_rapido', 'pontual'], comentario: 'Entrega combinada e produto conferido.' },
    })

    assert.equal(resposta.status, 201, JSON.stringify(resposta.dados))
    assert.deepEqual(resposta.dados.avaliacao.qualidades, ['respondeu_rapido', 'pontual'])
    assert.equal(resposta.dados.avaliacao.avaliador_nome, 'Larissa Andrade')
    assert.equal(resposta.dados.avaliacao.avaliado_nome, 'Usuário Teste')
    assert.equal(resposta.dados.avaliacao.minha, true)

    const [paraComprador, paraVendedor] = await Promise.all([eventoComprador, eventoVendedor])
    assert.equal(paraComprador.id, resposta.dados.avaliacao.id)
    assert.equal(paraComprador.minha, true)
    assert.equal(paraVendedor.id, resposta.dados.avaliacao.id)
    assert.equal(paraVendedor.minha, false)
    const aviso = await avisoVendedor
    assert.equal(aviso.tipo, 'nova_avaliacao')
    assert.match(aviso.titulo, /5 estrelas/)

    const minhas = await chamar('GET', '/avaliacoes/minhas', { cookie: comprador })
    assert.equal(minhas.status, 200)
    assert.equal(minhas.dados.feitas[0].conversa_id, conversaVendida)
    assert.equal(minhas.dados.feitas[0].minha, true)

    const publicas = await chamar('GET', '/avaliacoes/usuarios/3')
    assert.equal(publicas.status, 200)
    assert.equal(publicas.dados.avaliacoes[0].comentario, 'Entrega combinada e produto conferido.')
    assert.deepEqual(publicas.dados.avaliacoes[0].qualidades, ['respondeu_rapido', 'pontual'])
    assert.deepEqual(minhas.dados.feitas[0].qualidades, ['respondeu_rapido', 'pontual'])
    assert.equal(publicas.dados.avaliacoes[0].minha, false)
  } finally {
    socketComprador.disconnect()
    socketVendedor.disconnect()
  }
})

test('a avaliação mostra a foto atual de quem avaliou, lida do perfil na hora (nunca a foto antiga)', async () => {
  const [avaliacao] = (await chamar('GET', '/avaliacoes/usuarios/3')).dados.avaliacoes
  assert.ok(avaliacao, 'o teste anterior deixa uma avaliação para o usuário 3')
  assert.ok('avaliador_foto' in avaliacao)
  const [[antes]] = await db.query('SELECT foto_url FROM usuario WHERE id = ?', [avaliacao.avaliador_id])
  try {
    // quem avaliou coloca uma foto depois de avaliar
    await db.query('UPDATE usuario SET foto_url = ? WHERE id = ?', ['/api/uploads/perfis/2/foto-nova.webp', avaliacao.avaliador_id])
    const depois = (await chamar('GET', '/avaliacoes/usuarios/3')).dados.avaliacoes.find((a) => a.id === avaliacao.id)
    assert.equal(depois.avaliador_foto, '/api/uploads/perfis/2/foto-nova.webp')
  } finally {
    await db.query('UPDATE usuario SET foto_url = ? WHERE id = ?', [antes.foto_url, avaliacao.avaliador_id])
  }
})

test('impede nota inválida, avaliação antes da venda, outro usuário e duplicação', async () => {
  assert.equal((await chamar('POST', `/avaliacoes/conversas/${conversaAtiva}`, {
    cookie: comprador,
    json: { nota: 5 },
  })).status, 409)

  assert.equal((await chamar('POST', `/avaliacoes/conversas/${conversaVendida}`, {
    cookie: vendedor,
    json: { nota: 4 },
  })).status, 403)

  assert.equal((await chamar('POST', `/avaliacoes/conversas/${conversaVendida}`, {
    cookie: comprador,
    json: { nota: 6 },
  })).status, 400)

  for (const qualidades of [['rapido demais'], 'pontual', [1]]) {
    assert.equal((await chamar('POST', `/avaliacoes/conversas/${conversaVendida}`, {
      cookie: comprador,
      json: { nota: 5, qualidades },
    })).status, 400, JSON.stringify(qualidades))
  }

  assert.equal((await chamar('POST', `/avaliacoes/conversas/${conversaVendida}`, {
    cookie: comprador,
    json: { nota: 5 },
  })).status, 409)
})

test('só avalia quem conversou com o vendedor pelo chat', async () => {
  const resposta = await chamar('POST', `/avaliacoes/conversas/${conversaSemConversa}`, { cookie: comprador, json: { nota: 4 } })
  assert.equal(resposta.status, 409)
  assert.match(resposta.dados.erro, /conversarem pelo chat/)
})

test('a avaliação continua no perfil do vendedor mesmo se ele excluir o anúncio', async () => {
  const [[{ antes }]] = await db.query('SELECT COUNT(*) AS antes FROM avaliacao WHERE avaliado_id = 3')
  const excluiu = await chamar('DELETE', `/anuncios/${anuncioVendido}`, { cookie: vendedor })
  assert.equal(excluiu.status, 204)
  const [[{ depois }]] = await db.query('SELECT COUNT(*) AS depois FROM avaliacao WHERE avaliado_id = 3')
  assert.equal(depois, antes)
  const publicas = await chamar('GET', '/avaliacoes/usuarios/3')
  assert.ok(publicas.dados.avaliacoes.some((av) => av.comentario === 'Entrega combinada e produto conferido.'))
})
