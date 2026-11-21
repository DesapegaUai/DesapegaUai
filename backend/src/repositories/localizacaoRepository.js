// Consultas do módulo de localização. Sempre com ? (nada de juntar texto na SQL).
import { db } from '../config/db.js'
import { montarCard, sqlDoCard } from '../models/anuncioModel.js'
import { caixaDoRaio } from '../utils/geo.js'
import { escaparLike } from './localRepository.js'

export const RETENCAO_DIAS = 30 // localização de usuário parada há mais tempo que isso é apagada

// ---------------------------------------------------------------- localização do usuário

const SQL_LOCALIZACAO_USUARIO = `
  SELECT lu.latitude, lu.longitude, lu.precisao_m, lu.origem, lu.capturada_em, lu.atualizada_em,
         lu.cidade_id, c.nome AS cidade, c.uf, lu.bairro_id, b.nome AS bairro
    FROM localizacao_usuario lu
    JOIN cidade c ON c.id = lu.cidade_id
    LEFT JOIN bairro b ON b.id = lu.bairro_id`

export async function buscarLocalizacaoDoUsuario(usuarioId) {
  const [linhas] = await db.query(
    `${SQL_LOCALIZACAO_USUARIO}
      WHERE lu.usuario_id = ? AND lu.atualizada_em >= UTC_TIMESTAMP() - INTERVAL ? DAY`,
    [usuarioId, RETENCAO_DIAS],
  )
  return linhas[0] ?? null
}

// uma linha por pessoa: grava por cima (não guarda histórico de deslocamento)
export async function salvarLocalizacaoDoUsuario(usuarioId, l) {
  await db.query(
    `INSERT INTO localizacao_usuario
       (usuario_id, latitude, longitude, precisao_m, origem, cidade_id, bairro_id, capturada_em, atualizada_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       latitude = VALUES(latitude), longitude = VALUES(longitude), precisao_m = VALUES(precisao_m),
       origem = VALUES(origem), cidade_id = VALUES(cidade_id), bairro_id = VALUES(bairro_id),
       capturada_em = VALUES(capturada_em), atualizada_em = UTC_TIMESTAMP()`,
    [usuarioId, l.latitude, l.longitude, l.precisao, l.origem, l.cidadeId, l.bairroId, l.capturadaEm],
  )
}

export async function apagarLocalizacaoDoUsuario(usuarioId) {
  const [resultado] = await db.query('DELETE FROM localizacao_usuario WHERE usuario_id = ?', [usuarioId])
  return resultado.affectedRows > 0
}

export async function apagarLocalizacoesAntigas() {
  const [resultado] = await db.query(
    'DELETE FROM localizacao_usuario WHERE atualizada_em < UTC_TIMESTAMP() - INTERVAL ? DAY',
    [RETENCAO_DIAS],
  )
  return resultado.affectedRows
}

// ---------------------------------------------------------------- preferências

export const PREFERENCIAS_PADRAO = { raio_km: 5, modo: 'manual', compartilhar: false, cidade_id: null, bairro_id: null }

export async function buscarPreferencias(usuarioId) {
  const [linhas] = await db.query(
    `SELECT p.raio_km, p.modo, p.compartilhar, p.cidade_id, c.nome AS cidade, p.bairro_id, b.nome AS bairro, p.atualizada_em
       FROM preferencia_localizacao p
       LEFT JOIN cidade c ON c.id = p.cidade_id
       LEFT JOIN bairro b ON b.id = p.bairro_id
      WHERE p.usuario_id = ?`,
    [usuarioId],
  )
  if (!linhas[0]) return { ...PREFERENCIAS_PADRAO, cidade: null, bairro: null, atualizada_em: null }
  return { ...linhas[0], compartilhar: Boolean(linhas[0].compartilhar) }
}

export async function salvarPreferencias(usuarioId, p) {
  await db.query(
    `INSERT INTO preferencia_localizacao (usuario_id, raio_km, modo, compartilhar, cidade_id, bairro_id, atualizada_em)
     VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       raio_km = VALUES(raio_km), modo = VALUES(modo), compartilhar = VALUES(compartilhar),
       cidade_id = VALUES(cidade_id), bairro_id = VALUES(bairro_id), atualizada_em = UTC_TIMESTAMP()`,
    [usuarioId, p.raio_km, p.modo, p.compartilhar, p.cidade_id, p.bairro_id],
  )
}

// ---------------------------------------------------------------- localização dos anúncios

export async function buscarLocalizacaoDoAnuncio(anuncioId) {
  const [linhas] = await db.query(
    `SELECT a.id AS anuncio_id, a.usuario_id, a.status, a.bairro_id AS bairro_do_anuncio,
            la.latitude, la.longitude, la.latitude_publica, la.longitude_publica, la.precisao_m, la.origem,
            la.cidade_id, la.cidade, la.bairro_id, la.bairro, la.rua, la.cep, la.criada_em, la.atualizada_em, c.uf
       FROM anuncio a
       LEFT JOIN localizacao_anuncio la ON la.anuncio_id = a.id
       LEFT JOIN cidade c ON c.id = la.cidade_id
      WHERE a.id = ?`,
    [anuncioId],
  )
  return linhas[0] ?? null
}

export async function salvarLocalizacaoDoAnuncio(anuncioId, l, conexao = db) {
  await conexao.query(
    `INSERT INTO localizacao_anuncio
       (anuncio_id, latitude, longitude, latitude_publica, longitude_publica, precisao_m, origem,
        cidade_id, bairro_id, cidade, bairro, rua, cep, atualizada_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       latitude = VALUES(latitude), longitude = VALUES(longitude),
       latitude_publica = VALUES(latitude_publica), longitude_publica = VALUES(longitude_publica),
       precisao_m = VALUES(precisao_m), origem = VALUES(origem), cidade_id = VALUES(cidade_id),
       bairro_id = VALUES(bairro_id), cidade = VALUES(cidade), bairro = VALUES(bairro),
       rua = VALUES(rua), cep = VALUES(cep), atualizada_em = UTC_TIMESTAMP()`,
    [
      anuncioId, l.latitude, l.longitude, l.latitudePublica, l.longitudePublica, l.precisao, l.origem,
      l.cidadeId, l.bairroId, l.cidade, l.bairro, l.rua, l.cep,
    ],
  )
}

export async function mudarBairroDoAnuncio(anuncioId, bairroId, conexao = db) {
  await conexao.query('UPDATE anuncio SET bairro_id = ?, atualizado_em = NOW() WHERE id = ?', [bairroId, anuncioId])
}

// ---------------------------------------------------------------- busca por proximidade

const ORDENS = {
  proximos: 'distancia_m ASC, a.data_publicacao DESC, a.id DESC',
  recentes: 'a.data_publicacao DESC, a.id DESC',
  menor_preco: 'a.preco ASC, distancia_m ASC, a.id DESC',
  maior_preco: 'a.preco DESC, distancia_m ASC, a.id DESC',
}
export const ORDENACOES = Object.keys(ORDENS)

// só anúncio ativo entra (rascunho, vendido e excluído nunca aparecem)
function montarFiltros(f) {
  const sql = ["a.status IN ('ativo', 'reservado')"] // reservado continua aparecendo, com a etiqueta
  const valores = []
  if (f.busca) {
    const termo = `%${escaparLike(f.busca)}%`
    sql.push("(a.titulo LIKE ? ESCAPE '!' OR a.descricao LIKE ? ESCAPE '!')")
    valores.push(termo, termo)
  }
  if (f.categoriaId) { sql.push('a.categoria_id = ?'); valores.push(f.categoriaId) }
  if (f.subcategorias?.length) { sql.push('a.subcategoria_id IN (?)'); valores.push(f.subcategorias) }
  if (f.bairros?.length) { sql.push('a.bairro_id IN (?)'); valores.push(f.bairros) }
  if (f.cidadeId) { sql.push('la.cidade_id = ?'); valores.push(f.cidadeId) }
  if (f.condicoes?.length) { sql.push('a.condicao IN (?)'); valores.push(f.condicoes) }
  if (f.precoMin !== null && f.precoMin !== undefined) { sql.push('a.preco >= ?'); valores.push(f.precoMin) }
  if (f.precoMax !== null && f.precoMax !== undefined) { sql.push('a.preco <= ?'); valores.push(f.precoMax) }
  return { sql, valores }
}

const DISTANCIA_M = 'ST_Distance_Sphere(POINT(?, ?), POINT(la.longitude_publica, la.latitude_publica))'

// com raio: primeiro a caixa do raio (usa o índice), depois a distância exata, tudo no MySQL
function condicoesDoRaio({ origem, raioKm, filtros }) {
  const { sql: condicoes, valores } = montarFiltros(filtros)
  if (raioKm) {
    const caixa = caixaDoRaio(origem.latitude, origem.longitude, raioKm)
    condicoes.push('la.latitude_publica BETWEEN ? AND ?', 'la.longitude_publica BETWEEN ? AND ?', `${DISTANCIA_M} <= ?`)
    // + 1 mm: erro de ponto flutuante; um anúncio a exatamente 5,00 km entra no raio de 5 km
    valores.push(caixa.minLat, caixa.maxLat, caixa.minLng, caixa.maxLng, origem.longitude, origem.latitude, raioKm * 1000 + 0.001)
  }
  return { onde: `WHERE ${condicoes.join(' AND ')}`, valores }
}

export async function contarAnunciosPorDistancia({ origem, raioKm = null, filtros = {} }) {
  const { onde, valores } = condicoesDoRaio({ origem, raioKm, filtros })
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM anuncio a JOIN localizacao_anuncio la ON la.anuncio_id = a.id ${onde}`,
    valores,
  )
  return Number(total)
}

// anúncios ativos com a distância (em metros) do ponto de origem até o ponto público de cada um
export async function listarAnunciosPorDistancia({ origem, raioKm = null, filtros = {}, ordenar = 'proximos', pagina = 1, porPagina = 12, usuarioId = null }) {
  const { onde, valores } = condicoesDoRaio({ origem, raioKm, filtros })
  const total = await contarAnunciosPorDistancia({ origem, raioKm, filtros })

  const [linhas] = await db.query(
    `${sqlDoCard(`, ${DISTANCIA_M} AS distancia_m,
                 la.latitude_publica, la.longitude_publica, la.origem AS localizacao_origem,
                 EXISTS (SELECT 1 FROM favorito fv WHERE fv.anuncio_id = a.id AND fv.usuario_id = ?) AS favoritado_por_mim`)}
       JOIN localizacao_anuncio la ON la.anuncio_id = a.id
       ${onde}
      ORDER BY ${ORDENS[ordenar]}
      LIMIT ? OFFSET ?`,
    [origem.longitude, origem.latitude, usuarioId ?? 0, ...valores, porPagina, (pagina - 1) * porPagina],
  )

  return {
    total,
    itens: linhas.map(({ distancia_m, latitude_publica, longitude_publica, favoritado_por_mim, ...linha }) => ({
      ...montarCard(linha, Number(favoritado_por_mim) === 1),
      distancia_m: Number(distancia_m),
      localizacao_aproximada: { latitude: Number(latitude_publica), longitude: Number(longitude_publica) },
    })),
  }
}

// marcadores do mapa: só o necessário para desenhar, dentro da área visível
export async function listarMarcadores({ caixa, filtros = {}, limite = 300 }) {
  const { sql: condicoes, valores } = montarFiltros(filtros)
  condicoes.push('la.latitude_publica BETWEEN ? AND ?', 'la.longitude_publica BETWEEN ? AND ?')
  valores.push(caixa.minLat, caixa.maxLat, caixa.minLng, caixa.maxLng)
  const onde = `WHERE ${condicoes.join(' AND ')}`

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM anuncio a JOIN localizacao_anuncio la ON la.anuncio_id = a.id ${onde}`,
    valores,
  )
  const [linhas] = await db.query(
    `SELECT a.id, a.titulo, a.preco, a.categoria_id, la.latitude_publica AS latitude, la.longitude_publica AS longitude,
            la.bairro, la.cidade, capa.id AS capa_id, capa.ordem AS capa_ordem, capa.arquivo AS capa_arquivo
       FROM anuncio a
       JOIN localizacao_anuncio la ON la.anuncio_id = a.id
       LEFT JOIN foto_anuncio capa ON capa.id = (
         SELECT f.id FROM foto_anuncio f WHERE f.anuncio_id = a.id ORDER BY f.ordem, f.id LIMIT 1
       )
       ${onde}
      ORDER BY a.data_publicacao DESC, a.id DESC
      LIMIT ?`,
    [...valores, limite],
  )
  return { total: Number(total), linhas }
}
