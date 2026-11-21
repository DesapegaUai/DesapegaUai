// npm run atualizar: deixa um banco antigo com a estrutura do schema.sql sem apagar os dados
// (contas, anúncios, conversas) e importa os locais da Zona da Mata. Pode rodar quantas vezes quiser.
// Cria as tabelas e colunas que faltam, ajusta as colunas que mudaram e refaz índices e restrições.
import fs from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { env } from '../src/config/env.js'
import { importarLocais, lerLocais, normalizarNome } from './importar-locais.js'

if (!/^\w+$/.test(env.db.nome)) {
  console.error(`Nome de banco inválido no .env (DB_NAME): "${env.db.nome}"`)
  process.exit(1)
}

// ---------------------------------------------------------------- leitura do schema.sql

function semComentarios(sql) {
  return sql.split('\n').map((linha) => linha.replace(/--.*$/, '')).join('\n')
}

// separa por vírgula só no primeiro nível (fora de parênteses e aspas)
function separarItens(texto) {
  const itens = []
  let nivel = 0
  let aspas = false
  let atual = ''
  for (const letra of texto) {
    if (letra === "'") aspas = !aspas
    if (!aspas && letra === '(') nivel++
    if (!aspas && letra === ')') nivel--
    if (!aspas && nivel === 0 && letra === ',') {
      itens.push(atual)
      atual = ''
    } else {
      atual += letra
    }
  }
  itens.push(atual)
  return itens.map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function lerTabelas(sql) {
  const tabelas = new Map()
  for (const m of semComentarios(sql).matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\) (ENGINE=[^;]+);/g)) {
    const tabela = { criar: `CREATE TABLE IF NOT EXISTS ${m[1]} (${m[2]}\n) ${m[3]}`, colunas: [], indices: [], restricoes: [] }
    for (const item of separarItens(m[2])) {
      if (/^PRIMARY KEY/i.test(item)) continue
      if (/^(UNIQUE )?KEY /i.test(item)) tabela.indices.push({ nome: item.match(/KEY (\w+)/i)[1], sql: item })
      else if (/^CONSTRAINT /i.test(item)) {
        tabela.restricoes.push({ nome: item.split(' ')[1], sql: item, fk: /FOREIGN KEY/i.test(item) })
      } else tabela.colunas.push({ nome: item.split(' ')[0], sql: item })
    }
    tabelas.set(m[1], tabela)
  }
  return tabelas
}

const PALAVRAS_DEPOIS_DO_TIPO = /\s+(NOT NULL|NULL|DEFAULT|AUTO_INCREMENT|ON UPDATE|COMMENT)\b.*$/i

// "varchar(100)", "int unsigned", "tinyint(1)": igual no MySQL 8 e no MariaDB
function normalizarTipo(tipo) {
  const t = tipo.toLowerCase().replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim()
  if (t === 'boolean' || t === 'bool') return 'tinyint(1)'
  return t.replace(/^(tinyint|smallint|mediumint|int|bigint)\(\d+\)/, (todo, base) => (todo === 'tinyint(1)' ? todo : base))
}

const tipoDaDefinicao = (sql) => normalizarTipo(sql.slice(sql.indexOf(' ') + 1).replace(PALAVRAS_DEPOIS_DO_TIPO, ''))

function regraDeExclusao(sql) {
  const m = sql.match(/ON DELETE (CASCADE|SET NULL|RESTRICT|NO ACTION)/i)
  const regra = (m?.[1] ?? 'RESTRICT').toUpperCase()
  return regra === 'NO ACTION' ? 'RESTRICT' : regra
}

// ---------------------------------------------------------------- atualização

async function atualizar(conexao) {
  const banco = env.db.nome
  const tabelas = lerTabelas(await fs.readFile(path.join(import.meta.dirname, 'schema.sql'), 'utf8'))
  const locais = await lerLocais()
  const consultar = async (sql, valores = []) => (await conexao.query(sql, valores))[0]
  const feito = (texto) => console.log(`OK: ${texto}`)

  // 1. tabelas novas
  const existentes = new Set((await consultar('SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', [banco])).map((l) => l.t))
  for (const [nome, tabela] of tabelas) {
    if (existentes.has(nome)) continue
    await conexao.query('SET FOREIGN_KEY_CHECKS = 0')
    await conexao.query(tabela.criar)
    await conexao.query('SET FOREIGN_KEY_CHECKS = 1')
    feito(`tabela ${nome} criada`)
  }

  const colunasDe = async (tabela) => new Map((await consultar(
    'SELECT COLUMN_NAME AS nome, COLUMN_TYPE AS tipo, IS_NULLABLE AS nulo FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    [banco, tabela],
  )).map((c) => [c.nome, c]))

  // 2. colunas que faltam (sem NOT NULL ainda, para não quebrar as linhas que já existem)
  for (const [nome, tabela] of tabelas) {
    const colunas = await colunasDe(nome)
    for (const coluna of tabela.colunas) {
      if (colunas.has(coluna.nome)) continue
      await conexao.query(`ALTER TABLE ${nome} ADD COLUMN ${coluna.sql.replace(/\bNOT NULL\b/i, 'NULL')}`)
      feito(`coluna ${nome}.${coluna.nome}`)
    }
  }

  // 3. dados que as colunas novas precisam antes de virar NOT NULL / UNIQUE
  for (const cidade of await consultar('SELECT id, nome FROM cidade WHERE codigo_ibge IS NULL OR codigo_ibge = 0')) {
    const daBase = locais.cidades.find((c) => normalizarNome(c.nome) === normalizarNome(cidade.nome))
    if (daBase) await conexao.query('UPDATE cidade SET codigo_ibge = ? WHERE id = ?', [daBase.ibge, cidade.id])
    else console.warn(`Atenção: a cidade "${cidade.nome}" não é da Zona da Mata mineira.`)
  }
  // nomes oficiais do IBGE nos bairros do seed antigo
  for (const [cidade, antigo, oficial] of [['Viçosa', 'João Braz', 'João Braz da Costa Val'], ['Ponte Nova', 'Centro', 'Centro Histórico']]) {
    await conexao.query(
      `UPDATE bairro b JOIN cidade c ON c.id = b.cidade_id
          SET b.nome = ?
        WHERE c.nome = ? AND b.nome = ?
          AND NOT EXISTS (SELECT 1 FROM (SELECT cidade_id, nome FROM bairro) x WHERE x.cidade_id = b.cidade_id AND x.nome = ?)`,
      [oficial, cidade, antigo, oficial],
    )
  }

  // 4. colunas que mudaram (tipo ou NULL/NOT NULL); a chave estrangeira da coluna sai antes e volta no passo 6
  for (const [nome, tabela] of tabelas) {
    const colunas = await colunasDe(nome)
    for (const coluna of tabela.colunas) {
      const atual = colunas.get(coluna.nome)
      const nuloEsperado = /\bNOT NULL\b/i.test(coluna.sql) ? 'NO' : 'YES'
      if (normalizarTipo(atual.tipo) === tipoDaDefinicao(coluna.sql) && atual.nulo === nuloEsperado) continue
      const chaves = await consultar(
        `SELECT DISTINCT CONSTRAINT_NAME AS nome FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
        [banco, nome, coluna.nome],
      )
      for (const chave of chaves) await conexao.query(`ALTER TABLE ${nome} DROP FOREIGN KEY ${chave.nome}`)
      await conexao.query(`ALTER TABLE ${nome} MODIFY COLUMN ${coluna.sql}`)
      feito(`coluna ${nome}.${coluna.nome} ajustada`)
    }
  }

  // 5. índices que faltam
  for (const [nome, tabela] of tabelas) {
    const indices = new Set((await consultar(
      'SELECT DISTINCT INDEX_NAME AS i FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [banco, nome],
    )).map((l) => l.i))
    for (const indice of tabela.indices) {
      if (indices.has(indice.nome)) continue
      await conexao.query(`ALTER TABLE ${nome} ADD ${indice.sql}`)
      feito(`índice ${indice.nome}`)
    }
  }

  // 6. chaves estrangeiras (que faltam ou com outra regra de exclusão) e CHECKs (sempre refeitos)
  for (const [nome, tabela] of tabelas) {
    const existentesFk = new Map((await consultar(
      `SELECT CONSTRAINT_NAME AS nome, DELETE_RULE AS regra FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ?`, [banco, nome],
    )).map((l) => [l.nome, l.regra === 'NO ACTION' ? 'RESTRICT' : l.regra]))
    const existentesCheck = new Set((await consultar(
      `SELECT CONSTRAINT_NAME AS nome FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'`, [banco, nome],
    )).map((l) => l.nome))

    for (const restricao of tabela.restricoes) {
      if (restricao.fk) {
        const regra = existentesFk.get(restricao.nome)
        if (regra === regraDeExclusao(restricao.sql)) continue
        if (regra) await conexao.query(`ALTER TABLE ${nome} DROP FOREIGN KEY ${restricao.nome}`)
        await conexao.query(`ALTER TABLE ${nome} ADD ${restricao.sql}`)
        feito(`chave estrangeira ${restricao.nome}`)
      } else {
        if (existentesCheck.has(restricao.nome)) await conexao.query(`ALTER TABLE ${nome} DROP CONSTRAINT ${restricao.nome}`)
        await conexao.query(`ALTER TABLE ${nome} ADD ${restricao.sql}`)
      }
    }
  }

  // 7. locais da Zona da Mata e localização dos anúncios que já existiam (centro do bairro)
  const total = await importarLocais(conexao, locais)
  feito(`${total.cidades} cidades, ${total.bairros} bairros e localidades, ${total.ruas} ruas`)
  const [resultado] = await conexao.query(
    `INSERT INTO localizacao_anuncio (anuncio_id, latitude, longitude, latitude_publica, longitude_publica, origem,
                                      cidade_id, bairro_id, cidade, bairro)
     SELECT a.id, b.latitude, b.longitude, b.latitude, b.longitude, 'bairro', c.id, b.id, c.nome, b.nome
       FROM anuncio a
       JOIN bairro b ON b.id = a.bairro_id
       JOIN cidade c ON c.id = b.cidade_id
       LEFT JOIN localizacao_anuncio la ON la.anuncio_id = a.id
      WHERE la.id IS NULL`,
  )
  if (resultado.affectedRows) feito(`localização (centro do bairro) em ${resultado.affectedRows} anúncios antigos`)
}

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
  await atualizar(conexao)
  console.log(`Banco "${env.db.nome}" atualizado.`)
} catch (erro) {
  console.error('Não foi possível atualizar o banco:', erro.message || erro.code)
  console.error('Se o banco for só de teste, dá para recriar do zero com npm run banco.')
  process.exitCode = 1
} finally {
  await conexao?.end()
}
