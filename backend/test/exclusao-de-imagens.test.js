// Exclusão de imagens: o registro do banco e o arquivo do disco saem juntos, só quem é dono apaga,
// e o que sobra de uma falha (arquivo sem registro, registro sem arquivo) a conferência de fotos corrige.
// Nos testes as fotos ficam em uma pasta temporária (veja utils/fotos.js), separada das fotos do site.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import sharp from 'sharp'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const { conferirFotos } = await import('../src/services/conferenciaDeFotos.js')
const { simularFalhaAoApagar } = await import('../src/utils/arquivos.js')
const { PASTA_PRIVADA, PASTA_UPLOADS } = await import('../src/utils/fotos.js')
const { gerarToken } = await import('../src/utils/token.js')
const servidor = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)) })
const raiz = `http://127.0.0.1:${servidor.address().port}`
const base = `${raiz}/api`
let dono, outro, foto
const criados = []

async function chamar(metodo, caminho, { cookie, json, form } = {}) {
  const headers = cookie ? { Cookie: cookie } : {}
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(base + caminho, { method: metodo, headers, body: json !== undefined ? JSON.stringify(json) : form })
  const t = await r.text()
  let dados = null
  try { dados = t ? JSON.parse(t) : null } catch { /* não é JSON */ }
  return { status: r.status, dados }
}
const entrar = async (id) => (await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: id }) })).headers.getSetCookie()[0].split(';')[0]
function fotos(quantas, campo = 'fotos', campos = {}) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.append(k, v)
  for (let i = 0; i < quantas; i += 1) f.append(campo, new Blob([foto], { type: 'image/jpeg' }), `f${i}.jpg`)
  return f
}
async function publicar(cookie, quantas) {
  const campos = { titulo: `Exclusão de imagens ${Date.now()}-${criados.length}`, preco: '40', categoria_id: '1', subcategoria_id: '1', bairro_id: '1', condicao: 'usado', forma_entrega: 'retirada' }
  const r = await chamar('POST', '/anuncios', { cookie, form: fotos(quantas, 'fotos', campos) })
  assert.equal(r.status, 201, JSON.stringify(r.dados))
  criados.push([r.dados.id, cookie])
  return r.dados
}
const arquivos = (pasta) => fs.readdir(pasta).catch(() => [])
const pastaDoAnuncio = (id) => path.join(PASTA_UPLOADS, 'anuncios', String(id))
const pastaDaConversa = (id) => path.join(PASTA_PRIVADA, 'conversas', String(id))
const pastaDoPerfil = (id) => path.join(PASTA_UPLOADS, 'perfis', String(id))
const abre = async (url) => (await fetch(raiz + url)).status
const registros = async (sql, valores) => Number(Object.values((await db.query(sql, valores))[0][0])[0])

before(async () => {
  dono = await entrar(3); outro = await entrar(2)
  foto = await sharp({ create: { width: 500, height: 400, channels: 3, background: '#3E8B22' } }).jpeg().toBuffer()
})
after(async () => {
  simularFalhaAoApagar(false)
  await db.query('DROP TRIGGER IF EXISTS falha_do_teste_de_fotos')
  for (const [id, cookie] of criados) await chamar('DELETE', `/anuncios/${id}`, { cookie })
  await chamar('DELETE', '/perfil/foto', { cookie: dono })
  servidor.close(); servidor.closeAllConnections(); await db.end()
})

describe('Foto de anúncio', () => {
  test('excluir uma foto apaga o registro e os 3 arquivos dela, e só dela', async () => {
    const anuncio = await publicar(dono, 3)
    assert.equal((await arquivos(pastaDoAnuncio(anuncio.id))).length, 9)
    const [, segunda] = anuncio.fotos

    const r = await chamar('DELETE', `/anuncios/${anuncio.id}/fotos/${segunda.id}`, { cookie: dono })
    assert.equal(r.status, 200)
    assert.deepEqual(r.dados.fotos.map((f) => f.id), [anuncio.fotos[0].id, anuncio.fotos[2].id])
    assert.equal(await registros('SELECT COUNT(*) FROM foto_anuncio WHERE anuncio_id = ?', [anuncio.id]), 2)
    assert.equal((await arquivos(pastaDoAnuncio(anuncio.id))).length, 6)
    assert.equal(await abre(segunda.pequena), 404, 'a foto excluída não abre mais')
    assert.equal(await abre(anuncio.fotos[0].grande), 200, 'as outras continuam abrindo')
  })

  test('cada foto tem o seu arquivo: a mesma imagem em dois anúncios não é compartilhada', async () => {
    const a = await publicar(dono, 1); const b = await publicar(dono, 2)
    assert.notEqual(path.basename(a.fotos[0].pequena), path.basename(b.fotos[0].pequena))
    assert.equal((await chamar('DELETE', `/anuncios/${b.id}/fotos/${b.fotos[1].id}`, { cookie: dono })).status, 200)
    assert.equal((await arquivos(pastaDoAnuncio(a.id))).length, 3, 'o anúncio vizinho ficou inteiro')
    assert.equal(await abre(a.fotos[0].media), 200)
  })

  test('quem não é o dono não apaga; id de foto de outro anúncio não vale', async () => {
    const meu = await publicar(dono, 2); const alheio = await publicar(outro, 2)
    assert.equal((await chamar('DELETE', `/anuncios/${alheio.id}/fotos/${alheio.fotos[0].id}`, { cookie: dono })).status, 403)
    assert.equal((await chamar('DELETE', `/anuncios/${alheio.id}/fotos/${alheio.fotos[0].id}`)).status, 401)
    // meu anúncio, mas o id é da foto de outra pessoa: não pode apagar arquivo de outro registro
    assert.equal((await chamar('DELETE', `/anuncios/${meu.id}/fotos/${alheio.fotos[0].id}`, { cookie: dono })).status, 404)
    assert.equal((await arquivos(pastaDoAnuncio(alheio.id))).length, 6)
    assert.equal(await registros('SELECT COUNT(*) FROM foto_anuncio WHERE anuncio_id = ?', [alheio.id]), 2)
  })

  test('arquivo que já não existe no disco não vira erro 500', async () => {
    const anuncio = await publicar(dono, 2)
    for (const nome of await arquivos(pastaDoAnuncio(anuncio.id))) await fs.rm(path.join(pastaDoAnuncio(anuncio.id), nome))
    const r = await chamar('DELETE', `/anuncios/${anuncio.id}/fotos/${anuncio.fotos[1].id}`, { cookie: dono })
    assert.equal(r.status, 200)
    assert.equal(r.dados.fotos.length, 1)
    await fs.rm(pastaDoAnuncio(anuncio.id), { recursive: true, force: true })
    assert.equal((await chamar('DELETE', `/anuncios/${anuncio.id}`, { cookie: dono })).status, 204)
  })
})

describe('Anúncio inteiro e foto de perfil', () => {
  test('excluir o anúncio apaga todas as fotos dele e as fotos mandadas nas conversas dele', async () => {
    const anuncio = await publicar(dono, 3)
    const conversa = (await chamar('POST', '/conversas', { cookie: outro, json: { anuncio_id: anuncio.id } })).dados.conversa
    assert.equal((await chamar('POST', `/conversas/${conversa.id}/fotos`, { cookie: outro, form: fotos(2) })).status, 201)
    assert.equal((await arquivos(pastaDaConversa(conversa.id))).length, 4)

    assert.equal((await chamar('DELETE', `/anuncios/${anuncio.id}`, { cookie: dono })).status, 204)
    assert.deepEqual(await arquivos(pastaDoAnuncio(anuncio.id)), [])
    assert.deepEqual(await arquivos(pastaDaConversa(conversa.id)), [])
    assert.equal(await registros('SELECT COUNT(*) FROM foto_anuncio WHERE anuncio_id = ?', [anuncio.id]), 0)
    assert.equal(await registros('SELECT COUNT(*) FROM mensagem WHERE conversa_id = ?', [conversa.id]), 0)
    assert.equal(await abre(anuncio.fotos[0].pequena), 404)
  })

  test('foto de perfil: trocar apaga a antiga; remover apaga o arquivo e limpa o registro', async () => {
    const primeira = await chamar('PUT', '/perfil/foto', { cookie: dono, form: fotos(1, 'foto') })
    assert.equal(primeira.status, 200)
    assert.equal((await arquivos(pastaDoPerfil(3))).length, 1)
    const segunda = await chamar('PUT', '/perfil/foto', { cookie: dono, form: fotos(1, 'foto') })
    assert.notEqual(segunda.dados.foto_url, primeira.dados.foto_url)
    assert.deepEqual(await arquivos(pastaDoPerfil(3)), [path.basename(segunda.dados.foto_url)])
    assert.equal(await abre(primeira.dados.foto_url), 404)

    const removida = await chamar('DELETE', '/perfil/foto', { cookie: dono })
    assert.equal(removida.status, 200); assert.equal(removida.dados.foto_url, null)
    assert.deepEqual(await arquivos(pastaDoPerfil(3)), [])
    assert.equal((await chamar('DELETE', '/perfil/foto', { cookie: dono })).status, 200, 'remover de novo, sem foto, não dá erro')
  })
})

describe('Falhas parciais e conferência de fotos', () => {
  test('falha ao apagar o arquivo: o pedido termina bem e a conferência apaga o que sobrou', async () => {
    const anuncio = await publicar(dono, 2)
    simularFalhaAoApagar(true)
    const r = await chamar('DELETE', `/anuncios/${anuncio.id}/fotos/${anuncio.fotos[1].id}`, { cookie: dono })
    simularFalhaAoApagar(false)
    assert.equal(r.status, 200); assert.equal(r.dados.fotos.length, 1)
    assert.equal((await arquivos(pastaDoAnuncio(anuncio.id))).length, 6, 'os 3 arquivos da foto ficaram no disco')

    const achados = (await conferirFotos({ idadeMinimaMs: 0 })).orfaos.filter((o) => o.caminho.startsWith(`anuncios/${anuncio.id}/`))
    assert.equal(achados.length, 3); assert.equal(achados.every((o) => !o.apagado), true, 'sem corrigir, só lista')
    await conferirFotos({ corrigir: true, idadeMinimaMs: 0 })
    assert.equal((await arquivos(pastaDoAnuncio(anuncio.id))).length, 3)
    assert.equal(await abre(anuncio.fotos[0].pequena), 200, 'a foto que ficou continua inteira')
  })

  test('falha ao apagar o registro no banco: nada é apagado', async () => {
    const anuncio = await publicar(dono, 2)
    await db.query("CREATE TRIGGER falha_do_teste_de_fotos BEFORE DELETE ON foto_anuncio FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'falha simulada'")
    let resposta
    try {
      resposta = await chamar('DELETE', `/anuncios/${anuncio.id}/fotos/${anuncio.fotos[1].id}`, { cookie: dono })
    } finally {
      await db.query('DROP TRIGGER IF EXISTS falha_do_teste_de_fotos')
    }
    assert.equal(resposta.status, 500)
    assert.equal(await registros('SELECT COUNT(*) FROM foto_anuncio WHERE anuncio_id = ?', [anuncio.id]), 2)
    assert.equal((await arquivos(pastaDoAnuncio(anuncio.id))).length, 6)
    assert.equal(await abre(anuncio.fotos[1].grande), 200)
  })

  test('arquivos órfãos: a conferência acha, espera os novos e apaga só o que não tem registro', async () => {
    const anuncio = await publicar(dono, 1)
    const semDono = path.join(PASTA_UPLOADS, 'anuncios', '999999')
    const conversaSemDono = path.join(PASTA_PRIVADA, 'conversas', '888888')
    await fs.mkdir(semDono, { recursive: true }); await fs.mkdir(conversaSemDono, { recursive: true })
    await fs.writeFile(path.join(semDono, `${'a'.repeat(32)}-400.webp`), foto)
    await fs.writeFile(path.join(conversaSemDono, `${'b'.repeat(32)}-480.webp`), foto)
    await fs.writeFile(path.join(pastaDoAnuncio(anuncio.id), 'solto.txt'), 'sobra')

    // arquivo recém-criado pode ser de um envio em andamento: com a espera de 1 hora ele não entra
    const comEspera = await conferirFotos({})
    assert.equal(comEspera.orfaos.some((o) => o.caminho.includes('999999') || o.caminho.includes('solto.txt')), false)

    const relatorio = await conferirFotos({ corrigir: true, idadeMinimaMs: 0 })
    const apagados = relatorio.orfaos.filter((o) => o.apagado).map((o) => o.caminho)
    assert.ok(apagados.includes('anuncios/999999')); assert.ok(apagados.includes('conversas/888888'))
    assert.ok(apagados.includes(`anuncios/${anuncio.id}/solto.txt`))
    assert.deepEqual(await arquivos(semDono), []); assert.deepEqual(await arquivos(conversaSemDono), [])
    assert.equal((await arquivos(pastaDoAnuncio(anuncio.id))).length, 3, 'a foto com registro ficou')
  })

  test('registro sem arquivo: a conferência tira o registro, e a foto quebrada some do anúncio', async () => {
    const anuncio = await publicar(dono, 2)
    const quebrada = anuncio.fotos[1]
    await fs.rm(path.join(pastaDoAnuncio(anuncio.id), path.basename(quebrada.media)))

    const antes = await conferirFotos({ idadeMinimaMs: 0 })
    assert.ok(antes.semArquivo.some((r) => r.tipo === 'foto_anuncio' && r.id === quebrada.id && !r.corrigido))
    await conferirFotos({ corrigir: true, idadeMinimaMs: 0 })
    const depois = (await chamar('GET', `/anuncios/${anuncio.id}`)).dados
    assert.deepEqual(depois.fotos.map((f) => f.id), [anuncio.fotos[0].id])
    assert.equal((await arquivos(pastaDoAnuncio(anuncio.id))).length, 3, 'o que restava da foto quebrada também saiu')
  })
})

describe('Exclusão de conta', () => {
  test('a conta sai com os anúncios, as conversas e todas as fotos; as outras contas ficam inteiras', async () => {
    const [nova] = await db.query("INSERT INTO usuario (google_id, nome, email) VALUES (?, 'Conta Para Excluir', ?)", [`conta-do-teste-${Date.now()}`, `excluir-${Date.now()}@example.com`])
    const id = nova.insertId
    const cookie = `token=${gerarToken(id)}`

    assert.equal((await chamar('PUT', '/perfil/foto', { cookie, form: fotos(1, 'foto') })).status, 200)
    const anuncio = await publicar(cookie, 2)
    const alheio = await publicar(dono, 1)
    // compra de outra pessoa e venda própria: as duas conversas têm foto
    const compra = (await chamar('POST', '/conversas', { cookie, json: { anuncio_id: alheio.id } })).dados.conversa
    const venda = (await chamar('POST', '/conversas', { cookie: outro, json: { anuncio_id: anuncio.id } })).dados.conversa
    await chamar('POST', `/conversas/${compra.id}/fotos`, { cookie, form: fotos(1) })
    await chamar('POST', `/conversas/${venda.id}/fotos`, { cookie: outro, form: fotos(1) })

    assert.equal((await chamar('DELETE', '/perfil', { cookie, json: {} })).status, 400, 'sem a confirmação não exclui')
    assert.equal(await registros('SELECT COUNT(*) FROM usuario WHERE id = ?', [id]), 1)
    assert.equal((await chamar('DELETE', '/perfil', { cookie, json: { confirmar: 'EXCLUIR' } })).status, 204)

    assert.equal(await registros('SELECT COUNT(*) FROM usuario WHERE id = ?', [id]), 0)
    assert.equal(await registros('SELECT COUNT(*) FROM anuncio WHERE id = ?', [anuncio.id]), 0)
    assert.equal(await registros('SELECT COUNT(*) FROM conversa WHERE id IN (?, ?)', [compra.id, venda.id]), 0)
    for (const pasta of [pastaDoPerfil(id), pastaDoAnuncio(anuncio.id), pastaDaConversa(compra.id), pastaDaConversa(venda.id)]) {
      assert.deepEqual(await arquivos(pasta), [], pasta)
    }
    assert.equal((await chamar('GET', '/perfil', { cookie })).status, 401, 'o login antigo não entra mais')
    assert.equal((await arquivos(pastaDoAnuncio(alheio.id))).length, 3, 'o anúncio da outra pessoa ficou inteiro')
    assert.equal((await chamar('GET', '/perfil', { cookie: dono })).status, 200)
  })
})

describe('Integridade depois das exclusões', () => {
  test('não sobra arquivo sem registro nem registro sem arquivo', async () => {
    await conferirFotos({ corrigir: true, idadeMinimaMs: 0 })
    const final = await conferirFotos({ idadeMinimaMs: 0 })
    assert.deepEqual(final.orfaos, [])
    assert.deepEqual(final.semArquivo, [])
    assert.ok(final.registros > 0, 'ainda há fotos válidas no banco, e todas com arquivo')
  })
})
