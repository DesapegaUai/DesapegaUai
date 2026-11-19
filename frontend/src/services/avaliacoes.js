// Avaliações de vendedor (nota de 1 a 5 + comentário opcional, uma por conversa).
// Por enquanto ficam no navegador. Trocar pela API depois: POST /api/avaliacoes e
// GET /api/usuarios/:id/avaliacoes, com o aviso em tempo real pelo Socket.IO.

import { useSyncExternalStore } from 'react';

const CHAVE = 'desapegauai.avaliacoes.v1';

// 'eu' = Ana Beatriz (usuária logada). Os outros são os vendedores pelo nome.
const INICIAIS = [
  { id: 'a1', avaliado: 'eu', autor: 'Rafael Lima', anuncio: 'Liquidificador Arno', nota: 5, comentario: 'Produto igual às fotos e chegou no horário combinado.', quando: '12/11/2026' },
  { id: 'a2', avaliado: 'eu', autor: 'Juliana Prado', anuncio: 'Luminária de mesa', nota: 5, comentario: 'Super atenciosa, recomendo!', quando: '03/11/2026' },
  { id: 'a3', avaliado: 'eu', autor: 'Lorena Castro', anuncio: 'Fone JBL Tune 510', nota: 4, comentario: 'Tudo certo, só demorou um pouco para responder.', quando: '28/10/2026' },
  { id: 'a4', avaliado: 'eu', autor: 'Diego Rocha', anuncio: 'Cadeira de escritório', nota: 5, comentario: '', quando: '15/10/2026' },
  { id: 'a5', avaliado: 'eu', autor: 'Carla Bittencourt', anuncio: 'Tapete 2x1,5 m', nota: 5, comentario: 'Negociação tranquila e rápida.', quando: '02/10/2026' },
  { id: 'm1', avaliado: 'Marcos Vinícius', autor: 'Carla Bittencourt', anuncio: 'Química Geral — Russell', nota: 5, comentario: 'Livro bem conservado, entregou na UFV.', quando: '09/11/2026' },
  { id: 'm2', avaliado: 'Marcos Vinícius', autor: 'Diego Rocha', anuncio: 'Calculadora HP 12c', nota: 4, comentario: '', quando: '21/10/2026' },
  { id: 'r1', avaliado: 'Rafael Lima', autor: 'Lorena Castro', anuncio: 'Mochila Samsonite', nota: 5, comentario: 'Muito educado e pontual.', quando: '05/11/2026' },
  { id: 'j1', avaliado: 'Juliana Prado', autor: 'Marcos Vinícius', anuncio: 'Vestido midi floral', nota: 4, comentario: 'Peça bonita, igual ao anúncio.', quando: '30/10/2026' },
];

export const ROTULOS_NOTA = ['', 'Ruim', 'Regular', 'Boa', 'Muito boa', 'Excelente'];

const ouvintes = new Set();
let cache = null;

function lerNovas() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) ?? [];
  } catch {
    return [];
  }
}

function ler() {
  if (!cache) cache = [...lerNovas(), ...INICIAIS];
  return cache;
}

function gravar(novas) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(novas));
  } catch {
    // sem acesso ao armazenamento: vale só nesta visita
  }
  cache = [...novas, ...INICIAIS];
  ouvintes.forEach((avisar) => avisar());
}

function assinar(avisar) {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}

export const useAvaliacoes = () => useSyncExternalStore(assinar, ler);

export function avaliar({ conversa, avaliado, anuncio, nota, comentario }) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const nova = { id: `c-${conversa}`, conversa, avaliado, autor: 'Ana Beatriz Moreira', anuncio, nota, comentario: comentario.trim(), quando: hoje };
  gravar([nova, ...lerNovas().filter((a) => a.conversa !== conversa)]);
}

export const daConversa = (lista, conversa) => lista.find((a) => a.conversa === conversa) ?? null;

export function resumoDe(lista, avaliado) {
  const delas = lista.filter((a) => a.avaliado === avaliado);
  const qtd = delas.length;
  const media = qtd ? Math.round((delas.reduce((t, a) => t + a.nota, 0) / qtd) * 10) / 10 : 0;
  return { media, qtd, lista: delas };
}

export function reputacao({ media, qtd }) {
  if (!qtd) return 'Novo por aqui';
  if (media >= 4.5) return 'Ótimo';
  if (media >= 4) return 'Muito bom';
  if (media >= 3) return 'Bom';
  return 'Regular';
}

export const textoDaMedia = (media) => media.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
