// Opções da caixa de mensagem. As conversas vêm da API (services/mercadoApi.js).

export const RESPOSTAS_RAPIDAS = [
  'Ainda está disponível?',
  'Aceita retirada hoje?',
  'Posso combinar no Centro',
];

/** Fotos aceitas no chat (os mesmos limites do servidor: POST /api/conversas/:id/fotos) */
export const ANEXOS = {
  aceitos: 'image/jpeg,image/png,image/webp',
  tipos: ['image/jpeg', 'image/png', 'image/webp'],
  maxArquivos: 5,
  maxBytes: 8 * 1024 * 1024, // 8 MB por foto
};

// Conversas arquivadas: é só uma organização da lista, guardada neste navegador (por conta).
// Ficam guardados só os números das conversas, nada do conteúdo.
const chaveDasArquivadas = (usuarioId) => `desapegauai.conversas.arquivadas.v1.${usuarioId}`;

export function lerArquivadas(usuarioId) {
  try {
    const lista = JSON.parse(localStorage.getItem(chaveDasArquivadas(usuarioId)) ?? '[]');
    return new Set(Array.isArray(lista) ? lista.filter(Number.isInteger) : []);
  } catch {
    return new Set(); // sem acesso ao armazenamento: nenhuma arquivada
  }
}

export function salvarArquivadas(usuarioId, ids) {
  try {
    localStorage.setItem(chaveDasArquivadas(usuarioId), JSON.stringify([...ids]));
  } catch {
    // sem armazenamento: vale só enquanto a página estiver aberta
  }
}

// Lugares públicos e movimentados de Viçosa para combinar a entrega sem passar o endereço de casa
export const PONTOS_DE_ENCONTRO = [
  'Portaria da UFV',
  'Praça Silviano Brandão',
  'Calçadão',
  'Terminal Rodoviário',
  'Portaria da Univiçosa',
];

// Editar e "apagar para todos" seguem os prazos do WhatsApp (a API confere de novo)
export const PRAZO_PARA_EDITAR_MS = 15 * 60 * 1000;
export const PRAZO_PARA_APAGAR_PARA_TODOS_MS = 2 * 24 * 60 * 60 * 1000;
const idade = (mensagem) => Date.now() - new Date(mensagem.enviada_em).getTime();
export const podeEditar = (mensagem) => mensagem.minha && !mensagem.apagada && idade(mensagem) < PRAZO_PARA_EDITAR_MS;
export const podeApagarParaTodos = (mensagem) => mensagem.minha && !mensagem.apagada && idade(mensagem) < PRAZO_PARA_APAGAR_PARA_TODOS_MS;

const ALTURA_MENU_DA_MENSAGEM = 160;

// Lugar do menu na tela: embaixo da mensagem (ou em cima, se não couber), do lado de quem enviou
export function posicaoDoMenu(elemento, minha) {
  const caixa = elemento.getBoundingClientRect();
  const abreParaCima = caixa.bottom + ALTURA_MENU_DA_MENSAGEM > window.innerHeight;
  return {
    ...(minha ? { right: Math.max(8, window.innerWidth - caixa.right) } : { left: Math.max(8, caixa.left) }),
    ...(abreParaCima ? { bottom: window.innerHeight - caixa.top + 6 } : { top: caixa.bottom + 6 }),
  };
}
