// Programar mensagem (como no WhatsApp): a pessoa escolhe o dia e a hora, e a mensagem sai sozinha,
// mesmo com o site fechado. Até lá só quem programou vê e pode enviar na hora ou apagar.
// O servidor confere a fila a cada 10 segundos. A mensagem é gravada e a programada sai da fila na
// mesma transação (salvarMensagem com programadaId): nunca sai duas vezes, nem se perde se o servidor cair.
import * as programadaModel from '../models/mensagemProgramadaModel.js'
import { participantesDaConversa, salvarMensagem } from '../models/mensagemModel.js'
import { avisarUsuarios, marcarEntregueSeOnline } from '../socket.js'
import { erroHttp } from '../utils/erroHttp.js'
import { registrar } from '../utils/log.js'
import { lerId, lerTexto } from '../utils/validacao.js'
import { exigirTextoPermitido } from './moderacaoDeTexto.js'
import { avisarMensagemNova } from './notificacaoService.js'

export const MAXIMO_DE_DIAS = 30
export const MAXIMO_POR_CONVERSA = 20
const ANTECEDENCIA_MINIMA_MS = 10 * 1000 // o horário precisa estar no futuro (com folga para o relógio do aparelho)
const INTERVALO_DA_FILA_MS = 10 * 1000

const formatar = (linha) => ({ id: linha.id, conversa_id: linha.conversa_id, texto: linha.texto, enviar_em: linha.enviar_em, criada_em: linha.criada_em })

// só quem participa da conversa (comprador ou vendedor) programa e vê as próprias programadas
async function conferirParticipante(conversaId, usuarioId) {
  const participantes = await participantesDaConversa(conversaId)
  if (!participantes.length) throw erroHttp(404, 'Conversa não encontrada.')
  if (!participantes.map(Number).includes(Number(usuarioId))) throw erroHttp(403, 'Você não participa desta conversa.')
  return participantes
}

function lerHorario(valor) {
  if (typeof valor !== 'string' || !valor.trim()) throw erroHttp(400, 'Escolha o dia e a hora do envio (campo enviar_em).')
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) throw erroHttp(400, 'O dia e a hora do envio (enviar_em) não são uma data válida.')
  const agora = Date.now()
  if (data.getTime() < agora + ANTECEDENCIA_MINIMA_MS) throw erroHttp(400, 'Escolha um horário que ainda não passou.')
  if (data.getTime() > agora + MAXIMO_DE_DIAS * 24 * 60 * 60 * 1000 + 60 * 1000) {
    throw erroHttp(400, `Dá para programar até ${MAXIMO_DE_DIAS} dias para a frente.`)
  }
  data.setUTCSeconds(0, 0) // o horário escolhido é em minutos, como no relógio
  return data
}

export async function programar(conversaIdBruto, usuarioId, corpo) {
  const conversaId = lerId(conversaIdBruto, 'id da conversa')
  const texto = lerTexto(corpo?.texto, 'texto', { obrigatorio: true, min: 1, max: 1000 })
  exigirTextoPermitido({ texto }, { onde: 'chat', usuarioId }) // recusa já ao programar, não só na hora de sair
  const enviarEm = lerHorario(corpo?.enviar_em)
  await conferirParticipante(conversaId, usuarioId)
  if ((await programadaModel.contar(conversaId, usuarioId)) >= MAXIMO_POR_CONVERSA) {
    throw erroHttp(409, `Você já tem ${MAXIMO_POR_CONVERSA} mensagens programadas nesta conversa.`)
  }
  const programada = formatar(await programadaModel.criar({ conversaId, remetenteId: usuarioId, texto, enviarEm }))
  avisarUsuarios([usuarioId], 'programadas_mudaram', { conversa_id: conversaId }) // as outras abas de quem programou
  registrar('mensagem_programada.criada', { conversa_id: conversaId, usuario_id: usuarioId, programada_id: programada.id })
  return programada
}

export async function listar(conversaIdBruto, usuarioId) {
  const conversaId = lerId(conversaIdBruto, 'id da conversa')
  await conferirParticipante(conversaId, usuarioId)
  return (await programadaModel.listar(conversaId, usuarioId)).map(formatar)
}

export async function apagar(conversaIdBruto, programadaIdBruto, usuarioId) {
  const conversaId = lerId(conversaIdBruto, 'id da conversa')
  const programadaId = lerId(programadaIdBruto, 'id da mensagem programada')
  await conferirParticipante(conversaId, usuarioId)
  if (!(await programadaModel.apagar(programadaId, conversaId, usuarioId))) {
    throw erroHttp(404, 'Mensagem programada não encontrada (ela pode já ter sido enviada).')
  }
  avisarUsuarios([usuarioId], 'programadas_mudaram', { conversa_id: conversaId })
}

// grava a mensagem (tirando a programada da fila na mesma transação) e avisa como qualquer mensagem
async function enviar(programada) {
  const resultado = await salvarMensagem(programada.conversa_id, programada.remetente_id, programada.texto, null, null, null, { programadaId: programada.id })
  await marcarEntregueSeOnline(resultado.mensagem, resultado.participantes)
  avisarUsuarios(resultado.participantes, 'nova_mensagem', resultado.mensagem)
  avisarUsuarios([programada.remetente_id], 'programadas_mudaram', { conversa_id: programada.conversa_id })
  avisarMensagemNova(resultado.mensagem, resultado.participantes) // notificação no aparelho (não trava)
  registrar('mensagem_programada.enviada', { conversa_id: programada.conversa_id, programada_id: programada.id, mensagem_id: resultado.mensagem.id })
  return resultado.mensagem
}

/** "Enviar agora": manda na hora a mensagem programada (só quem programou). */
export async function enviarAgora(conversaIdBruto, programadaIdBruto, usuarioId) {
  const conversaId = lerId(conversaIdBruto, 'id da conversa')
  const programadaId = lerId(programadaIdBruto, 'id da mensagem programada')
  await conferirParticipante(conversaId, usuarioId)
  const programada = await programadaModel.buscar(programadaId, conversaId, usuarioId)
  if (!programada) throw erroHttp(404, 'Mensagem programada não encontrada (ela pode já ter sido enviada).')
  return enviar(programada)
}

/**
 * Manda as programadas que chegaram na hora. Se a conversa não existe mais (ou a pessoa saiu dela),
 * a programada sai da fila. Erro do banco: fica na fila e tenta de novo na próxima volta.
 */
export async function processarVencidas() {
  let enviadas = 0
  for (const programada of await programadaModel.vencidas()) {
    try {
      await enviar(programada)
      enviadas += 1
    } catch (erro) {
      if (erro.status === 404 && /programada/.test(erro.message)) continue // já foi enviada ou apagada
      // 422: a moderação recusou na hora de sair (regra nova depois que foi programada)
      if (erro.status === 403 || erro.status === 404 || erro.status === 400 || erro.status === 422) {
        await programadaModel.descartar(programada.id)
        registrar('mensagem_programada.descartada', { programada_id: programada.id, motivo: erro.message })
      } else {
        console.error('Não foi possível enviar a mensagem programada:', erro.message)
      }
    }
  }
  return enviadas
}

let relogio = null
export function iniciarFilaDeProgramadas() {
  if (relogio) return
  const volta = () => processarVencidas().catch((erro) => console.error('Erro na fila de mensagens programadas:', erro.message))
  volta()
  relogio = setInterval(volta, INTERVALO_DA_FILA_MS)
  relogio.unref()
}
