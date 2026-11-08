import * as categoriaModel from '../models/categoriaModel.js'

// GET /api/categorias
export async function listar(req, res) {
  res.json(await categoriaModel.listarComSubcategorias())
}
