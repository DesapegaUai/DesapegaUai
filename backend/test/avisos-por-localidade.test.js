// Avisos de anúncio novo filtrados por localidade: quem escolhe uma cidade (e bairro) só é avisado
// dos anúncios de lá; sem localidade escolhida, continua valendo a distância.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'

process.env.PERMITIR_LOGIN_TESTE = 'true'
const { app } = await import('../src/app.js')
const { db } = await import('../src/config/db.js')
const repo = await import('../src/repositories/notificacaoRepository.js')

const servidor = await new Promise((pronto) => {
  const s = app.listen(0, '127.0.0.1', () => pronto(s))
})
const base = `http://127.0.0.1:${servidor.address().port}/api`
const TITULO = 'TESTE-LOCALIDADE'
const USUARIO = 3 // Usuário Teste: é quem recebe os avisos aqui

let cookie
let antes
let deVicosa // um anúncio ativo de Viçosa que não é do usuário 3
let deOutraCidade // um anúncio ativo de outra cidade que não é do usuário 3

const preferencias = async (json) => {
  const r = await fetch(`${base}/notificacoes/preferencias`, {
    method: json ? 'PUT' : 'GET', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: json ? JSON.stringify(json) : undefined,
  })
  return { status: r.status, dados: await r.json() }
}

// simula a publicação: cria os avisos do anúncio e diz se o usuário 3 recebeu
async function recebeu(anuncio) {
  const avisos = await repo.criarAvisosDeAnuncioNovo({
    id: anuncio.id, usuarioId: anuncio.usuario_id, titulo: TITULO, texto: 'teste', latitude: anuncio.latitude, longitude: anuncio.longitude,
  })
  await db.query('DELETE FROM notificacao WHERE titulo = ?', [TITULO])
  return avisos.some((a) => a.usuario_id === USUARIO)
}

before(async () => {
  const login = await fetch(`${base}/auth/teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: USUARIO }) })
  cookie = login.headers.get('set-cookie').split(';')[0]
  antes = (await preferencias()).dados

  const [anuncios] = await db.query(
    `SELECT a.id, a.usuario_id, a.bairro_id, b.cidade_id, b.latitude, b.longitude
       FROM anuncio a JOIN bairro b ON b.id = a.bairro_id
      WHERE a.status = 'ativo' AND a.usuario_id <> ?
      ORDER BY a.id`,
    [USUARIO],
  )
  deVicosa = anuncios.find((a) => a.cidade_id === 1)
  deOutraCidade = anuncios.find((a) => a.cidade_id !== 1)
  assert.ok(deVicosa && deOutraCidade, 'o seed precisa ter anúncio em Viçosa e em outra cidade')
})

after(async () => {
  await db.query('DELETE FROM notificacao WHERE titulo = ?', [TITULO])
  await preferencias({ cidade_id: null })
  await preferencias({ anuncios: antes.anuncios, mensagens: antes.mensagens, raio_km: antes.raio_km })
  if (antes.cidade) await preferencias({ cidade_id: antes.cidade.id, bairro_id: antes.bairro?.id ?? null })
  servidor.close()
  servidor.closeAllConnections()
  await db.end()
})

test('sem localidade escolhida e sem raio, recebe anúncio de qualquer cidade', async () => {
  const r = await preferencias({ anuncios: true, raio_km: null, cidade_id: null })
  assert.equal(r.status, 200)
  assert.equal(r.dados.cidade, null)
  assert.equal(await recebeu(deVicosa), true)
  assert.equal(await recebeu(deOutraCidade), true)
})

test('com uma cidade escolhida, só recebe os anúncios dela', async () => {
  const r = await preferencias({ cidade_id: deOutraCidade.cidade_id })
  assert.equal(r.status, 200)
  assert.equal(r.dados.cidade.id, deOutraCidade.cidade_id)
  assert.equal(r.dados.bairro, null)
  assert.equal(await recebeu(deOutraCidade), true)
  assert.equal(await recebeu(deVicosa), false)
})

test('com o bairro escolhido, só recebe os anúncios daquele bairro', async () => {
  const [[outroBairro]] = await db.query('SELECT id FROM bairro WHERE cidade_id = ? AND id <> ? LIMIT 1', [deOutraCidade.cidade_id, deOutraCidade.bairro_id])

  assert.equal((await preferencias({ cidade_id: deOutraCidade.cidade_id, bairro_id: deOutraCidade.bairro_id })).dados.bairro.id, deOutraCidade.bairro_id)
  assert.equal(await recebeu(deOutraCidade), true)

  if (outroBairro) {
    assert.equal((await preferencias({ bairro_id: outroBairro.id })).status, 200)
    assert.equal(await recebeu(deOutraCidade), false) // mesma cidade, outro bairro
  }
})

test('trocar de cidade apaga o bairro antigo, e desligar os avisos para tudo', async () => {
  await preferencias({ cidade_id: deOutraCidade.cidade_id, bairro_id: deOutraCidade.bairro_id })
  const trocou = await preferencias({ cidade_id: 1 })
  assert.equal(trocou.dados.cidade.id, 1)
  assert.equal(trocou.dados.bairro, null)
  assert.equal(await recebeu(deVicosa), true)

  await preferencias({ anuncios: false })
  assert.equal(await recebeu(deVicosa), false)
})

test('cidade que não existe, bairro de outra cidade e bairro sem cidade respondem 400', async () => {
  await preferencias({ cidade_id: null })
  assert.equal((await preferencias({ cidade_id: 999999 })).status, 400)
  assert.equal((await preferencias({ cidade_id: 1, bairro_id: deOutraCidade.bairro_id })).status, 400)
  assert.equal((await preferencias({ bairro_id: deOutraCidade.bairro_id })).status, 400)
  assert.equal((await preferencias()).dados.cidade, null)
})
