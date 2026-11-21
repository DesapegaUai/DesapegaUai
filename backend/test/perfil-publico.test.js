// Perfil público do vendedor: qualquer pessoa vê, mas sem telefone, e-mail ou anúncios que não estão ativos.
import assert from 'node:assert/strict'
import { after, test } from 'node:test'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const base = `http://127.0.0.1:${servidor.address().port}/api`

after(async () => {
  servidor.close()
  servidor.closeAllConnections()
  await db.end()
})

test('mostra nome, foto, bio, números e os anúncios ativos, sem precisar de login', async () => {
  const resposta = await fetch(`${base}/usuarios/1`)
  assert.equal(resposta.status, 200)
  const { usuario, anuncios } = await resposta.json()

  assert.equal(usuario.id, 1)
  assert.equal(typeof usuario.nome, 'string')
  assert.equal(typeof usuario.online, 'boolean')
  for (const campo of ['foto_url', 'bio', 'criado_em', 'ultimo_acesso', 'total_anuncios_ativos', 'total_vendidos']) {
    assert.ok(campo in usuario, campo)
  }

  const [[{ ativos }]] = await db.query("SELECT COUNT(*) AS ativos FROM anuncio WHERE usuario_id = 1 AND status = 'ativo'")
  assert.equal(usuario.total_anuncios_ativos, ativos)
  assert.equal(anuncios.length, Math.min(ativos, 60))
  for (const anuncio of anuncios) {
    assert.equal(anuncio.status, 'ativo')
    assert.ok('foto_capa' in anuncio && 'preco' in anuncio && 'titulo' in anuncio)
  }
})

test('telefone, e-mail e outros dados privados não aparecem', async () => {
  const texto = await (await fetch(`${base}/usuarios/1`)).text()
  const [[privado]] = await db.query('SELECT email, telefone, google_id FROM usuario WHERE id = 1')
  const { usuario } = JSON.parse(texto)
  for (const campo of ['email', 'telefone', 'google_id', 'notificar_anuncios', 'total_favoritos', 'total_conversas']) {
    assert.equal(campo in usuario, false, campo)
  }
  for (const valor of [privado.email, privado.telefone, privado.google_id]) {
    if (valor) assert.equal(texto.includes(valor), false)
  }
})

test('usuário que não existe responde 404 e id inválido responde 400', async () => {
  assert.equal((await fetch(`${base}/usuarios/999999`)).status, 404)
  assert.equal((await fetch(`${base}/usuarios/abc`)).status, 400)
})
