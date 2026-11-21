// Tag de transporte ("como levar"), status reservado e selo de vínculo acadêmico.
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { temVinculoAcademico } = await import('../src/utils/vinculo.js')
const servidor = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)) })
const base = `http://127.0.0.1:${servidor.address().port}/api`
let dono, outro, foto, servicos
const criados = []

async function chamar(metodo, caminho, { cookie, json, form } = {}) {
  const headers = cookie ? { Cookie: cookie } : {}
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(base + caminho, { method: metodo, headers, body: json !== undefined ? JSON.stringify(json) : form })
  const t = await r.text()
  return { status: r.status, dados: t ? JSON.parse(t) : null }
}
const entrar = async (id) => (await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })).headers.getSetCookie()[0].split(';')[0]
function formulario(campos, fotos = 1) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.append(k, v)
  for (let i = 0; i < fotos; i += 1) f.append('fotos', new Blob([foto], { type: 'image/jpeg' }), 'f.jpg')
  return f
}
const anuncio = (extras = {}) => ({
  titulo: `Teste das novidades ${Date.now()}-${criados.length}`, preco: '90', categoria_id: '1', subcategoria_id: '1',
  bairro_id: '1', condicao: 'usado', forma_entrega: 'retirada', ...extras,
})
async function publicar(extras) {
  const r = await chamar('POST', '/anuncios', { cookie: dono, form: formulario(anuncio(extras)) })
  if (r.status === 201) criados.push(r.dados.id)
  return r
}
const naBusca = async (titulo) => (await chamar('GET', `/anuncios?busca=${encodeURIComponent(titulo)}`)).dados.itens

before(async () => {
  dono = await entrar(3); outro = await entrar(2)
  foto = await sharp({ create: { width: 500, height: 400, channels: 3, background: '#3E8B22' } }).jpeg().toBuffer()
  servicos = (await chamar('GET', '/categorias')).dados.find((c) => c.slug === 'servicos')
})
after(async () => {
  for (const id of criados) await chamar('DELETE', `/anuncios/${id}`, { cookie: dono })
  servidor.close(); servidor.closeAllConnections(); await db.end()
})

describe('Tag de transporte', () => {
  let id
  test('publica com a tag e ela aparece no detalhe, no card e na busca', async () => {
    const r = await publicar({ transporte: 'mochila' })
    assert.equal(r.status, 201); id = r.dados.id
    assert.equal(r.dados.transporte, 'mochila')
    assert.equal((await chamar('GET', `/anuncios/${id}`)).dados.transporte, 'mochila')
    assert.equal((await chamar('GET', '/meus-anuncios', { cookie: dono })).dados.find((a) => a.id === id).transporte, 'mochila')
    assert.equal((await naBusca(r.dados.titulo))[0].transporte, 'mochila')
  })
  test('valor fora da lista é 400; sem a tag o anúncio é aceito (fica null)', async () => {
    const invalido = await chamar('POST', '/anuncios', { cookie: dono, form: formulario(anuncio({ transporte: 'caminhao' })) })
    assert.equal(invalido.status, 400)
    const sem = await publicar()
    assert.equal(sem.status, 201); assert.equal(sem.dados.transporte, null)
  })
  test('editar troca a tag; em Serviços ela não existe', async () => {
    const editado = await chamar('PUT', `/anuncios/${id}`, { cookie: dono, json: { transporte: 'carreto' } })
    assert.equal(editado.status, 200); assert.equal(editado.dados.transporte, 'carreto')
    assert.equal((await chamar('PUT', `/anuncios/${id}`, { cookie: dono, json: { transporte: 'aviao' } })).status, 400)
    const servico = await publicar({ categoria_id: String(servicos.id), subcategoria_id: '', condicao: '', transporte: 'carro' })
    assert.equal(servico.status, 201); assert.equal(servico.dados.transporte, null)
  })
})

describe('Status reservado', () => {
  let id, titulo
  test('o dono reserva: o anúncio continua na busca e no perfil público, com o status novo', async () => {
    const r = await publicar({ transporte: 'carro' })
    id = r.dados.id; titulo = r.dados.titulo
    const antes = (await chamar('GET', '/perfil', { cookie: dono })).dados.total_anuncios_ativos
    const reservado = await chamar('PATCH', `/anuncios/${id}/status`, { cookie: dono, json: { status: 'reservado' } })
    assert.equal(reservado.status, 200); assert.equal(reservado.dados.status, 'reservado')
    assert.equal((await naBusca(titulo))[0].status, 'reservado')
    const publico = (await chamar('GET', '/usuarios/3')).dados
    assert.equal(publico.anuncios.find((a) => a.id === id).status, 'reservado')
    assert.equal((await chamar('GET', '/perfil', { cookie: dono })).dados.total_anuncios_ativos, antes)
  })
  test('só o dono muda o status; reservado ainda aceita conversa', async () => {
    assert.equal((await chamar('PATCH', `/anuncios/${id}/status`, { cookie: outro, json: { status: 'ativo' } })).status, 403)
    const conversa = await chamar('POST', '/conversas', { cookie: outro, json: { anuncio_id: id } })
    assert.equal(conversa.status, 201)
  })
  test('volta para disponível; vendido sai da busca; status desconhecido é 400', async () => {
    assert.equal((await chamar('PATCH', `/anuncios/${id}/status`, { cookie: dono, json: { status: 'ativo' } })).dados.status, 'ativo')
    assert.equal((await chamar('PATCH', `/anuncios/${id}/status`, { cookie: dono, json: { status: 'pausado' } })).status, 400)
    assert.equal((await chamar('PATCH', `/anuncios/${id}/status`, { cookie: dono, json: { status: 'vendido' } })).dados.status, 'vendido')
    assert.equal((await naBusca(titulo)).length, 0)
  })
  test('rascunho não pode ser reservado', async () => {
    const rascunho = await chamar('POST', '/anuncios', { cookie: dono, form: formulario({ status: 'rascunho', titulo: 'Rascunho das novidades' }, 0) })
    criados.push(rascunho.dados.id)
    assert.equal((await chamar('PATCH', `/anuncios/${rascunho.dados.id}/status`, { cookie: dono, json: { status: 'reservado' } })).status, 409)
  })
})

describe('Selo de vínculo acadêmico', () => {
  test('vale para e-mail da UFV e da Univiçosa, inclusive subdomínio; domínio parecido não vale', () => {
    assert.equal(temVinculoAcademico('aluna@ufv.br'), true)
    assert.equal(temVinculoAcademico('Servidor@UFV.BR'), true)
    assert.equal(temVinculoAcademico('aluno@academico.univicosa.com.br'), true)
    assert.equal(temVinculoAcademico('alguem@gmail.com'), false)
    assert.equal(temVinculoAcademico('golpe@ufv.br.exemplo.com'), false)
    assert.equal(temVinculoAcademico('golpe@naoufv.br'), false)
    assert.equal(temVinculoAcademico(null), false)
  })
  test('aparece no perfil público e no vendedor do anúncio, sem mostrar o e-mail', async () => {
    const diego = (await chamar('GET', '/usuarios/1')).dados.usuario // diego.teste@ufv.br no seed
    assert.equal(diego.vinculo_academico, true)
    assert.equal('email' in diego, false)
    const semVinculo = (await chamar('GET', '/usuarios/3')).dados.usuario
    assert.equal(semVinculo.vinculo_academico, false)
    const vendedor = (await chamar('GET', '/anuncios/1')).dados.vendedor
    assert.equal(vendedor.vinculo_academico, true)
    assert.equal('email' in vendedor, false)
  })
  test('o próprio perfil também informa o selo', async () => {
    assert.equal((await chamar('GET', '/perfil', { cookie: dono })).dados.vinculo_academico, false)
    assert.equal((await chamar('GET', '/perfil', { cookie: await entrar(1) })).dados.vinculo_academico, true)
  })
})
