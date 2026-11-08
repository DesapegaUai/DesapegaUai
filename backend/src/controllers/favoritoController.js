// Marina. Já pronto para usar: req.usuario.id, erroHttp e lerId (utils/validacao).
import { erroHttp } from '../utils/erroHttp.js'

function naoImplementado() {
  throw erroHttp(501, 'Ainda não implementado.')
}

// GET /api/favoritos (M7)
export async function listar(req, res) {
  naoImplementado()
}

// POST /api/favoritos/:anuncioId (M7)
export async function favoritar(req, res) {
  naoImplementado()
}

// DELETE /api/favoritos/:anuncioId (M7)
export async function desfavoritar(req, res) {
  naoImplementado()
}
