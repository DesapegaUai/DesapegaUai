import { db } from '../config/db.js'
import { erroHttp } from '../utils/erroHttp.js'

// Quem denuncia precisa participar da conversa; o denunciado é sempre a outra pessoa dela.
export async function criar({ conversaId, denuncianteId, motivo, descricao }) {
  const [conversas] = await db.query(
    `SELECT c.comprador_id, a.usuario_id AS vendedor_id
       FROM conversa c JOIN anuncio a ON a.id = c.anuncio_id
      WHERE c.id = ?`,
    [conversaId],
  )
  if (conversas.length === 0) throw erroHttp(404, 'Conversa não encontrada.')

  const { comprador_id: compradorId, vendedor_id: vendedorId } = conversas[0]
  if (denuncianteId !== compradorId && denuncianteId !== vendedorId) {
    throw erroHttp(403, 'Você não participa desta conversa.')
  }
  const denunciadoId = denuncianteId === compradorId ? vendedorId : compradorId

  try {
    const [resultado] = await db.query(
      `INSERT INTO denuncia (conversa_id, denunciante_id, denunciado_id, motivo, descricao)
       VALUES (?, ?, ?, ?, ?)`,
      [conversaId, denuncianteId, denunciadoId, motivo, descricao],
    )
    return buscarPorId(resultado.insertId)
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') throw erroHttp(409, 'Você já denunciou esta conversa. A denúncia está em análise.')
    throw erro
  }
}

async function buscarPorId(id) {
  const [linhas] = await db.query(
    'SELECT id, conversa_id, denunciado_id, motivo, descricao, situacao, criada_em FROM denuncia WHERE id = ?',
    [id],
  )
  return linhas[0]
}

// a denúncia que esta pessoa fez nesta conversa, ou null (para a tela saber se já denunciou)
export async function buscarDaConversa(conversaId, denuncianteId) {
  const [linhas] = await db.query(
    `SELECT id, conversa_id, denunciado_id, motivo, descricao, situacao, criada_em
       FROM denuncia
      WHERE conversa_id = ? AND denunciante_id = ?`,
    [conversaId, denuncianteId],
  )
  return linhas[0] ?? null
}
