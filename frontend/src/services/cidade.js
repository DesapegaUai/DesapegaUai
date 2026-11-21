import { useLocalizacao, usarLocalManual } from './localizacao.js'
import { listarCidades, simplificar } from './locais.js'

// Cidade de referência, para as telas que só precisam do nome dela (como o cabeçalho da Home).
// A referência completa (GPS, bairro e raio) fica em services/localizacao.js.

export const CIDADE_PADRAO = 'Viçosa'

export const useCidade = () => useLocalizacao().cidade?.nome ?? CIDADE_PADRAO

export async function escolherCidade(nome) {
  const cidade = (await listarCidades()).find((c) => simplificar(c.nome) === simplificar(nome))
  if (cidade) await usarLocalManual({ id: cidade.id, nome: cidade.nome })
}

/** Posição do menu logo abaixo do botão, sem sair da tela. */
export function posicaoDoMenu(botao, largura = 328) {
  const caixa = botao.getBoundingClientRect()
  return { top: caixa.bottom + 8, left: Math.max(8, Math.min(caixa.left, window.innerWidth - largura - 8)) }
}
