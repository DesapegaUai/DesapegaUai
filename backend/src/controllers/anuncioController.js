// Marina. Já pronto para usar: req.usuario.id, erroHttp, lerId/lerTexto/lerOpcao (utils/validacao)
// e utils/fotos (pastaDoAnuncio, caminhoDaFoto, LARGURAS_FOTO, formatarFoto).
import { erroHttp } from '../utils/erroHttp.js'

function naoImplementado() {
  throw erroHttp(501, 'Ainda não implementado.')
}

// GET /api/anuncios/:id (M2)
export async function verAnuncio(req, res) {
  naoImplementado()
}

// POST /api/anuncios (M1)
export async function publicar(req, res) {
  naoImplementado()
}

// PUT /api/anuncios/:id (M4)
export async function editar(req, res) {
  naoImplementado()
}

// PATCH /api/anuncios/:id/status (M5)
export async function mudarStatus(req, res) {
  naoImplementado()
}

// DELETE /api/anuncios/:id (M6)
export async function excluir(req, res) {
  naoImplementado()
}

// POST /api/anuncios/:id/fotos (M8)
export async function adicionarFotos(req, res) {
  naoImplementado()
}

// DELETE /api/anuncios/:id/fotos/:fotoId (M8)
export async function removerFoto(req, res) {
  naoImplementado()
}

// GET /api/meus-anuncios (M3)
export async function meusAnuncios(req, res) {
  naoImplementado()
}
