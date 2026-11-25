// Fixar conversa e fixar mensagem (como no WhatsApp).
//   Conversa: cada pessoa fixa até 3 no topo da própria lista (só ela vê).
//   Mensagem: até 3 por conversa, no topo da conversa para as duas pessoas, por 24 horas, 7 dias ou 30 dias.
//   Com 3 já fixadas, a nova só entra substituindo a mais antiga (o site pergunta antes).
import * as fixadasModel from '../models/fixadasModel.js'
import { participantesDaConversa } from '../models/mensagemModel.js'
import { avisarUsuarios } from '../socket.js'
import { erroHttp } from '../utils/erroHttp.js'
import { lerId, lerOpcao } from '../utils/validacao.js'

export const MAXIMO_DE_CONVERSAS = 3
export const MAXIMO_DE_MENSAGENS = 3
export const DURACOES_EM_HORAS = { '24h': 24, '7d': 7 * 24, '30d': 30 * 24 }
export const DURACAO_PADRAO = '7d'

function limite(mensagem) {
  const erro = erroHttp(409, mensagem)
  erro.codigo = 'LIMITE_DE_FIXADAS'
  return erro
}

async function exigirParticipante(conversaId, usuarioId) {
  const participantes = await participantesDaConversa(conversaId)
  if (!participantes.length) throw erroHttp(404, 'Conversa não encontrada.')
  if (!participantes.includes(usuarioId)) throw erroHttp(403, 'Você não participa desta conversa.')
  return participantes
}

// ---------------------------------------------------------------- conversas

export async function fixarConversa(conversaIdBruto, usuarioId) {
  const conversaId = lerId(conversaIdBruto, 'id da conversa')
  await exigirParticipante(conversaId, usuarioId)
  const resultado = await fixadasModel.fixarConversa(usuarioId, conversaId, MAXIMO_DE_CONVERSAS)
  if (resultado.limite) throw limite(`Você só pode fixar até ${MAXIMO_DE_CONVERSAS} conversas. Desafixe uma para fixar esta.`)
  avisarUsuarios([usuarioId], 'conversas_fixadas_mudaram', { conversa_id: conversaId }) // as outras abas da pessoa
  return { conversa_id: conversaId, fixada: true }
}

export async function desafixarConversa(conversaIdBruto, usuarioId) {
  const conversaId = lerId(conversaIdBruto, 'id da conversa')
  await exigirParticipante(conversaId, usuarioId)
  await fixadasModel.desafixarConversa(usuarioId, conversaId)
  avisarUsuarios([usuarioId], 'conversas_fixadas_mudaram', { conversa_id: conversaId })
  return { conversa_id: conversaId, fixada: false }
}

// ---------------------------------------------------------------- mensagens

export async function listarMensagensFixadas(conversaIdBruto, usuarioId) {
  const conversaId = lerId(conversaIdBruto, 'id da conversa')
  await exigirParticipante(conversaId, usuarioId)
  return { fixadas: await fixadasModel.mensagensFixadas(conversaId, usuarioId) }
}

/** { duracao: '24h' | '7d' | '30d', substituir?: true } */
export async function fixarMensagem(conversaIdBruto, mensagemIdBruto, usuarioId, corpo) {
  const conversaId = lerId(conversaIdBruto, 'id da conversa')
  const mensagemId = lerId(mensagemIdBruto, 'id da mensagem')
  const duracao = corpo?.duracao === undefined ? DURACAO_PADRAO : lerOpcao(corpo.duracao, 'duracao', Object.keys(DURACOES_EM_HORAS))
  if (corpo?.substituir !== undefined && typeof corpo.substituir !== 'boolean') throw erroHttp(400, 'O campo substituir precisa ser verdadeiro ou falso.')
  const participantes = await exigirParticipante(conversaId, usuarioId)

  const mensagem = await fixadasModel.mensagemVisivel(conversaId, mensagemId, usuarioId)
  if (!mensagem) throw erroHttp(404, 'Mensagem não encontrada.')
  if (mensagem.apagada_em) throw erroHttp(409, 'Mensagem apagada não pode ser fixada.')

  const expiraEm = new Date(Date.now() + DURACOES_EM_HORAS[duracao] * 60 * 60 * 1000)
  const resultado = await fixadasModel.fixarMensagem({
    conversaId, mensagemId, usuarioId, expiraEm, substituir: corpo?.substituir === true, maximo: MAXIMO_DE_MENSAGENS,
  })
  if (resultado.limite) throw limite(`Já há ${MAXIMO_DE_MENSAGENS} mensagens fixadas nesta conversa. Para fixar esta, a mais antiga deixa de ficar fixada.`)

  avisarUsuarios(participantes, 'mensagens_fixadas_mudaram', { conversa_id: conversaId })
  return { substituida: resultado.substituida, fixadas: await fixadasModel.mensagensFixadas(conversaId, usuarioId) }
}

export async function desafixarMensagem(conversaIdBruto, mensagemIdBruto, usuarioId) {
  const conversaId = lerId(conversaIdBruto, 'id da conversa')
  const mensagemId = lerId(mensagemIdBruto, 'id da mensagem')
  const participantes = await exigirParticipante(conversaId, usuarioId)
  if (await fixadasModel.desafixarMensagem(conversaId, mensagemId)) {
    avisarUsuarios(participantes, 'mensagens_fixadas_mudaram', { conversa_id: conversaId })
  }
  return { fixadas: await fixadasModel.mensagensFixadas(conversaId, usuarioId) }
}

/** apagada para todos: sai das fixadas (e o topo da conversa das duas pessoas atualiza) */
export async function aoApagarParaTodos(mensagem, participantes) {
  if (await fixadasModel.removerFixacao(mensagem.id)) {
    avisarUsuarios(participantes, 'mensagens_fixadas_mudaram', { conversa_id: mensagem.conversa_id })
  }
}

/** excluiu a conversa (para si): ela sai das fixadas dessa pessoa */
export const aoExcluirConversa = (conversaId, usuarioId) => fixadasModel.desafixarConversa(usuarioId, conversaId)
