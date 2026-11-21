// Denúncia de usuário feita de dentro do chat. Ela fica na tabela denuncia para a equipe analisar;
// a pessoa denunciada não é avisada e não fica sabendo quem denunciou.
import * as denunciaModel from '../models/denunciaModel.js'
import { participantesDaConversa } from '../models/mensagemModel.js'
import { erroHttp } from '../utils/erroHttp.js'
import { registrar } from '../utils/log.js'
import { lerId, lerOpcao, lerTexto } from '../utils/validacao.js'

export const MOTIVOS_DE_DENUNCIA = ['golpe', 'ofensa', 'spam', 'proibido', 'perfil_falso', 'outro']

// POST /api/conversas/:id/denuncia  { motivo, descricao? }
export async function criar(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  const motivo = lerOpcao(req.body?.motivo, 'motivo', MOTIVOS_DE_DENUNCIA)
  const descricao = lerTexto(req.body?.descricao, 'descricao', { max: 500 })
  if (motivo === 'outro' && !descricao) {
    throw erroHttp(400, 'Conte o que aconteceu no campo descricao.')
  }

  const denuncia = await denunciaModel.criar({ conversaId, denuncianteId: req.usuario.id, motivo, descricao })
  registrar('denuncia.criada', { denuncia_id: denuncia.id, conversa_id: conversaId, denunciado_id: denuncia.denunciado_id, motivo })

  res.status(201).json({ denuncia })
}

// GET /api/conversas/:id/denuncia: a denúncia que eu fiz nesta conversa (ou null)
export async function ver(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  const participantes = await participantesDaConversa(conversaId)
  if (!participantes.length) throw erroHttp(404, 'Conversa não encontrada.')
  if (!participantes.includes(req.usuario.id)) throw erroHttp(403, 'Você não participa desta conversa.')

  res.json({ denuncia: await denunciaModel.buscarDaConversa(conversaId, req.usuario.id) })
}
