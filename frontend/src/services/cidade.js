import { useSyncExternalStore } from 'react';
import { CIDADES } from './locais.js';

// Cidade escolhida no botão de localização do cabeçalho. Fica guardada no navegador.

const CHAVE = 'desapegauai.cidade';
export const CIDADE_PADRAO = 'Viçosa';

let atual = null;
const ouvintes = new Set();

function ler() {
  if (atual) return atual;
  try {
    const salva = localStorage.getItem(CHAVE);
    atual = CIDADES.some((c) => c.nome === salva) ? salva : CIDADE_PADRAO;
  } catch {
    atual = CIDADE_PADRAO;
  }
  return atual;
}

function assinar(avisar) {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}

export const useCidade = () => useSyncExternalStore(assinar, ler);

export function escolherCidade(nome) {
  try {
    localStorage.setItem(CHAVE, nome);
  } catch {
    // sem acesso ao armazenamento: vale só nesta visita
  }
  atual = nome;
  ouvintes.forEach((avisar) => avisar());
}

/** Posição do menu de cidades logo abaixo do botão, sem sair da tela. */
export function posicaoDoMenu(botao, largura = 260) {
  const caixa = botao.getBoundingClientRect();
  return { top: caixa.bottom + 8, left: Math.max(8, Math.min(caixa.left, window.innerWidth - largura - 8)) };
}
