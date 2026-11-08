import { db } from '../config/db.js'

export async function listarComSubcategorias() {
  const [categorias] = await db.query(
    'SELECT id, nome, slug, rotulo_filtro FROM categoria ORDER BY ordem, id',
  )
  const [subcategorias] = await db.query(
    'SELECT id, categoria_id, nome FROM subcategoria ORDER BY id',
  )

  return categorias.map((categoria) => ({
    ...categoria,
    subcategorias: subcategorias
      .filter((sub) => sub.categoria_id === categoria.id)
      .map(({ id, nome }) => ({ id, nome })),
  }))
}
