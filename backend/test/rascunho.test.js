// Rascunho: criar agora e publicar depois.
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const servidor = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)) })
const base = `http://127.0.0.1:${servidor.address().port}/api`
let dono, outro, foto
const criados = []

async function chamar(metodo, caminho, { cookie, json, form } = {}) {
  const headers = cookie ? { Cookie: cookie } : {}
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(base + caminho, { method: metodo, headers, body: json !== undefined ? JSON.stringify(json) : form })
  const t = await r.text()
  return { status: r.status, dados: t ? JSON.parse(t) : null }
}
const entrar = async (id) => (await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })).headers.get('set-cookie').split(';')[0]
function formulario(campos, fotos = 0) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.append(k, v)
  for (let i = 0; i < fotos; i += 1) f.append('fotos', new Blob([foto], { type: 'image/jpeg' }), 'f.jpg')
  return f
}
before(async () => {
  dono = await entrar(3); outro = await entrar(2)
  foto = await sharp({ create: { width: 500, height: 400, channels: 3, background: '#3E8B22' } }).jpeg().toBuffer()
})
after(async () => {
  for (const id of criados) await chamar('DELETE', `/anuncios/${id}`, { cookie: dono })
  servidor.close(); servidor.closeAllConnections(); await db.end()
})

describe('Rascunho', () => {
  let id
  test('salva incompleto, sem foto; vazio é 400', async () => {
    assert.equal((await chamar('POST', '/anuncios', { cookie: dono, form: formulario({ status: 'rascunho' }) })).status, 400)
    const r = await chamar('POST', '/anuncios', { cookie: dono, form: formulario({ status: 'rascunho', titulo: 'So' }) })
    assert.equal(r.status, 201); id = r.dados.id; criados.push(id)
    assert.equal(r.dados.status, 'rascunho'); assert.equal(r.dados.data_publicacao, null); assert.equal(r.dados.preco, null)
  })
  test('só o dono vê; outro usuário e visitante recebem 404', async () => {
    assert.equal((await chamar('GET', `/anuncios/${id}`, { cookie: dono })).status, 200)
    assert.equal((await chamar('GET', `/anuncios/${id}`, { cookie: outro })).status, 404)
    assert.equal((await chamar('GET', `/anuncios/${id}`)).status, 404)
    assert.equal((await chamar('POST', `/favoritos/${id}`, { cookie: outro })).status, 404)
    assert.equal((await chamar('PUT', `/anuncios/${id}`, { cookie: outro, json: { titulo: 'Invadido' } })).status, 403)
  })
  test('Meus anúncios mostra o que falta e o perfil não conta', async () => {
    const antes = (await chamar('GET', '/perfil', { cookie: dono })).dados.total_anuncios_ativos
    const card = (await chamar('GET', '/meus-anuncios', { cookie: dono })).dados.find((a) => a.id === id)
    assert.deepEqual(card.campos_faltando, ['fotos', 'titulo', 'categoria_id', 'condicao', 'preco', 'bairro_id', 'forma_entrega'])
    assert.equal(card.bairro, null); assert.equal(card.foto_capa, null); assert.ok(card.atualizado_em)
    assert.equal((await chamar('GET', '/perfil', { cookie: dono })).dados.total_anuncios_ativos, antes)
  })
  test('publicar incompleto é 400 com a lista de campos; vendido é 409', async () => {
    const r = await chamar('PATCH', `/anuncios/${id}/status`, { cookie: dono, json: { status: 'ativo' } })
    assert.equal(r.status, 400); assert.ok(r.dados.campos.includes('fotos'))
    assert.equal((await chamar('PATCH', `/anuncios/${id}/status`, { cookie: dono, json: { status: 'vendido' } })).status, 409)
    assert.equal((await chamar('PATCH', `/anuncios/${id}/status`, { cookie: dono, json: { status: 'rascunho' } })).status, 400)
  })
  test('completa, publica e passa a ser público', async () => {
    const e = await chamar('PUT', `/anuncios/${id}`, { cookie: dono, json: { titulo: 'Mesa de estudos', preco: 120, categoria_id: 1, condicao: 'usado', bairro_id: 1, forma_entrega: 'retirada' } })
    assert.equal(e.status, 200); assert.equal(e.dados.status, 'rascunho')
    assert.equal((await chamar('POST', `/anuncios/${id}/fotos`, { cookie: dono, form: formulario({}, 1) })).status, 200)
    const p = await chamar('PATCH', `/anuncios/${id}/status`, { cookie: dono, json: { status: 'ativo' } })
    assert.equal(p.status, 200); assert.equal(p.dados.status, 'ativo'); assert.ok(p.dados.data_publicacao)
    assert.equal((await chamar('GET', `/anuncios/${id}`)).status, 200)
    assert.ok(Math.abs(new Date(p.dados.data_publicacao) - Date.now()) < 60000, 'data em UTC correta')
  })
  test('rascunho pode ficar sem foto; publicado não', async () => {
    const r = await chamar('POST', '/anuncios', { cookie: dono, form: formulario({ status: 'rascunho', titulo: 'Com foto' }, 1) })
    criados.push(r.dados.id)
    assert.equal((await chamar('DELETE', `/anuncios/${r.dados.id}/fotos/${r.dados.fotos[0].id}`, { cookie: dono })).status, 200)
    const d = (await chamar('GET', `/anuncios/${id}`, { cookie: dono })).dados
    assert.equal((await chamar('DELETE', `/anuncios/${id}/fotos/${d.fotos[0].id}`, { cookie: dono })).status, 400)
  })
  test('publicar direto continua igual; categoria Serviços nunca guarda condição', async () => {
    const r = await chamar('POST', '/anuncios', { cookie: dono, form: formulario({ titulo: 'Aula de cálculo', preco: '50', categoria_id: '7', condicao: 'novo', bairro_id: '1', forma_entrega: 'combinar' }, 1) })
    criados.push(r.dados.id); assert.equal(r.status, 201); assert.equal(r.dados.status, 'ativo'); assert.equal(r.dados.condicao, null); assert.equal(r.dados.categoria_slug, 'servicos')
  })
  test('preço estranho e título invisível são 400, nunca 500', async () => {
    for (const campos of [{ preco: '1e3' }, { preco: '0x10' }, { titulo: '​​​' }]) {
      const r = await chamar('POST', '/anuncios', { cookie: dono, form: formulario({ titulo: 'Título ok', preco: '10', categoria_id: '1', condicao: 'usado', bairro_id: '1', forma_entrega: 'retirada', ...campos }, 1) })
      assert.equal(r.status, 400, JSON.stringify(campos))
    }
  })
  test('escolher a capa: só o dono; a foto escolhida vira a primeira', async () => {
    const r = await chamar('POST', '/anuncios', { cookie: dono, form: formulario({ status: 'rascunho', titulo: 'Duas fotos' }, 2) })
    criados.push(r.dados.id)
    const segunda = r.dados.fotos[1].id
    assert.equal((await chamar('PATCH', `/anuncios/${r.dados.id}/fotos/${segunda}/capa`, { cookie: outro })).status, 403)
    assert.equal((await chamar('PATCH', `/anuncios/${r.dados.id}/fotos/999999/capa`, { cookie: dono })).status, 404)
    const c = await chamar('PATCH', `/anuncios/${r.dados.id}/fotos/${segunda}/capa`, { cookie: dono })
    assert.equal(c.status, 200); assert.equal(c.dados.fotos[0].id, segunda); assert.deepEqual(c.dados.fotos.map((f) => f.ordem), [0, 1])
  })
  test('favoritos podem ser ordenados pelo preço; ordem inválida é 400', async () => {
    const precos = async (q) => (await chamar('GET', `/favoritos?ordenar=${q}`, { cookie: outro })).dados.itens.map((a) => a.preco)
    assert.deepEqual(await precos('menor_preco'), [780, 2450])
    assert.deepEqual(await precos('maior_preco'), [2450, 780])
    assert.equal((await chamar('GET', '/favoritos?ordenar=preco;DROP', { cookie: outro })).status, 400)
  })
  test('token bom de usuário que não existe mais é 401, nunca 500', async () => {
    const jwt = (await import('jsonwebtoken')).default
    const { env } = await import('../src/config/env.js')
    const cookie = `token=${jwt.sign({}, env.jwtSegredo, { subject: '9999', expiresIn: 600, algorithm: 'HS256' })}`
    assert.equal((await chamar('POST', '/favoritos/1', { cookie })).status, 401)
  })
})
