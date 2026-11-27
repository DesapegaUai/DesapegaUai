// Histórico de preço e aviso de queda de preço ("favoritou, acompanha"): quem salvou o anúncio nos
// Favoritos é avisado no sininho e no celular quando o preço baixa. A página do anúncio mostra o gráfico do
// preço e quanto baixou. O preço é público, então o histórico também é.
import * as historicoModel from '../models/historicoPrecoModel.js'
import * as repo from '../repositories/notificacaoRepository.js'
import { avisarUsuarios } from '../socket.js'
import { registrar } from '../utils/log.js'
import * as push from './pushService.js'

const DIA_MS = 24 * 60 * 60 * 1000
// "baixou R$ 70" aparece por 30 dias depois da queda; e só avisa de novo se baixar mais que o menor preço desse período
export const JANELA_DIAS = 30
const STATUS_QUE_AVISAM = ['ativo', 'reservado']

const formatarPreco = (preco) => Number(preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const emReais = (valor) => Math.round(Number(valor) * 100) / 100

/** a última mudança foi uma queda, nos últimos 30 dias? { de, para, diferenca, em } ou null */
export function quantoBaixou(historico, agora = new Date()) {
  if (historico.length < 2) return null
  const atual = historico.at(-1)
  const anterior = historico.at(-2)
  if (!(anterior.preco > atual.preco)) return null
  if (agora - new Date(atual.em) > JANELA_DIAS * DIA_MS) return null
  return { de: anterior.preco, para: atual.preco, diferenca: emReais(anterior.preco - atual.preco), em: atual.em }
}

/** Os pontos do gráfico (cada mudança de preço) e quanto baixou. Anúncio sem histórico: o preço desde a publicação. */
export async function historicoDoAnuncio(anuncio) {
  if (!anuncio || anuncio.status === 'rascunho' || !anuncio.data_publicacao) return { historico: [], baixou: null }
  const linhas = await historicoModel.listar(anuncio.id)
  const historico = linhas.length ? linhas : [{ preco: Number(anuncio.preco), em: anuncio.data_publicacao }]
  return { historico, baixou: quantoBaixou(historico) }
}

/**
 * O dono mudou o preço de um anúncio publicado: guarda no histórico (dentro da transação da edição).
 * O primeiro registro de um anúncio antigo é o preço de antes, desde a data de publicação.
 * Devolve { precoAntes, avisar }: avisar é verdadeiro quando o preço novo é o menor dos últimos 30 dias
 * (baixar, subir e baixar de novo para o mesmo valor não avisa duas vezes).
 */
export async function registrarMudancaDePreco(antes, precoNovo, conexao) {
  const precoAntes = Number(antes.preco)
  const novo = Number(precoNovo)
  if (antes.status === 'rascunho' || !antes.data_publicacao || !(precoAntes > 0) || !(novo > 0) || precoAntes === novo) return null

  const linhas = await historicoModel.listar(antes.id, conexao)
  const anteriores = linhas.length ? linhas : [{ preco: precoAntes, em: antes.data_publicacao }]
  if (!linhas.length) await historicoModel.registrar(antes.id, precoAntes, conexao, { em: antes.data_publicacao })
  await historicoModel.registrar(antes.id, novo, conexao)

  const desde = Date.now() - JANELA_DIAS * DIA_MS
  const menorRecente = Math.min(precoAntes, ...anteriores.filter((p) => new Date(p.em).getTime() >= desde).map((p) => p.preco))
  return { precoAntes, avisar: novo < menorRecente }
}

/** Avisa quem favoritou (sininho, tempo real e celular). Nunca derruba a edição: erro só vai para o log. */
export async function avisarQuedaDePreco(anuncio, precoAntes) {
  try {
    if (!STATUS_QUE_AVISAM.includes(anuncio.status)) return
    const usuarios = await historicoModel.quemFavoritou(anuncio.id, anuncio.vendedor.id)
    if (!usuarios.length) return

    const titulo = `Baixou! ${anuncio.titulo}`.slice(0, 120)
    const local = [anuncio.bairro, anuncio.cidade].filter(Boolean).join(', ')
    const texto = `De ${formatarPreco(precoAntes)} por ${formatarPreco(anuncio.preco)}${local ? ` · ${local}` : ''}`.slice(0, 255)
    for (const usuarioId of usuarios) {
      const aviso = await repo.criarAviso({ usuarioId, tipo: 'queda_preco', anuncioId: anuncio.id, titulo, texto })
      avisarUsuarios([usuarioId], 'nova_notificacao', aviso)
    }
    const noCelular = push.avisoDeAnuncio(anuncio, {
      titulo: 'Baixou o preço',
      detalhe: `de ${formatarPreco(precoAntes)} por ${formatarPreco(anuncio.preco)}`,
      tag: `preco-${anuncio.id}`,
    })
    const { enviados } = await push.enviarPara(usuarios, noCelular)
      .catch(() => ({ enviados: 0 }))
    registrar('notificacao.queda_preco', { anuncio_id: anuncio.id, avisados: usuarios.length, push_enviados: enviados })
  } catch (erro) {
    console.error('Não foi possível avisar a queda de preço:', erro.message)
  }
}
