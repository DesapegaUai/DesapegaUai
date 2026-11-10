import { db } from '../config/db.js'

export async function listarAnunciosAtivos() {
  const [anuncios] = await db.query(
    `SELECT
       anuncio.id,
       anuncio.titulo,
       anuncio.preco,
       anuncio.condicao,
       anuncio.status,
       anuncio.data_publicacao,
       bairro.nome AS bairro,
       cidade.nome AS cidade,
       cidade.uf
     FROM anuncio
     INNER JOIN bairro ON bairro.id = anuncio.bairro_id
     INNER JOIN cidade ON cidade.id = bairro.cidade_id
     WHERE anuncio.status = ?
     ORDER BY anuncio.data_publicacao DESC, anuncio.id DESC`,
    ['ativo'],
  )

  return anuncios
}