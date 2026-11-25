// Histórico de preço dos anúncios publicados (tabela historico_preco).
import { db } from '../config/db.js'

/** Cada mudança de preço, da mais antiga para a mais nova: [{ preco, em }] */
export async function listar(anuncioId, conexao = db) {
  const [linhas] = await conexao.query(
    'SELECT preco, registrado_em FROM historico_preco WHERE anuncio_id = ? ORDER BY registrado_em, id',
    [anuncioId],
  )
  return linhas.map((linha) => ({ preco: Number(linha.preco), em: linha.registrado_em }))
}

/** em: a data do registro (padrão: agora) */
export async function registrar(anuncioId, preco, conexao = db, { em = null } = {}) {
  await conexao.query(
    'INSERT INTO historico_preco (anuncio_id, preco, registrado_em) VALUES (?, ?, COALESCE(?, UTC_TIMESTAMP()))',
    [anuncioId, preco, em],
  )
}

/** Quem salvou o anúncio nos Favoritos (menos o próprio vendedor) */
export async function quemFavoritou(anuncioId, vendedorId) {
  const [linhas] = await db.query('SELECT usuario_id FROM favorito WHERE anuncio_id = ? AND usuario_id <> ?', [anuncioId, vendedorId])
  return linhas.map((linha) => Number(linha.usuario_id))
}
