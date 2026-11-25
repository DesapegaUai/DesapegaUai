// Denúncia de anúncio (os três pontinhos da página do anúncio). As regras estão em denunciaAnuncioService.
import { denunciar, minhaDenuncia } from '../services/denunciaAnuncioService.js'

// POST /api/anuncios/:id/denuncia  { motivo, descricao? }
export async function criar(req, res) {
  res.status(201).json(await denunciar(req.params.id, req.usuario.id, req.body))
}

// GET /api/anuncios/:id/denuncia: a denúncia que eu fiz neste anúncio (ou null)
export async function ver(req, res) {
  res.json(await minhaDenuncia(req.params.id, req.usuario.id))
}
