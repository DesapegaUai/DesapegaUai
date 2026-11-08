import { db } from '../config/db.js'

export async function criar(dados) {
  const [resultado] = await db.execute(
    `INSERT INTO anuncio
      (usuario_id, categoria_id, subcategoria_id, bairro_id,
       titulo, descricao, preco, condicao, forma_entrega, localizacao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dados.usuario_id,
      dados.categoria_id,
      dados.subcategoria_id,
      dados.bairro_id,
      dados.titulo,
      dados.descricao,
      dados.preco,
      dados.condicao,
      dados.forma_entrega,
      dados.localizacao,
    ]
  )

  return resultado.insertId
}

export async function buscarPorId(id) {
  const [linhas] = await db.execute(
    'SELECT * FROM anuncio WHERE id = ?',
    [id]
  )

  return linhas[0] ?? null
}

export async function listarPorUsuario(usuarioId) {
  const [linhas] = await db.execute(
    `SELECT * FROM anuncio
     WHERE usuario_id = ?
     ORDER BY data_publicacao DESC`,
    [usuarioId]
  )

  return linhas
}

export async function atualizar(id, usuarioId, dados) {
  const colunasPermitidas = {
    categoria_id: 'categoria_id',
    subcategoria_id: 'subcategoria_id',
    bairro_id: 'bairro_id',
    titulo: 'titulo',
    descricao: 'descricao',
    preco: 'preco',
    condicao: 'condicao',
    forma_entrega: 'forma_entrega',
    localizacao: 'localizacao',
  }

  const campos = Object.keys(dados).filter(
    (campo) => colunasPermitidas[campo]
  )

  if (campos.length === 0) {
    return false
  }

  const atribuicoes = campos.map(
    (campo) => `${colunasPermitidas[campo]} = ?`
  )

  atribuicoes.push('atualizado_em = NOW()')

  const valores = campos.map((campo) => dados[campo])
  valores.push(id, usuarioId)

  const [resultado] = await db.execute(
    `UPDATE anuncio
     SET ${atribuicoes.join(', ')}
     WHERE id = ? AND usuario_id = ?`,
    valores
  )

  return resultado.affectedRows > 0
}

export async function mudarStatus(id, usuarioId, status) {
  const [resultado] = await db.execute(
    `UPDATE anuncio
     SET status = ?, atualizado_em = NOW()
     WHERE id = ? AND usuario_id = ?`,
    [status, id, usuarioId]
  )

  return resultado.affectedRows > 0
}

export async function excluir(id, usuarioId) {
  const [resultado] = await db.execute(
    'DELETE FROM anuncio WHERE id = ? AND usuario_id = ?',
    [id, usuarioId]
  )

  return resultado.affectedRows > 0
}