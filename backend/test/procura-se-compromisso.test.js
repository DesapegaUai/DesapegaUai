// Procura-se (com aviso automático para os dois lados) e compromisso nas entregas.
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { combina, palavrasDoPedido } = await import('../src/services/procuraService.js')
const servidor = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)) })
const base = `http://127.0.0.1:${servidor.address().port}/api`
let vendedor, comprador, foto
const anuncios = []
const pedidos = []

async function chamar(metodo, caminho, { cookie, json, form } = {}) {
  const headers = cookie ? { Cookie: cookie } : {}
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(base + caminho, { method: metodo, headers, body: json !== undefined ? JSON.stringify(json) : form })
  const t = await r.text()
  return { status: r.status, dados: t ? JSON.parse(t) : null }
}
const entrar = async (id) => (await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })).headers.getSetCookie()[0].split(';')[0]
async function publicar(campos) {
  const f = new FormData()
  const dados = { preco: '90', categoria_id: '1', subcategoria_id: '1', bairro_id: '1', condicao: 'usado', forma_entrega: 'retirada', ...campos }
  for (const [k, v] of Object.entries(dados)) f.append(k, v)
  f.append('fotos', new Blob([foto], { type: 'image/jpeg' }), 'f.jpg')
  const r = await chamar('POST', '/anuncios', { cookie: vendedor, form: f })
  if (r.status === 201) anuncios.push(r.dados.id)
  return r
}
const avisosDe = async (cookie) => (await chamar('GET', '/notificacoes', { cookie })).dados.itens
// o aviso sai depois da resposta da publicação: espera um instante por ele
async function esperarAviso(cookie, teste) {
  for (let i = 0; i < 40; i += 1) {
    const achado = (await avisosDe(cookie)).find(teste)
    if (achado) return achado
    await new Promise((ok) => setTimeout(ok, 50))
  }
  return null
}

before(async () => {
  vendedor = await entrar(3); comprador = await entrar(2)
  foto = await sharp({ create: { width: 500, height: 400, channels: 3, background: '#3E8B22' } }).jpeg().toBuffer()
})
after(async () => {
  for (const id of anuncios) await chamar('DELETE', `/anuncios/${id}`, { cookie: vendedor })
  for (const id of pedidos) await chamar('DELETE', `/procuras/${id}`, { cookie: comprador })
  await db.query("DELETE FROM notificacao WHERE tipo = 'procura_atendida'")
  await db.query('DELETE FROM comparecimento')
  servidor.close(); servidor.closeAllConnections(); await db.end()
})

describe('Procura-se', () => {
  let id
  test('precisa de login; título e bairro são obrigatórios; valor máximo tem que ser maior que zero', async () => {
    assert.equal((await chamar('POST', '/procuras', { json: { titulo: 'Escrivaninha', bairro_id: 1 } })).status, 401)
    assert.equal((await chamar('POST', '/procuras', { cookie: comprador, json: { titulo: 'Es', bairro_id: 1 } })).status, 400)
    assert.equal((await chamar('POST', '/procuras', { cookie: comprador, json: { titulo: 'Escrivaninha' } })).status, 400)
    assert.equal((await chamar('POST', '/procuras', { cookie: comprador, json: { titulo: 'Escrivaninha', bairro_id: 999999 } })).status, 400)
    assert.equal((await chamar('POST', '/procuras', { cookie: comprador, json: { titulo: 'Escrivaninha', bairro_id: 1, preco_max: '0' } })).status, 400)
  })
  test('publica o pedido e ele aparece para todo mundo, sem e-mail nem telefone de quem pediu', async () => {
    const r = await chamar('POST', '/procuras', { cookie: comprador, json: { titulo: 'Violão para iniciante', bairro_id: 1, categoria_id: 1, preco_max: '150' } })
    assert.equal(r.status, 201); id = r.dados.id; pedidos.push(id)
    assert.equal(r.dados.preco_max, 150); assert.equal(r.dados.cidade, 'Viçosa'); assert.equal(r.dados.eh_minha, true)
    const publico = (await chamar('GET', '/procuras')).dados.itens.find((p) => p.id === id)
    assert.equal(publico.titulo, 'Violão para iniciante'); assert.equal(publico.eh_minha, false)
    assert.deepEqual(Object.keys(publico.usuario).sort(), ['foto_url', 'id', 'nome', 'vinculo_academico'])
    assert.equal((await chamar('GET', '/procuras?cidade_id=1')).dados.itens.some((p) => p.id === id), true)
    assert.equal((await chamar('GET', '/procuras?cidade_id=2')).dados.itens.some((p) => p.id === id), false)
  })
  test('palavras do pedido: ignora acento, maiúscula e palavras sem significado', () => {
    assert.deepEqual(palavrasDoPedido('Procuro um Violão usado, até R$ 150'), ['violao', '150'])
    assert.equal(combina('Violão para iniciante', { titulo: 'VIOLAO Yamaha', descricao: null }), true)
    assert.equal(combina('Violão para iniciante', { titulo: 'Guitarra', descricao: 'Troco por violão.' }), true)
    assert.equal(combina('Violão para iniciante', { titulo: 'Geladeira Brastemp', descricao: 'Funciona bem.' }), false)
  })
  test('anúncio compatível avisa quem procura e quem publicou; fora do preço ou sem relação não avisa', async () => {
    const caro = await publicar({ titulo: `Violão caro ${Date.now()}`, preco: '900' })
    const outro = await publicar({ titulo: `Cadeira de madeira ${Date.now()}` })
    const certo = await publicar({ titulo: `Violão Giannini ${Date.now()}`, preco: '140' })
    const aviso = await esperarAviso(comprador, (n) => n.tipo === 'procura_atendida' && n.anuncio_id === certo.dados.id)
    assert.ok(aviso, 'quem procura deveria receber o aviso')
    assert.match(aviso.titulo, /^Apareceu o que você procura: Violão Giannini/)
    const paraVendedor = await esperarAviso(vendedor, (n) => n.tipo === 'procura_atendida' && n.anuncio_id === certo.dados.id)
    assert.ok(paraVendedor, 'quem publicou deveria saber que tem gente procurando')
    assert.match(paraVendedor.titulo, /^1 pessoa procura/)
    const dosOutros = (await avisosDe(comprador)).filter((n) => n.tipo === 'procura_atendida' && [caro.dados.id, outro.dados.id].includes(n.anuncio_id))
    assert.equal(dosOutros.length, 0)
  })
  test('só quem publicou exclui o pedido', async () => {
    assert.equal((await chamar('DELETE', `/procuras/${id}`, { cookie: vendedor })).status, 403)
    assert.equal((await chamar('DELETE', `/procuras/${id}`, { cookie: comprador })).status, 204)
    assert.equal((await chamar('DELETE', `/procuras/${id}`, { cookie: comprador })).status, 404)
    pedidos.splice(pedidos.indexOf(id), 1)
  })
})

describe('Compromisso nas entregas', () => {
  let conversaId
  test('a pergunta só vale depois da venda e para quem participa da conversa', async () => {
    const anuncio = await publicar({ titulo: `Mesa do compromisso ${Date.now()}` })
    conversaId = (await chamar('POST', '/conversas', { cookie: comprador, json: { anuncio_id: anuncio.dados.id } })).dados.conversa.id
    assert.equal((await chamar('POST', `/conversas/${conversaId}/comparecimento`, { cookie: comprador, json: { compareceu: true } })).status, 409)
    await chamar('PATCH', `/anuncios/${anuncio.dados.id}/status`, { cookie: vendedor, json: { status: 'vendido' } })
    assert.equal((await chamar('POST', `/conversas/${conversaId}/comparecimento`, { cookie: await entrar(1), json: { compareceu: true } })).status, 403)
    assert.equal((await chamar('POST', `/conversas/${conversaId}/comparecimento`, { cookie: comprador, json: { compareceu: 'sim' } })).status, 400)
    assert.equal((await chamar('GET', `/conversas/${conversaId}/comparecimento`, { cookie: comprador })).dados.comparecimento, null)
  })
  test('cada lado responde uma vez e a taxa aparece no perfil público de quem foi avaliado', async () => {
    const antes = (await chamar('GET', '/usuarios/3')).dados.usuario.compromisso
    const r = await chamar('POST', `/conversas/${conversaId}/comparecimento`, { cookie: comprador, json: { compareceu: true } })
    assert.equal(r.status, 201); assert.equal(r.dados.comparecimento.compareceu, true)
    assert.equal((await chamar('POST', `/conversas/${conversaId}/comparecimento`, { cookie: comprador, json: { compareceu: false } })).status, 409)
    assert.equal((await chamar('GET', `/conversas/${conversaId}/comparecimento`, { cookie: comprador })).dados.comparecimento.compareceu, true)

    const doVendedor = (await chamar('GET', '/usuarios/3')).dados.usuario.compromisso
    assert.equal(doVendedor.respostas, antes.respostas + 1); assert.equal(doVendedor.compareceu, antes.compareceu + 1)
    assert.equal(doVendedor.taxa, Math.round((doVendedor.compareceu / doVendedor.respostas) * 100))

    // o vendedor diz que o comprador não apareceu: a taxa do comprador cai
    assert.equal((await chamar('POST', `/conversas/${conversaId}/comparecimento`, { cookie: vendedor, json: { compareceu: false } })).status, 201)
    const doComprador = (await chamar('GET', '/perfil', { cookie: comprador })).dados.compromisso
    assert.equal(doComprador.respostas, 1); assert.equal(doComprador.compareceu, 0); assert.equal(doComprador.taxa, 0)
  })
})
