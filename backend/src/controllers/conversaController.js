// Anthony. Já pronto para usar: req.usuario.id, erroHttp, lerId/lerTexto (utils/validacao)
// e, no Socket.IO, lerTokenDoCookie e verificarToken (utils/token).
import { erroHttp } from '../utils/erroHttp.js'
import { abrirConversa, listarConversas, contarConversasNaoLidas, } from '../models/conversaModel.js'
import { lerId, lerOpcao } from '../utils/validacao.js'

function naoImplementado() {
  throw erroHttp(501, 'Ainda não implementado.')
}

// POST /api/conversas (A2)
export async function abrir(req, res) {
  const anuncioId = lerId(req.body?.anuncio_id, 'id do anúncio')
  const compradorId = req.usuario.id

  const resultado = await abrirConversa(anuncioId, compradorId)

  let status = 200

  if (resultado.criada) {
    status = 201
  }

  res.status(status).json({
    conversa: resultado.conversa,
  })
}

// GET /api/conversas (A2)
export async function listar(req, res) {
  let filtro = 'todas'

  if (req.query.filtro !== undefined) {
    if (
      typeof req.query.filtro !== 'string' ||
      req.query.filtro.trim() !== ''
    ) {
      filtro = lerOpcao(
        req.query.filtro,
        'filtro',
        ['todas', 'nao_lidas', 'vendendo', 'comprando'],
      )
    }
  }

  const resultado = await listarConversas(req.usuario.id, filtro)

  res.json(resultado)
}

// GET /api/conversas/nao-lidas (A2)
export async function contarNaoLidas(req, res) {
  const total = await contarConversasNaoLidas(req.usuario.id)

  res.json({ total: total })
}

// GET /api/conversas/:id/mensagens (A3)
export async function verMensagens(req, res) {
  naoImplementado()
}

// POST /api/conversas/:id/mensagens (A3)
export async function enviarMensagem(req, res) {
  naoImplementado()
}
