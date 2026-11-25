// Conversas e mensagens fixadas (como no WhatsApp): tabelas conversa_fixada e mensagem_fixada.
import { db } from '../config/db.js'
import { formatarMensagem } from './mensagemModel.js'

async function naTransacao(fn) {
  const conexao = await db.getConnection()
  try {
    await conexao.beginTransaction()
    const resultado = await fn(conexao)
    await conexao.commit()
    return resultado
  } catch (erro) {
    await conexao.rollback()
    throw erro
  } finally {
    conexao.release()
  }
}

// ---------------------------------------------------------------- conversas

/** Map conversa_id -> fixada_em das conversas que esta pessoa fixou */
export async function conversasFixadas(usuarioId) {
  const [linhas] = await db.query('SELECT conversa_id, fixada_em FROM conversa_fixada WHERE usuario_id = ?', [usuarioId])
  return new Map(linhas.map((linha) => [Number(linha.conversa_id), linha.fixada_em]))
}

/** { fixada } ou { limite: true }. A trava na linha da pessoa impede passar do máximo com duas abas ao mesmo tempo. */
export function fixarConversa(usuarioId, conversaId, maximo) {
  return naTransacao(async (conexao) => {
    await conexao.query('SELECT id FROM usuario WHERE id = ? FOR UPDATE', [usuarioId])
    const [[{ jaEsta }]] = await conexao.query('SELECT COUNT(*) AS jaEsta FROM conversa_fixada WHERE usuario_id = ? AND conversa_id = ?', [usuarioId, conversaId])
    if (Number(jaEsta)) return { fixada: true }
    const [[{ total }]] = await conexao.query('SELECT COUNT(*) AS total FROM conversa_fixada WHERE usuario_id = ?', [usuarioId])
    if (Number(total) >= maximo) return { limite: true }
    await conexao.query('INSERT INTO conversa_fixada (usuario_id, conversa_id, fixada_em) VALUES (?, ?, UTC_TIMESTAMP(3))', [usuarioId, conversaId])
    return { fixada: true }
  })
}

export async function desafixarConversa(usuarioId, conversaId) {
  const [resultado] = await db.query('DELETE FROM conversa_fixada WHERE usuario_id = ? AND conversa_id = ?', [usuarioId, conversaId])
  return resultado.affectedRows > 0
}

// ---------------------------------------------------------------- mensagens

// a mensagem que esta pessoa vê na conversa: não apagou "para mim" e não é de antes de ela excluir a conversa
const VISIVEL_PARA = `
  NOT EXISTS (SELECT 1 FROM mensagem_oculta o WHERE o.mensagem_id = m.id AND o.usuario_id = ?)
  AND m.enviada_em > COALESCE(CASE WHEN a.usuario_id = ? THEN c.oculta_vendedor_em ELSE c.oculta_comprador_em END, '1000-01-01')`

/** a mensagem da conversa que esta pessoa vê (ou null) */
export async function mensagemVisivel(conversaId, mensagemId, usuarioId) {
  const [linhas] = await db.query(
    `SELECT m.id, m.apagada_em
       FROM mensagem m
       JOIN conversa c ON c.id = m.conversa_id
       JOIN anuncio a ON a.id = c.anuncio_id
      WHERE m.id = ? AND m.conversa_id = ? AND ${VISIVEL_PARA}`,
    [mensagemId, conversaId, usuarioId, usuarioId],
  )
  return linhas[0] ?? null
}

/** As fixadas que ainda valem, da mais antiga para a mais nova, como esta pessoa vê (a que já venceu sai daqui). */
export async function mensagensFixadas(conversaId, usuarioId) {
  await db.query('DELETE FROM mensagem_fixada WHERE conversa_id = ? AND expira_em <= UTC_TIMESTAMP()', [conversaId])
  const [linhas] = await db.query(
    `SELECT f.fixada_por, f.fixada_em, f.expira_em,
            m.id, m.conversa_id, m.remetente_id, m.texto, m.foto, m.video, m.audio, m.audio_segundos, m.audio_ondas,
            m.enviada_em, m.lida, m.entregue_em, m.editada_em, m.apagada_em
       FROM mensagem_fixada f
       JOIN mensagem m ON m.id = f.mensagem_id
       JOIN conversa c ON c.id = f.conversa_id
       JOIN anuncio a ON a.id = c.anuncio_id
      WHERE f.conversa_id = ? AND f.expira_em > UTC_TIMESTAMP() AND m.apagada_em IS NULL AND ${VISIVEL_PARA}
      ORDER BY f.fixada_em, f.mensagem_id`,
    [conversaId, usuarioId, usuarioId],
  )
  return linhas.map((linha) => ({
    mensagem_id: linha.id,
    fixada_por: linha.fixada_por,
    fixada_em: linha.fixada_em,
    expira_em: linha.expira_em,
    mensagem: formatarMensagem(linha),
  }))
}

/**
 * Fixa (ou, se já estava fixada, renova o prazo). Com o máximo já fixado, só entra com substituir: a mais
 * antiga sai. Devolve { fixada, substituida } ou { limite: true }. A trava na conversa segura duas pessoas
 * fixando ao mesmo tempo.
 */
export function fixarMensagem({ conversaId, mensagemId, usuarioId, expiraEm, substituir, maximo }) {
  return naTransacao(async (conexao) => {
    await conexao.query('SELECT id FROM conversa WHERE id = ? FOR UPDATE', [conversaId])
    await conexao.query('DELETE FROM mensagem_fixada WHERE conversa_id = ? AND expira_em <= UTC_TIMESTAMP()', [conversaId])
    const [ja] = await conexao.query('SELECT mensagem_id FROM mensagem_fixada WHERE mensagem_id = ?', [mensagemId])
    if (ja.length) {
      await conexao.query('UPDATE mensagem_fixada SET fixada_por = ?, fixada_em = UTC_TIMESTAMP(3), expira_em = ? WHERE mensagem_id = ?', [usuarioId, expiraEm, mensagemId])
      return { fixada: true, substituida: null }
    }
    const [ativas] = await conexao.query('SELECT mensagem_id FROM mensagem_fixada WHERE conversa_id = ? ORDER BY fixada_em, mensagem_id', [conversaId])
    let substituida = null
    if (ativas.length >= maximo) {
      if (!substituir) return { limite: true }
      substituida = Number(ativas[0].mensagem_id)
      await conexao.query('DELETE FROM mensagem_fixada WHERE mensagem_id = ?', [substituida])
    }
    await conexao.query(
      'INSERT INTO mensagem_fixada (mensagem_id, conversa_id, fixada_por, fixada_em, expira_em) VALUES (?, ?, ?, UTC_TIMESTAMP(3), ?)',
      [mensagemId, conversaId, usuarioId, expiraEm],
    )
    return { fixada: true, substituida }
  })
}

export async function desafixarMensagem(conversaId, mensagemId) {
  const [resultado] = await db.query('DELETE FROM mensagem_fixada WHERE conversa_id = ? AND mensagem_id = ?', [conversaId, mensagemId])
  return resultado.affectedRows > 0
}

/** a mensagem foi apagada para todos: a fixação sai junto */
export async function removerFixacao(mensagemId) {
  const [resultado] = await db.query('DELETE FROM mensagem_fixada WHERE mensagem_id = ?', [mensagemId])
  return resultado.affectedRows > 0
}
