// Procura-se com aviso automático: quando um anúncio é publicado, quem pediu algo parecido na
// mesma cidade recebe um aviso, e quem publicou fica sabendo que tem gente procurando.
import * as procuraModel from '../models/procuraModel.js'
import * as repo from '../repositories/notificacaoRepository.js'
import { avisarUsuarios } from '../socket.js'
import { registrar } from '../utils/log.js'
import * as push from './pushService.js'

const formatarPreco = (preco) => Number(preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const MAXIMO_DE_AVISOS = 30 // por anúncio publicado

// palavras que não dizem o que a pessoa procura
const SEM_SIGNIFICADO = new Set(['com', 'sem', 'para', 'por', 'uma', 'uns', 'umas', 'que', 'dos', 'das', 'ate', 'usado', 'usada',
  'novo', 'nova', 'bom', 'boa', 'barato', 'barata', 'procuro', 'procura', 'preciso', 'quero', 'compro', 'alguem', 'vendendo', 'vende'])

const normalizar = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function palavrasDoPedido(titulo) {
  return normalizar(titulo).split(' ').filter((p) => p.length >= 3 && !SEM_SIGNIFICADO.has(p))
}

// o pedido combina quando alguma palavra dele aparece no título ou na descrição do anúncio
export function combina(pedido, anuncio) {
  const texto = ` ${normalizar(`${anuncio.titulo} ${anuncio.descricao ?? ''}`)} `
  return palavrasDoPedido(pedido).some((palavra) => texto.includes(` ${palavra}`))
}

/** Chamado depois que um anúncio é publicado. Não trava a resposta: erros só vão para o log. */
export async function avisarProcurasAtendidas(anuncio) {
  try {
    if (!anuncio.cidade_id) return
    const candidatas = await procuraModel.candidatasParaAnuncio({
      vendedorId: anuncio.vendedor.id, cidadeId: anuncio.cidade_id, categoriaId: anuncio.categoria_id, preco: anuncio.preco,
    })
    const atendidas = candidatas.filter((p) => combina(p.titulo, anuncio)).slice(0, MAXIMO_DE_AVISOS)
    if (!atendidas.length) return

    const local = [anuncio.bairro, anuncio.cidade].filter(Boolean).join(', ')
    const avisados = new Set()
    for (const pedido of atendidas) {
      if (avisados.has(pedido.usuario_id)) continue // um aviso por pessoa, mesmo com dois pedidos parecidos
      avisados.add(pedido.usuario_id)
      const aviso = await repo.criarAviso({
        usuarioId: pedido.usuario_id,
        tipo: 'procura_atendida',
        anuncioId: anuncio.id,
        titulo: `Apareceu o que você procura: ${anuncio.titulo}`.slice(0, 120),
        texto: `${formatarPreco(anuncio.preco)} · ${local}`.slice(0, 255),
      })
      avisarUsuarios([pedido.usuario_id], 'nova_notificacao', aviso)
    }

    // quem publicou também fica sabendo: já tem comprador interessado
    const total = avisados.size
    const paraVendedor = await repo.criarAviso({
      usuarioId: anuncio.vendedor.id,
      tipo: 'procura_atendida',
      anuncioId: anuncio.id,
      titulo: (total === 1 ? '1 pessoa procura algo como o seu anúncio' : `${total} pessoas procuram algo como o seu anúncio`),
      texto: `Pedido no Procura-se: ${atendidas[0].titulo}. Quem procura já foi avisado do seu anúncio.`.slice(0, 255),
    })
    avisarUsuarios([anuncio.vendedor.id], 'nova_notificacao', paraVendedor)

    await push.enviarPara([...avisados], push.avisoDeAnuncio(anuncio, { titulo: 'Procura-se', chamada: 'Achamos: ', tag: `procura-${anuncio.id}` }))
      .catch(() => {})
    registrar('procura.atendida', { anuncio_id: anuncio.id, avisados: total })
  } catch (erro) {
    console.error('Não foi possível avisar quem procura:', erro.message)
  }
}
