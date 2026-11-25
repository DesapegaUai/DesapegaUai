// Lista de compras: só a dona ou o dono da lista lê e muda os itens (toda consulta filtra por usuario_id).
import { db } from '../config/db.js'

const COLUNAS = 'id, texto, cidade_id, comprado, criado_em'
const formatar = (item) => ({ ...item, comprado: Boolean(item.comprado) })

// o que falta comprar primeiro, do mais novo para o mais antigo
export async function listar(usuarioId) {
  const [linhas] = await db.query(
    `SELECT ${COLUNAS} FROM lista_compras WHERE usuario_id = ? ORDER BY comprado, criado_em DESC, id DESC`,
    [usuarioId],
  )
  return linhas.map(formatar)
}

export async function contar(usuarioId) {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM lista_compras WHERE usuario_id = ?', [usuarioId])
  return Number(total)
}

export async function buscar(id, usuarioId) {
  const [linhas] = await db.query(`SELECT ${COLUNAS} FROM lista_compras WHERE id = ? AND usuario_id = ?`, [id, usuarioId])
  return linhas[0] ? formatar(linhas[0]) : null
}

export async function criar({ usuarioId, texto, cidadeId }) {
  const [resultado] = await db.query(
    'INSERT INTO lista_compras (usuario_id, texto, cidade_id) VALUES (?, ?, ?)',
    [usuarioId, texto, cidadeId],
  )
  return buscar(resultado.insertId, usuarioId)
}

export async function marcarComprado(id, usuarioId, comprado) {
  const [resultado] = await db.query(
    'UPDATE lista_compras SET comprado = ? WHERE id = ? AND usuario_id = ?',
    [comprado, id, usuarioId],
  )
  return resultado.affectedRows > 0
}

export async function excluir(id, usuarioId) {
  const [resultado] = await db.query('DELETE FROM lista_compras WHERE id = ? AND usuario_id = ?', [id, usuarioId])
  return resultado.affectedRows > 0
}

export async function cidadeExiste(id) {
  const [linhas] = await db.query('SELECT id FROM cidade WHERE id = ?', [id])
  return linhas.length > 0
}

// quem já recebeu o aviso da lista de compras sobre esse anúncio (para não avisar duas vezes)
export async function jaAvisados(anuncioId) {
  const [linhas] = await db.query("SELECT DISTINCT usuario_id FROM notificacao WHERE tipo = 'lista_compras' AND anuncio_id = ?", [anuncioId])
  return new Set(linhas.map((l) => Number(l.usuario_id)))
}

// itens de outras pessoas, ainda não comprados, de cidades perto do anúncio publicado (para o aviso)
export async function candidatosParaAnuncio({ vendedorId, latitude, longitude, raioKm }) {
  const [linhas] = await db.query(
    `SELECT l.id, l.usuario_id, l.texto
       FROM lista_compras l
       JOIN cidade c ON c.id = l.cidade_id
      WHERE l.comprado = FALSE AND l.usuario_id <> ?
        AND ST_Distance_Sphere(POINT(c.longitude, c.latitude), POINT(?, ?)) <= ?
      ORDER BY l.criado_em DESC, l.id DESC
      LIMIT 500`,
    [vendedorId, longitude, latitude, raioKm * 1000],
  )
  return linhas
}
