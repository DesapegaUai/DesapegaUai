// Textos do comparador e da lista de compras (a conta é toda da API; aqui só se escreve para a tela).
import { formatarPreco } from './formatar.js'

export const NOME_DA_CONDICAO = { novo: 'Novo', seminovo: 'Seminovo', usado: 'Usado' }
const formatoKm = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const formatoNota = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const textoDaNota = (nota) => formatoNota.format(nota)
// a cor da nota: verde (ótimo), verde-limão (bom), âmbar (regular), vermelho (fraco)
export const corDaNota = (nota) => (nota >= 8 ? '#3E8B22' : nota >= 6.5 ? '#6BA81E' : nota >= 5 ? '#D69E00' : '#C0392B')
export const vereditoDaNota = (nota) => (nota >= 8.5 ? 'Excelente' : nota >= 7.5 ? 'Ótimo' : nota >= 6.5 ? 'Bom' : nota >= 5 ? 'Regular' : 'Fraco')
export const textoDaDistancia = (km) => (typeof km === 'number' ? (km < 0.1 ? 'menos de 100 m' : `${formatoKm.format(km)} km`) : null)

/** "Na média", "R$ 70 abaixo da média" (ou, curto, "R$ 70 abaixo") */
export function textoDaFaixa(faixa, { curto = false } = {}) {
  if (!faixa) return ''
  if (faixa.tipo === 'media') return curto ? 'na média' : 'Na média'
  const valor = formatarPreco(faixa.diferenca)
  return `${valor} ${faixa.tipo === 'abaixo' ? 'abaixo' : 'acima'}${curto ? '' : ' da média'}`
}

/** "3 bicicletas parecidas", "2 celulares parecidos", "4 anúncios parecidos" */
export function nomeDoGrupo(tipo, total) {
  if (!tipo) return `${total} anúncios parecidos`
  return `${total} ${tipo.plural} parecid${tipo.genero === 'a' ? 'as' : 'os'}`
}

/** O que ficou fora da conta, numa frase (ou null) */
export function fraseDeFora(fora) {
  if (!fora?.length) return null
  if (fora.length === 1) return `"${fora[0].titulo}" ficou fora da conta porque ${fora[0].motivo}.`
  return `${fora.length} anúncios da busca ficaram fora da conta porque são outro produto, outro tipo ou acessório.`
}
