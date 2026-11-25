import { db } from '../config/db.js'
import { temVinculoAcademico } from '../utils/vinculo.js'

/**
 * Dados públicos de cada anúncio para a comparação: descrição, número de fotos, ponto de referência
 * e o vendedor como aparece no perfil público (nome, foto, nota média e selo). O e-mail só serve para
 * o selo e não sai daqui; telefone nem é lido (LGPD).
 */
export async function detalhesPublicos(ids) {
  if (!ids.length) return new Map()
  const [linhas] = await db.query(
    `SELECT a.id, a.descricao, a.forma_entrega, a.transporte, a.localizacao,
            (SELECT COUNT(*) FROM foto_anuncio f WHERE f.anuncio_id = a.id) AS total_fotos,
            u.id AS vendedor_id, u.nome AS vendedor_nome, u.foto_url AS vendedor_foto_url, u.email AS vendedor_email,
            (SELECT ROUND(AVG(av.nota), 1) FROM avaliacao av WHERE av.avaliado_id = u.id) AS nota_media,
            (SELECT COUNT(*) FROM avaliacao av WHERE av.avaliado_id = u.id) AS total_avaliacoes
       FROM anuncio a
       JOIN usuario u ON u.id = a.usuario_id
      WHERE a.id IN (?)`,
    [ids],
  )
  return new Map(linhas.map((linha) => [linha.id, {
    descricao: linha.descricao ?? '',
    forma_entrega: linha.forma_entrega,
    transporte: linha.transporte,
    localizacao: linha.localizacao,
    total_fotos: Number(linha.total_fotos),
    vendedor: {
      id: linha.vendedor_id,
      nome: linha.vendedor_nome,
      foto_url: linha.vendedor_foto_url,
      vinculo_academico: temVinculoAcademico(linha.vendedor_email),
      avaliacao: { media: linha.nota_media === null ? null : Number(linha.nota_media), total: Number(linha.total_avaliacoes) },
    },
  }]))
}
