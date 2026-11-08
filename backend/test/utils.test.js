// Testes dos utils (não precisam do banco).
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { describe, test } from 'node:test'

// segredo só deste teste
process.env.JWT_SEGREDO = randomBytes(32).toString('hex')

const { lerId, lerTexto, lerOpcao } = await import('../src/utils/validacao.js')
const { caminhoDaFoto, formatarFoto, urlsDaFoto } = await import('../src/utils/fotos.js')
const { gerarToken, verificarToken, lerTokenDoCookie } = await import('../src/utils/token.js')

describe('validacao.js', () => {
  test('lerId aceita só número inteiro positivo', () => {
    assert.equal(lerId('12'), 12)
    assert.equal(lerId(7), 7)
    for (const ruim of ['abc', '1.5', '-3', '0', '', '12abc', '99999999999', 1.5, null, undefined]) {
      assert.throws(() => lerId(ruim), { status: 400 }, String(ruim))
    }
  })

  test('lerTexto tira os espaços das pontas, conta emoji como 1 e confere o tamanho', () => {
    assert.equal(lerTexto('  Sofá  ', 'titulo'), 'Sofá')
    assert.equal(lerTexto('   ', 'bio'), null)
    assert.equal(lerTexto('\u{1F44D}\u{1F44D}', 'texto', { max: 2 }), '\u{1F44D}\u{1F44D}')
    assert.throws(() => lerTexto('', 'nome', { obrigatorio: true }), { status: 400 })
    assert.throws(() => lerTexto('ab', 'titulo', { min: 3 }), { status: 400 })
    assert.throws(() => lerTexto('x'.repeat(81), 'titulo', { max: 80 }), { status: 400 })
    assert.throws(() => lerTexto(123, 'nome'), { status: 400 })
  })

  test('lerOpcao aceita só as opções da lista', () => {
    assert.equal(lerOpcao('usado', 'condicao', ['novo', 'seminovo', 'usado']), 'usado')
    assert.equal(lerOpcao(undefined, 'condicao', ['novo'], { obrigatorio: false }), null)
    assert.throws(() => lerOpcao('quebrado', 'condicao', ['novo', 'usado']), { status: 400 })
    assert.throws(() => lerOpcao(undefined, 'status', ['ativo', 'vendido']), { status: 400 })
  })
})

describe('fotos.js', () => {
  test('monta as 3 URLs do Contrato', () => {
    assert.deepEqual(urlsDaFoto(12, 'abc-123'), {
      pequena: '/api/uploads/anuncios/12/abc-123-400.webp',
      media: '/api/uploads/anuncios/12/abc-123-800.webp',
      grande: '/api/uploads/anuncios/12/abc-123-1600.webp',
    })
    assert.equal(formatarFoto(12, null), null)
    assert.deepEqual(Object.keys(formatarFoto(12, { id: 31, ordem: 0, arquivo: 'abc' })), [
      'id',
      'ordem',
      'pequena',
      'media',
      'grande',
    ])
  })

  test('recusa nome de foto ou id perigoso (nunca sai da pasta uploads)', () => {
    for (const ruim of ['../../.env', 'a/b', 'a\\b', 'foto.webp', '']) {
      assert.throws(() => caminhoDaFoto(12, ruim, 400), Error, ruim)
    }
    assert.throws(() => caminhoDaFoto('../1', 'abc', 400))
    assert.throws(() => caminhoDaFoto(12, 'abc', 999))
  })
})

describe('token.js', () => {
  test('o token gerado devolve o mesmo id; adulterado ou vazio não', () => {
    const token = gerarToken(5)
    assert.equal(verificarToken(token), 5)
    assert.equal(verificarToken(token.slice(0, -2) + (token.endsWith('xx') ? 'yy' : 'xx')), null)
    assert.equal(verificarToken(''), null)
    assert.equal(verificarToken(undefined), null)
  })

  test('lerTokenDoCookie acha o cookie "token" no meio dos outros', () => {
    assert.equal(lerTokenDoCookie('tema=escuro; token=abc.def.ghi; outro=1'), 'abc.def.ghi')
    assert.equal(lerTokenDoCookie('meutoken=x'), null)
    assert.equal(lerTokenDoCookie(undefined), null)
  })
})
