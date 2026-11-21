// Importa as cidades, bairros e ruas da Zona da Mata mineira (database/dados/zona-da-mata.json.gz).
// npm run locais (o npm run banco e o npm run atualizar já chamam).
// Não apaga usuários nem anúncios: cidade e bairro que já existem ficam com o mesmo id.
//
// De onde vêm os dados (veja o README): municípios, endereços (CNEFE), setores e bairros do
// Censo 2022 do IBGE; sedes dos municípios do projeto kelvins/municipios-brasileiros; e nomes de
// ruas do OpenStreetMap, usados só para colocar os acentos que o CNEFE não tem.
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import zlib from 'node:zlib'
import mysql from 'mysql2/promise'
import { env } from '../src/config/env.js'

const ARQUIVO = path.join(import.meta.dirname, 'dados', 'zona-da-mata.json.gz')
const LOTE = 500 // linhas por INSERT: cabe no max_allowed_packet de 1 MB do XAMPP

// mesma ideia do utf8mb4_unicode_ci: sem acento, sem maiúscula e sem pontuação
export const normalizarNome = (texto) =>
  String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export async function lerLocais() {
  return JSON.parse(zlib.gunzipSync(await fs.readFile(ARQUIVO)).toString('utf8'))
}

async function inserirEmLotes(conexao, sqlInicio, linhas, sqlFim = '') {
  for (let i = 0; i < linhas.length; i += LOTE) {
    const lote = linhas.slice(i, i + LOTE)
    const marcadores = lote.map((linha) => `(${linha.map(() => '?').join(', ')})`).join(', ')
    await conexao.query(`${sqlInicio} VALUES ${marcadores} ${sqlFim}`, lote.flat())
  }
}

export async function importarLocais(conexao, dados = null) {
  const locais = dados ?? (await lerLocais())

  // 1. cidades: as que já existem só ganham o CEP geral
  await inserirEmLotes(
    conexao,
    'INSERT INTO cidade (codigo_ibge, nome, uf, latitude, longitude, cep_geral)',
    locais.cidades.map((c) => [c.ibge, c.nome, 'MG', c.lat, c.lng, c.cep_geral]),
    'ON DUPLICATE KEY UPDATE cep_geral = VALUES(cep_geral)',
  )
  const [cidades] = await conexao.query('SELECT id, codigo_ibge FROM cidade')
  const cidadePorIbge = new Map(cidades.map((c) => [Number(c.codigo_ibge), c.id]))

  // 2. bairros: o banco compara sem acento (utf8mb4_unicode_ci), então "Clelia Bernardes" encontra
  //    o "Clélia Bernardes" do seed e mantém o nome e a coordenada de lá
  await inserirEmLotes(
    conexao,
    'INSERT INTO bairro (cidade_id, nome, distrito, rural, latitude, longitude)',
    locais.bairros.map((b) => [cidadePorIbge.get(b.ibge), b.nome, b.distrito, b.rural, b.lat, b.lng]),
    'ON DUPLICATE KEY UPDATE distrito = VALUES(distrito), rural = VALUES(rural)',
  )
  const [bairros] = await conexao.query('SELECT id, cidade_id, nome FROM bairro')
  const bairroPorNome = new Map()
  for (const b of bairros) {
    const chave = `${b.cidade_id}|${normalizarNome(b.nome)}`
    if (!bairroPorNome.has(chave)) bairroPorNome.set(chave, b.id)
  }
  const idDoBairro = locais.bairros.map((b) => bairroPorNome.get(`${cidadePorIbge.get(b.ibge)}|${normalizarNome(b.nome)}`) ?? null)

  // 3. ruas: nada aponta para elas, então troca tudo numa transação (quem consulta nunca vê a tabela vazia)
  await conexao.beginTransaction()
  try {
    await conexao.query('DELETE FROM rua')
    await inserirEmLotes(
      conexao,
      'INSERT INTO rua (cidade_id, bairro_id, nome, cep, latitude, longitude, numero_min, numero_max, enderecos)',
      locais.ruas.map(([ibge, bairro, nome, cep, lat, lng, nmin, nmax, total]) => [
        cidadePorIbge.get(ibge), bairro === null ? null : idDoBairro[bairro], nome, cep, lat, lng, nmin, nmax, total,
      ]),
    )
    await conexao.commit()
  } catch (erro) {
    await conexao.rollback()
    throw erro
  }

  const [[{ totalCidades }]] = await conexao.query('SELECT COUNT(*) AS totalCidades FROM cidade')
  const [[{ totalBairros }]] = await conexao.query('SELECT COUNT(*) AS totalBairros FROM bairro')
  const [[{ totalRuas }]] = await conexao.query('SELECT COUNT(*) AS totalRuas FROM rua')
  return { cidades: Number(totalCidades), bairros: Number(totalBairros), ruas: Number(totalRuas) }
}

// rodando direto: node database/importar-locais.js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let conexao
  try {
    conexao = await mysql.createConnection({
      host: env.db.host,
      port: env.db.porta,
      user: env.db.usuario,
      password: env.db.senha,
      database: env.db.nome,
      charset: 'utf8mb4',
    })
    const total = await importarLocais(conexao)
    console.log(`Locais da Zona da Mata no banco "${env.db.nome}": ${total.cidades} cidades, ${total.bairros} bairros e localidades, ${total.ruas} ruas.`)
  } catch (erro) {
    console.error('Não foi possível importar os locais:', erro.message || erro.code)
    console.error('Se o banco é antigo, rode antes: npm run atualizar')
    process.exitCode = 1
  } finally {
    await conexao?.end()
  }
}
