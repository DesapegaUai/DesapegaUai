// Documentação da API (Swagger, em /api/docs): toda rota que existe no código aparece na documentação,
// e a documentação não descreve rota que não existe. Só o login de teste (que não funciona no site
// publicado) e o próprio arquivo da documentação ficam de fora.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { especificacao } from '../src/docs/openapi.js'

const ROTAS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'routes')
const FORA_DA_DOCUMENTACAO = new Set(['POST /api/auth/teste', 'GET /api/docs/openapi.json'])

// onde cada roteador é montado (src/routes/index.js)
function prefixos() {
  const indice = fs.readFileSync(path.join(ROTAS, 'index.js'), 'utf8')
  const mapa = { rotas: '/api' }
  for (const [, caminho, roteador] of indice.matchAll(/rotas\.use\('([^']+)',\s*(\w+)\)/g)) mapa[roteador] = `/api${caminho}`
  return mapa
}

function rotasDoCodigo() {
  const mapa = prefixos()
  const rotas = new Set()
  for (const arquivo of fs.readdirSync(ROTAS)) {
    const texto = fs.readFileSync(path.join(ROTAS, arquivo), 'utf8')
    for (const [, roteador, metodo, caminho] of texto.matchAll(/(\w+)\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
      if (!mapa[roteador]) continue
      const completo = `${mapa[roteador]}${caminho === '/' ? '' : caminho}`.replace(/:\w+/g, '{}')
      rotas.add(`${metodo.toUpperCase()} ${completo}`)
    }
  }
  return rotas
}

function rotasDocumentadas() {
  const rotas = new Set()
  for (const [caminho, operacoes] of Object.entries(especificacao.paths)) {
    for (const metodo of Object.keys(operacoes)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(metodo)) rotas.add(`${metodo.toUpperCase()} ${caminho.replace(/\{[^}]+\}/g, '{}')}`)
    }
  }
  return rotas
}

test('toda rota da API está na documentação (Swagger)', () => {
  const documentadas = rotasDocumentadas()
  const semDocumentacao = [...rotasDoCodigo()].filter((rota) => !FORA_DA_DOCUMENTACAO.has(rota.replace(/\{\}/g, '{}')) && !documentadas.has(rota)).sort()
  assert.deepEqual(semDocumentacao, [], `rotas sem documentação: ${semDocumentacao.join(', ')}`)
})

test('a documentação não descreve rota que não existe', () => {
  const doCodigo = rotasDoCodigo()
  const inventadas = [...rotasDocumentadas()].filter((rota) => !doCodigo.has(rota)).sort()
  assert.deepEqual(inventadas, [])
})

test('cada rota documentada tem seção, resumo e respostas; as que pedem login dizem isso', () => {
  for (const [caminho, operacoes] of Object.entries(especificacao.paths)) {
    for (const [metodo, op] of Object.entries(operacoes)) {
      const nome = `${metodo.toUpperCase()} ${caminho}`
      assert.ok(op.tags?.length, `${nome} sem seção`)
      assert.ok(op.summary, `${nome} sem resumo`)
      assert.ok(Object.keys(op.responses ?? {}).length, `${nome} sem respostas`)
      if (op.responses?.[401]) assert.ok(op.security, `${nome} responde 401 mas não diz que pede login`)
    }
  }
})
