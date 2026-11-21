import { db } from '../config/db.js'
import { caixaDoRaio } from '../utils/geo.js'

const CAMPOS_CIDADE = 'c.id, c.nome, c.uf, c.codigo_ibge, c.latitude, c.longitude, c.cep_geral'

export async function listarCidades() {
  const [linhas] = await db.query(`SELECT ${CAMPOS_CIDADE} FROM cidade c ORDER BY c.nome`)
  return linhas
}

export async function buscarCidade(id) {
  const [linhas] = await db.query(`SELECT ${CAMPOS_CIDADE} FROM cidade c WHERE c.id = ?`, [id])
  return linhas[0] ?? null
}

export async function buscarCidadePorIbge(codigoIbge) {
  const [linhas] = await db.query(`SELECT ${CAMPOS_CIDADE} FROM cidade c WHERE c.codigo_ibge = ?`, [codigoIbge])
  return linhas[0] ?? null
}

export async function cidadeExiste(id) {
  const [linhas] = await db.query('SELECT 1 FROM cidade WHERE id = ?', [id])
  return linhas.length > 0
}

// bairros da cidade em ordem alfabética; com busca, só os que contêm o texto (sem ligar para acento)
export async function listarBairros(cidadeId, { busca = null } = {}) {
  const filtro = busca ? "AND b.nome LIKE ? ESCAPE '!'" : ''
  const valores = busca ? [cidadeId, `%${escaparLike(busca)}%`] : [cidadeId]
  const [linhas] = await db.query(
    `SELECT b.id, b.nome, b.distrito, b.rural, b.latitude, b.longitude
       FROM bairro b
      WHERE b.cidade_id = ? ${filtro}
      ORDER BY b.nome`,
    valores,
  )
  return linhas.map((b) => ({ ...b, rural: Boolean(b.rural) }))
}

export async function buscarBairro(id) {
  const [linhas] = await db.query(
    `SELECT b.id, b.nome, b.distrito, b.rural, b.latitude, b.longitude, b.cidade_id,
            c.nome AS cidade, c.uf, c.codigo_ibge
       FROM bairro b JOIN cidade c ON c.id = b.cidade_id
      WHERE b.id = ?`,
    [id],
  )
  return linhas[0] ? { ...linhas[0], rural: Boolean(linhas[0].rural) } : null
}

export function escaparLike(texto) {
  return texto.replaceAll('!', '!!').replaceAll('%', '!%').replaceAll('_', '!_')
}

// ruas da cidade (autocompletar): começa com o texto primeiro, depois as que contêm
export async function buscarRuas(cidadeId, { busca = null, bairroId = null, limite = 20 } = {}) {
  const filtros = ['r.cidade_id = ?']
  const valores = [cidadeId]
  if (bairroId) { filtros.push('r.bairro_id = ?'); valores.push(bairroId) }
  let ordem = 'r.nome, r.cep'
  if (busca) {
    filtros.push("r.nome LIKE ? ESCAPE '!'")
    valores.push(`%${escaparLike(busca)}%`)
    ordem = `(r.nome LIKE ? ESCAPE '!') DESC, r.enderecos DESC, r.nome`
  }
  const [linhas] = await db.query(
    `SELECT r.id, r.nome, r.cep, r.numero_min, r.numero_max, r.bairro_id, b.nome AS bairro
       FROM rua r LEFT JOIN bairro b ON b.id = r.bairro_id
      WHERE ${filtros.join(' AND ')}
      ORDER BY ${ordem}
      LIMIT ?`,
    busca ? [...valores, `${escaparLike(busca)}%`, limite] : [...valores, limite],
  )
  return linhas
}

// CEP: a cidade de CEP único (o IBGE repete esse CEP em todas as ruas dela) ou o trecho de rua
// com mais endereços
export async function buscarPorCep(cep) {
  const [cidades] = await db.query(
    `SELECT NULL AS rua, c.cep_geral AS cep, c.latitude, c.longitude, NULL AS bairro_id, NULL AS bairro,
            c.id AS cidade_id, c.nome AS cidade, c.uf
       FROM cidade c WHERE c.cep_geral = ?`,
    [cep],
  )
  if (cidades[0]) return { ...cidades[0], cep_de_rua: false }

  const [ruas] = await db.query(
    `SELECT r.nome AS rua, r.cep, r.latitude, r.longitude, r.bairro_id, b.nome AS bairro,
            c.id AS cidade_id, c.nome AS cidade, c.uf
       FROM rua r
       JOIN cidade c ON c.id = r.cidade_id
       LEFT JOIN bairro b ON b.id = r.bairro_id
      WHERE r.cep = ?
      ORDER BY r.enderecos DESC
      LIMIT 1`,
    [cep],
  )
  return ruas[0] ? { ...ruas[0], cep_de_rua: true } : null
}

const DISTANCIA_SQL = 'ST_Distance_Sphere(POINT(?, ?), POINT(x.longitude, x.latitude))'

// trechos de rua mais próximos do ponto (até raioKm), do mais perto ao mais longe
export async function ruasProximas(lat, lng, { raioKm = 0.6, limite = 5, cidadeId = null } = {}) {
  const caixa = caixaDoRaio(lat, lng, raioKm)
  const [linhas] = await db.query(
    `SELECT x.id, x.nome, x.cep, x.cidade_id, x.bairro_id, b.nome AS bairro, x.latitude, x.longitude,
            ${DISTANCIA_SQL} AS distancia_m
       FROM rua x LEFT JOIN bairro b ON b.id = x.bairro_id
      WHERE x.latitude BETWEEN ? AND ? AND x.longitude BETWEEN ? AND ?
        ${cidadeId ? 'AND x.cidade_id = ?' : ''}
      ORDER BY distancia_m
      LIMIT ?`,
    [lng, lat, caixa.minLat, caixa.maxLat, caixa.minLng, caixa.maxLng, ...(cidadeId ? [cidadeId] : []), limite],
  )
  return linhas
}

// bairro mais próximo do ponto dentro da cidade (urbano antes de rural quando a distância empata)
export async function bairroMaisProximo(cidadeId, lat, lng) {
  const [linhas] = await db.query(
    `SELECT x.id, x.nome, x.distrito, x.rural, ${DISTANCIA_SQL} AS distancia_m
       FROM bairro x
      WHERE x.cidade_id = ?
      ORDER BY distancia_m, x.rural
      LIMIT 1`,
    [lng, lat, cidadeId],
  )
  return linhas[0] ? { ...linhas[0], rural: Boolean(linhas[0].rural) } : null
}

// sugestões de regiões: perto de um ponto (bairros e cidades) ou pelo nome
export async function sugerirPerto(lat, lng, { limite = 8, raioKm = 15 } = {}) {
  const caixa = caixaDoRaio(lat, lng, raioKm)
  const [bairros] = await db.query(
    `SELECT 'bairro' AS tipo, x.id, x.nome, x.distrito, x.rural, x.cidade_id, c.nome AS cidade, c.uf,
            ${DISTANCIA_SQL} AS distancia_m
       FROM bairro x JOIN cidade c ON c.id = x.cidade_id
      WHERE x.latitude BETWEEN ? AND ? AND x.longitude BETWEEN ? AND ? AND x.rural = FALSE
      ORDER BY distancia_m
      LIMIT ?`,
    [lng, lat, caixa.minLat, caixa.maxLat, caixa.minLng, caixa.maxLng, limite],
  )
  const [cidades] = await db.query(
    `SELECT 'cidade' AS tipo, x.id, x.nome, NULL AS distrito, FALSE AS rural, x.id AS cidade_id, x.nome AS cidade, x.uf,
            ${DISTANCIA_SQL} AS distancia_m
       FROM cidade x
      ORDER BY distancia_m
      LIMIT 4`,
    [lng, lat],
  )
  return [...bairros, ...cidades].map((s) => ({ ...s, rural: Boolean(s.rural) }))
}

export async function sugerirPorNome(texto, { limite = 10 } = {}) {
  const comeca = `${escaparLike(texto)}%`
  const contem = `%${escaparLike(texto)}%`
  const [cidades] = await db.query(
    `SELECT 'cidade' AS tipo, c.id, c.nome, NULL AS distrito, FALSE AS rural, c.id AS cidade_id, c.nome AS cidade, c.uf
       FROM cidade c WHERE c.nome LIKE ? ESCAPE '!'
      ORDER BY (c.nome LIKE ? ESCAPE '!') DESC, c.nome LIMIT ?`,
    [contem, comeca, limite],
  )
  const [bairros] = await db.query(
    `SELECT 'bairro' AS tipo, b.id, b.nome, b.distrito, b.rural, b.cidade_id, c.nome AS cidade, c.uf
       FROM bairro b JOIN cidade c ON c.id = b.cidade_id
      WHERE b.nome LIKE ? ESCAPE '!'
      ORDER BY (b.nome LIKE ? ESCAPE '!') DESC, b.rural, b.nome LIMIT ?`,
    [contem, comeca, limite],
  )
  return [...cidades, ...bairros].slice(0, limite).map((s) => ({ ...s, rural: Boolean(s.rural) }))
}
