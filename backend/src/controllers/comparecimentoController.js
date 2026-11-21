// Compromisso nas entregas ("não dá bolo"): depois da venda, cada lado diz se o outro apareceu.
// O resultado vira uma taxa no perfil; quem respondeu o quê não aparece para ninguém.
import * as comparecimentoModel from '../models/comparecimentoModel.js'
import { erroHttp } from '../utils/erroHttp.js'
import { registrar } from '../utils/log.js'
import { lerId } from '../utils/validacao.js'

// GET /api/conversas/:id/comparecimento: a minha resposta nesta conversa (ou null)
export async function ver(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  res.json({ comparecimento: await comparecimentoModel.buscarDaConversa(conversaId, req.usuario.id) })
}

// POST /api/conversas/:id/comparecimento  { compareceu: true | false }
export async function responder(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  const compareceu = req.body?.compareceu
  if (typeof compareceu !== 'boolean') throw erroHttp(400, 'Informe compareceu como verdadeiro ou falso.')

  const { avaliado_id: avaliadoId, ...comparecimento } = await comparecimentoModel.responder({ conversaId, usuarioId: req.usuario.id, compareceu })
  registrar('comparecimento.respondido', { conversa_id: conversaId, avaliado_id: avaliadoId, compareceu })
  res.status(201).json({ comparecimento })
}
