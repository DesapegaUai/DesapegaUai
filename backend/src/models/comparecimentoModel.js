import { db } from '../config/db.js'
import { erroHttp } from '../utils/erroHttp.js'

// quem conversa nesta conversa e como está o anúncio dela
async function buscarConversa(conversaId) {
  const [linhas] = await db.query(
    `SELECT c.id, c.comprador_id, a.usuario_id AS vendedor_id, a.status
       FROM conversa c JOIN anuncio a ON a.id = c.anuncio_id
      WHERE c.id = ?`,
    [conversaId],
  )
  return linhas[0] ?? null
}

async function exigirParticipante(conversaId, usuarioId) {
  const conversa = await buscarConversa(conversaId)
  if (!conversa) throw erroHttp(404, 'Conversa não encontrada.')
  if (![conversa.comprador_id, conversa.vendedor_id].includes(usuarioId)) throw erroHttp(403, 'Você não participa desta conversa.')
  return conversa
}

// a minha resposta nesta conversa (ou null)
export async function buscarDaConversa(conversaId, usuarioId) {
  await exigirParticipante(conversaId, usuarioId)
  const [linhas] = await db.query(
    'SELECT id, compareceu, criado_em FROM comparecimento WHERE conversa_id = ? AND avaliador_id = ?',
    [conversaId, usuarioId],
  )
  return linhas[0] ? { ...linhas[0], compareceu: Boolean(linhas[0].compareceu) } : null
}

// só depois da venda, uma resposta por pessoa em cada conversa
export async function responder({ conversaId, usuarioId, compareceu }) {
  const conversa = await exigirParticipante(conversaId, usuarioId)
  if (conversa.status !== 'vendido') throw erroHttp(409, 'A pergunta só aparece depois que o anúncio é marcado como vendido.')
  const outro = usuarioId === conversa.vendedor_id ? conversa.comprador_id : conversa.vendedor_id
  try {
    await db.query(
      'INSERT INTO comparecimento (conversa_id, avaliador_id, avaliado_id, compareceu) VALUES (?, ?, ?, ?)',
      [conversaId, usuarioId, outro, compareceu],
    )
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') throw erroHttp(409, 'Você já respondeu sobre esta negociação.')
    throw erro
  }
  return { ...(await buscarDaConversa(conversaId, usuarioId)), avaliado_id: outro }
}

// resumo que aparece no perfil: quantas respostas a pessoa recebeu e em quantas ela compareceu
export async function resumoDoUsuario(usuarioId) {
  const [[linha]] = await db.query(
    'SELECT COUNT(*) AS respostas, COALESCE(SUM(compareceu), 0) AS compareceu FROM comparecimento WHERE avaliado_id = ?',
    [usuarioId],
  )
  const respostas = Number(linha.respostas)
  const compareceu = Number(linha.compareceu)
  return { respostas, compareceu, taxa: respostas ? Math.round((compareceu / respostas) * 100) : null }
}
