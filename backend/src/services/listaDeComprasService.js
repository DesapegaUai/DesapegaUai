// Lista de compras: a pessoa escreve o que quer ("celular usado até R$ 800"), a IA do DesapegaUai entende
// e mostra os anúncios que combinam, com a nota de custo-benefício. A lista é particular: ninguém mais
// vê, e quem anuncia não fica sabendo quem procura. Quando sai um anúncio que combina, chega um aviso.
import * as comparacaoModel from '../models/comparacaoModel.js'
import * as listaModel from '../models/listaDeComprasModel.js'
import * as repo from '../repositories/notificacaoRepository.js'
import { avisarUsuarios } from '../socket.js'
import { erroHttp } from '../utils/erroHttp.js'
import { registrar } from '../utils/log.js'
import { lerId, lerTexto } from '../utils/validacao.js'
import { combinaComItem, entenderItem, lerAnuncio, avaliarGrupo, normalizar, termosDeBusca } from './assistenteDeCompras.js'
import { exigirTextoPermitido } from './moderacaoDeTexto.js'
import { anunciosPerto, ordenarPorNota, paraAIA, referenciaDaBusca } from './comparacaoService.js'
import * as push from './pushService.js'

export const MAXIMO_DE_ITENS = 30
const CANDIDATOS_POR_ITEM = 60
const ANUNCIOS_POR_ITEM = 3
const RAIO_DO_AVISO_KM = 30 // "Viçosa e região": o aviso vale para anúncios até 30 km da cidade do item
const MAXIMO_DE_AVISOS = 30 // por anúncio publicado
const ESTADOS_ACEITOS = { usado: ['usado', 'seminovo'], seminovo: ['seminovo', 'novo'], novo: ['novo'] }

const formatarPreco = (preco) => Number(preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * A lista com os anúncios de cada item, perto da referência da pessoa (a mesma da busca por proximidade:
 * GPS, bairro, cidade ou a guardada, e o raio). Tudo é calculado na hora: anúncio novo, preço novo,
 * vendido ou excluído já aparecem (ou somem).
 */
export async function listar(usuarioId, query) {
  const itens = await listaModel.listar(usuarioId)
  const referencia = itens.some((item) => !item.comprado) ? await referenciaDaBusca(query, usuarioId) : null

  // 1. candidatos de cada item ainda não comprado (uma busca por item, no raio da pessoa)
  const buscas = []
  for (const item of itens) {
    const entendido = entenderItem(item.texto)
    const termos = item.comprado ? [] : termosDeBusca(entendido)
    const candidatos = termos.length
      ? await anunciosPerto(referencia, usuarioId, {
        buscaQualquer: termos,
        excluirUsuarioId: usuarioId,
        condicoes: entendido.condicao ? ESTADOS_ACEITOS[entendido.condicao] : [],
        precoMax: entendido.precoMax,
      }, CANDIDATOS_POR_ITEM)
      : []
    buscas.push({ item, entendido, candidatos })
  }

  // 2. dados públicos de todos os candidatos de uma vez
  const ids = [...new Set(buscas.flatMap((b) => b.candidatos.map((c) => c.id)))]
  const detalhes = await comparacaoModel.detalhesPublicos(ids)

  // 3. a IA confere um por um e dá a nota entre os que combinam
  let totalEstimado = 0
  const resposta = buscas.map(({ item, entendido, candidatos }) => {
    const cards = new Map(candidatos.map((card) => [card.id, card]))
    const combinam = candidatos.map((card) => paraAIA(card, detalhes.get(card.id))).filter((a) => combinaComItem(entendido, a))
    const base = { id: item.id, texto: item.texto, comprado: item.comprado, criado_em: item.criado_em, entendi: entendido.entendi }
    if (!combinam.length) return { ...base, total: 0, menor_preco: null, anuncios: [] }

    const melhores = ordenarPorNota(avaliarGrupo(combinam).anuncios).slice(0, ANUNCIOS_POR_ITEM)
    totalEstimado += melhores[0].preco
    return {
      ...base,
      total: combinam.length,
      menor_preco: Math.min(...combinam.map((a) => a.preco)),
      anuncios: melhores.map((a) => {
        const card = cards.get(a.id)
        return {
          id: card.id, titulo: card.titulo, preco: Number(card.preco), condicao: card.condicao, status: card.status,
          categoria_slug: card.categoria_slug, bairro: card.bairro, cidade: card.cidade, foto_capa: card.foto_capa,
          distancia_km: card.distancia_km ?? null, nota: a.nota, motivo: a.motivo, melhor: a.melhor,
        }
      }),
    }
  })

  return { itens: resposta, total_estimado: totalEstimado }
}

/** Novo item. A IA precisa entender o que é (um produto ou uma palavra), senão volta 400 com um exemplo. */
export async function criar(usuarioId, corpo) {
  const texto = lerTexto(corpo?.texto, 'texto', { obrigatorio: true, min: 2, max: 80 })
  exigirTextoPermitido({ texto }, { onde: 'lista', usuarioId })
  const entendido = entenderItem(texto)
  if (!entendido.tipo && !entendido.termos.length) {
    throw erroHttp(400, 'Escreva o que você quer encontrar, por exemplo: celular usado até R$ 800.')
  }

  let cidadeId = null
  if (corpo?.cidade_id !== undefined && corpo?.cidade_id !== null && corpo?.cidade_id !== '') {
    cidadeId = lerId(corpo.cidade_id, 'id da cidade')
    if (!(await listaModel.cidadeExiste(cidadeId))) throw erroHttp(400, 'Cidade não encontrada.')
  }

  const itens = await listaModel.listar(usuarioId)
  if (itens.length >= MAXIMO_DE_ITENS) {
    throw erroHttp(409, `Sua lista já tem ${MAXIMO_DE_ITENS} itens. Tire os que você já comprou para colocar outros.`)
  }
  const igual = normalizar(texto).replace(/\s+/g, ' ').trim()
  if (itens.some((item) => normalizar(item.texto).replace(/\s+/g, ' ').trim() === igual)) {
    throw erroHttp(409, 'Esse item já está na sua lista.')
  }

  const item = await listaModel.criar({ usuarioId, texto, cidadeId })
  registrar('lista_compras.item_criado', { usuario_id: usuarioId, item_id: item.id })
  return { ...item, entendi: entendido.entendi }
}

/** Marcar como comprado (ou desmarcar). Item de outra pessoa responde 404, como se não existisse. */
export async function atualizar(usuarioId, id, corpo) {
  if (typeof corpo?.comprado !== 'boolean') throw erroHttp(400, 'O campo comprado precisa ser true ou false.')
  if (!(await listaModel.marcarComprado(id, usuarioId, corpo.comprado))) throw erroHttp(404, 'Item não encontrado na sua lista.')
  const item = await listaModel.buscar(id, usuarioId)
  return { ...item, entendi: entenderItem(item.texto).entendi }
}

export async function excluir(usuarioId, id) {
  if (!(await listaModel.excluir(id, usuarioId))) throw erroHttp(404, 'Item não encontrado na sua lista.')
}

/**
 * Chamado quando um anúncio passa a ser ativo (publicado) ou é editado (antes = como ele era). Quem tem na
 * lista um item que combina (de uma cidade até 30 km do anúncio) recebe um aviso no sininho e no aparelho.
 * Na edição, só avisa quando o anúncio passou a combinar agora (o preço baixou, por exemplo).
 * Um aviso por pessoa e por anúncio. Não trava a resposta de quem publicou: erros só vão para o log.
 */
export async function avisarListasDeCompras(anuncio, { antes = null } = {}) {
  try {
    const ponto = anuncio.localizacao_anuncio
    if (!ponto?.latitude || !ponto?.longitude) return
    const itens = await listaModel.candidatosParaAnuncio({
      vendedorId: anuncio.vendedor.id, latitude: ponto.latitude, longitude: ponto.longitude, raioKm: RAIO_DO_AVISO_KM,
    })
    if (!itens.length) return

    // só o que é público no anúncio, como na comparação
    const publico = { titulo: anuncio.titulo, descricao: anuncio.descricao, preco: Number(anuncio.preco), condicao: anuncio.condicao }
    const leitura = lerAnuncio(publico)
    const publicoAntes = antes ? { titulo: antes.titulo, descricao: antes.descricao, preco: Number(antes.preco), condicao: antes.condicao } : null
    const leituraAntes = publicoAntes ? lerAnuncio(publicoAntes) : null
    const local = [anuncio.bairro, anuncio.cidade].filter(Boolean).join(', ')
    const avisados = await listaModel.jaAvisados(anuncio.id)
    const novos = new Set()
    for (const item of itens) {
      if (avisados.has(Number(item.usuario_id))) continue
      const entendido = entenderItem(item.texto)
      if (!combinaComItem(entendido, publico, leitura)) continue
      if (publicoAntes && combinaComItem(entendido, publicoAntes, leituraAntes)) continue // já combinava antes da edição
      avisados.add(Number(item.usuario_id))
      novos.add(Number(item.usuario_id))
      const aviso = await repo.criarAviso({
        usuarioId: item.usuario_id,
        tipo: 'lista_compras',
        anuncioId: anuncio.id,
        titulo: `${antes ? 'Agora combina com a sua lista de compras' : 'Apareceu na sua lista de compras'}: ${anuncio.titulo}`.slice(0, 120),
        texto: `${item.texto} · ${formatarPreco(anuncio.preco)} · ${local}`.slice(0, 255),
      })
      avisarUsuarios([item.usuario_id], 'nova_notificacao', aviso)
      if (novos.size >= MAXIMO_DE_AVISOS) break
    }
    if (!novos.size) return

    const { enviados } = await push.enviarPara([...novos], push.avisoDeAnuncio(anuncio, { titulo: 'Lista de compras', tag: `lista-${anuncio.id}` }))
      .catch(() => ({ enviados: 0 }))
    registrar('notificacao.lista_compras', { anuncio_id: anuncio.id, avisados: novos.size, push_enviados: enviados, edicao: Boolean(antes) })
  } catch (erro) {
    console.error('Não foi possível avisar as listas de compras:', erro.message)
  }
}
