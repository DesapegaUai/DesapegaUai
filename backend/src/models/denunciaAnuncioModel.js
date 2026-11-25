// Denúncias de anúncio (tabela denuncia_anuncio). Cada pessoa denuncia um anúncio uma vez.
import { db } from '../config/db.js'
import { erroHttp } from '../utils/erroHttp.js'

export async function criar({ anuncioId, denuncianteId, motivo, descricao }) {
  try {
    const [resultado] = await db.query(
      'INSERT INTO denuncia_anuncio (anuncio_id, denunciante_id, motivo, descricao) VALUES (?, ?, ?, ?)',
      [anuncioId, denuncianteId, motivo, descricao],
    )
    return buscar(resultado.insertId)
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') throw erroHttp(409, 'Você já denunciou este anúncio. A equipe do DesapegaUai vai analisar.')
    throw erro
  }
}

export async function buscar(id) {
  const [linhas] = await db.query('SELECT id, anuncio_id, motivo, descricao, situacao, criada_em FROM denuncia_anuncio WHERE id = ?', [id])
  return linhas[0] ?? null
}

/** a denúncia que esta pessoa fez neste anúncio (ou null) */
export async function minha(anuncioId, usuarioId) {
  const [linhas] = await db.query(
    'SELECT id, anuncio_id, motivo, descricao, situacao, criada_em FROM denuncia_anuncio WHERE anuncio_id = ? AND denunciante_id = ?',
    [anuncioId, usuarioId],
  )
  return linhas[0] ?? null
}

/** quantas pessoas diferentes denunciaram e a equipe ainda não analisou */
export async function contarAbertas(anuncioId) {
  const [[{ total }]] = await db.query(
    "SELECT COUNT(DISTINCT denunciante_id) AS total FROM denuncia_anuncio WHERE anuncio_id = ? AND situacao = 'aberta'",
    [anuncioId],
  )
  return Number(total)
}

/** Tira da busca (em_analise), guardando como estava; devolve true só para quem fez a troca agora */
export async function colocarEmAnalise(anuncioId) {
  const [resultado] = await db.query(
    "UPDATE anuncio SET status_antes_da_analise = status, status = 'em_analise' WHERE id = ? AND status IN ('ativo', 'reservado')",
    [anuncioId],
  )
  return resultado.affectedRows === 1
}

/** Volta para como estava antes da análise; devolve true se o anúncio estava em análise */
export async function liberar(anuncioId) {
  const [resultado] = await db.query(
    "UPDATE anuncio SET status = COALESCE(status_antes_da_analise, 'ativo'), status_antes_da_analise = NULL WHERE id = ? AND status = 'em_analise'",
    [anuncioId],
  )
  return resultado.affectedRows === 1
}

/** fecha as denúncias abertas do anúncio: procedente (removido) ou improcedente (liberado) */
export async function fechar(anuncioId, situacao) {
  await db.query("UPDATE denuncia_anuncio SET situacao = ? WHERE anuncio_id = ? AND situacao = 'aberta'", [situacao, anuncioId])
}

/** Para a equipe: os anúncios com denúncia aberta, os em análise primeiro */
export async function pendentes() {
  const [linhas] = await db.query(
    `SELECT a.id, a.titulo, a.status, a.usuario_id AS vendedor_id, u.nome AS vendedor_nome,
            COUNT(DISTINCT d.denunciante_id) AS pessoas,
            GROUP_CONCAT(d.motivo ORDER BY d.id SEPARATOR ',') AS motivos,
            MAX(d.criada_em) AS ultima
       FROM denuncia_anuncio d
       JOIN anuncio a ON a.id = d.anuncio_id
       JOIN usuario u ON u.id = a.usuario_id
      WHERE d.situacao = 'aberta'
      GROUP BY a.id, a.titulo, a.status, a.usuario_id, u.nome
      ORDER BY a.status = 'em_analise' DESC, pessoas DESC, ultima DESC`,
  )
  return linhas.map((linha) => ({ ...linha, pessoas: Number(linha.pessoas), motivos: linha.motivos ? linha.motivos.split(',') : [] }))
}

/** Para a equipe: o que cada pessoa escreveu (sem dizer quem denunciou) */
export async function descricoes(anuncioId) {
  const [linhas] = await db.query(
    "SELECT motivo, descricao, criada_em FROM denuncia_anuncio WHERE anuncio_id = ? AND situacao = 'aberta' ORDER BY id",
    [anuncioId],
  )
  return linhas
}
