// O que aparece na notificação do celular (push), no padrão dos apps grandes: título curto (no Android ele
// divide a linha com o nome do app e a hora, e título comprido corta), o resto no texto, a foto pequena do
// anúncio à direita e a média quando a pessoa puxa a notificação para baixo.
import assert from 'node:assert/strict'
import { test } from 'node:test'

const push = await import('../src/services/pushService.js')
const real = (valor) => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const cadeira = {
  id: 7,
  titulo: 'Cadeira de escritório',
  preco: '6450.00',
  bairro: 'Bela Vista',
  cidade: 'Presidente Bernardes',
  fotos: [
    { pequena: '/api/uploads/anuncios/7/capa-400.webp', media: '/api/uploads/anuncios/7/capa-800.webp', grande: '/api/uploads/anuncios/7/capa-1600.webp' },
    { pequena: '/api/uploads/anuncios/7/outra-400.webp', media: '/api/uploads/anuncios/7/outra-800.webp' },
  ],
}

test('anúncio novo: título curto, "anúncio · preço · lugar", a foto da capa pequena e a média', () => {
  assert.deepEqual(push.avisoDeAnuncio(cadeira, { titulo: 'Novo anúncio', tag: 'anuncio-7' }), {
    titulo: 'Novo anúncio',
    texto: `Cadeira de escritório · ${real(6450)} · Bela Vista, Presidente Bernardes`,
    url: '/anuncio/7',
    icone: '/api/uploads/anuncios/7/capa-400.webp',
    imagem: '/api/uploads/anuncios/7/capa-800.webp',
    tag: 'anuncio-7',
  })
})

test('queda de preço e Procura-se: o detalhe troca o preço e a chamada vem antes do anúncio', () => {
  const baixou = push.avisoDeAnuncio(cadeira, { titulo: 'Baixou o preço', detalhe: `de ${real(7000)} por ${real(6450)}`, tag: 'preco-7' })
  assert.equal(baixou.texto, `Cadeira de escritório · de ${real(7000)} por ${real(6450)} · Bela Vista, Presidente Bernardes`)
  const achamos = push.avisoDeAnuncio(cadeira, { titulo: 'Procura-se', chamada: 'Achamos: ', tag: 'procura-7' })
  assert.equal(achamos.texto, `Achamos: Cadeira de escritório · ${real(6450)} · Bela Vista, Presidente Bernardes`)
})

test('anúncio sem foto e sem bairro: sem imagem (o aparelho põe a logo) e sem "·" sobrando', () => {
  const aviso = push.avisoDeAnuncio({ id: 9, titulo: 'Sofá', preco: 300, cidade: 'Viçosa', fotos: [] }, { titulo: 'Lista de compras', tag: 'lista-9' })
  assert.equal(aviso.texto, `Sofá · ${real(300)} · Viçosa`)
  assert.equal(aviso.icone, null)
  assert.equal(aviso.imagem, null)
})

test('os títulos de todos os avisos cabem na linha do Android (até 18 letras)', () => {
  for (const titulo of ['Novo anúncio', 'Baixou o preço', 'Lista de compras', 'Procura-se', 'Nova avaliação', 'Anúncio em análise', 'Anúncio liberado', 'Anúncio removido']) {
    assert.ok(titulo.length <= 18, `${titulo} tem ${titulo.length} letras`)
  }
  assert.equal(push.avisoDeAvaliacao({ id: 1, nota: 5, avaliador_nome: 'Diego Martins', anuncio_titulo: 'Air fryer 4L' }).titulo, 'Nova avaliação')
})

test('avaliação: as estrelas e quem avaliou, com a foto dessa pessoa (ou as iniciais, sem foto)', () => {
  const semFoto = push.avisoDeAvaliacao({ id: 3, nota: 4, avaliador_nome: 'Diego Martins', avaliador_foto: null, anuncio_titulo: 'Air fryer 4L' })
  assert.deepEqual(semFoto, {
    titulo: 'Nova avaliação',
    texto: '★★★★☆ Diego Martins avaliou a negociação de Air fryer 4L.',
    url: '/perfil',
    icone: null,
    iniciais: 'DM',
    tag: 'avaliacao-3',
  })
  const comFoto = push.avisoDeAvaliacao({ id: 4, nota: 5, avaliador_nome: 'Larissa Andrade', avaliador_foto: '/api/uploads/perfis/2/foto.webp', anuncio_titulo: 'Sofá' })
  assert.equal(comFoto.icone, '/api/uploads/perfis/2/foto.webp')
  assert.equal(comFoto.iniciais, null)
})

test('estrelas e iniciais', () => {
  assert.equal(push.estrelas(5), '★★★★★')
  assert.equal(push.estrelas(1), '★☆☆☆☆')
  assert.equal(push.estrelas(7), '★★★★★')
  assert.equal(push.estrelas('x'), '☆☆☆☆☆')
  assert.equal(push.iniciaisDe('larissa  andrade souza'), 'LA')
  assert.equal(push.iniciaisDe(null), '')
})
