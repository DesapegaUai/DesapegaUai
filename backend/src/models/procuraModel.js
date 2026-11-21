import { db } from '../config/db.js'
import { temVinculoAcademico } from '../utils/vinculo.js'

const SELECAO = `SELECT p.id, p.titulo, p.preco_max, p.criada_em, p.usuario_id,
                        p.categoria_id, cat.nome AS categoria, cat.slug AS categoria_slug,
                        p.bairro_id, b.nome AS bairro, c.id AS cidade_id, c.nome AS cidade,
                        u.nome AS usuario_nome, u.foto_url AS usuario_foto_url, u.email AS usuario_email
                   FROM procura p
                   JOIN usuario u ON u.id = p.usuario_id
                   JOIN bairro b ON b.id = p.bairro_id
                   JOIN cidade c ON c.id = b.cidade_id
                   LEFT JOIN categoria cat ON cat.id = p.categoria_id`

// de quem procura sai só o nome, a foto e o selo; e-mail e telefone não aparecem (LGPD)
function montar({ usuario_id, usuario_nome, usuario_foto_url, usuario_email, preco_max, ...procura }, meuId) {
  return {
    ...procura,
    preco_max: preco_max === null ? null : Number(preco_max),
    usuario: { id: usuario_id, nome: usuario_nome, foto_url: usuario_foto_url, vinculo_academico: temVinculoAcademico(usuario_email) },
    eh_minha: Number(meuId) === Number(usuario_id),
  }
}

export async function listar({ cidadeId = null, limite = 60 } = {}, meuId = null) {
  const [linhas] = await db.query(
    `${SELECAO} ${cidadeId ? 'WHERE c.id = ?' : ''} ORDER BY p.criada_em DESC, p.id DESC LIMIT ?`,
    cidadeId ? [cidadeId, limite] : [limite],
  )
  return linhas.map((linha) => montar(linha, meuId))
}

export async function buscar(id, meuId = null) {
  const [linhas] = await db.query(`${SELECAO} WHERE p.id = ?`, [id])
  return linhas[0] ? montar(linhas[0], meuId) : null
}

export async function contarDoUsuario(usuarioId) {
  const [[linha]] = await db.query('SELECT COUNT(*) AS total FROM procura WHERE usuario_id = ?', [usuarioId])
  return Number(linha.total)
}

export async function criar({ usuarioId, titulo, categoriaId, bairroId, precoMax }) {
  const [resultado] = await db.query(
    'INSERT INTO procura (usuario_id, titulo, categoria_id, bairro_id, preco_max) VALUES (?, ?, ?, ?, ?)',
    [usuarioId, titulo, categoriaId, bairroId, precoMax],
  )
  return resultado.insertId
}

export async function excluir(id, usuarioId) {
  const [resultado] = await db.query('DELETE FROM procura WHERE id = ? AND usuario_id = ?', [id, usuarioId])
  return resultado.affectedRows > 0
}

// pedidos de outras pessoas, na cidade do anúncio, que aceitam a categoria e o preço dele
export async function candidatasParaAnuncio({ vendedorId, cidadeId, categoriaId, preco }) {
  const [linhas] = await db.query(
    `SELECT p.id, p.usuario_id, p.titulo
       FROM procura p
       JOIN bairro b ON b.id = p.bairro_id
      WHERE p.usuario_id <> ? AND b.cidade_id = ?
        AND (p.categoria_id IS NULL OR p.categoria_id = ?)
        AND (p.preco_max IS NULL OR p.preco_max >= ?)
      ORDER BY p.criada_em DESC
      LIMIT 200`,
    [vendedorId, cidadeId, categoriaId, preco],
  )
  return linhas
}
