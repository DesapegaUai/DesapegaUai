import { useSyncExternalStore } from 'react';

// Anúncios da pessoa logada: publicados, rascunhos e vendidos.
// HOJE: ficam guardados no navegador (localStorage), com dados de exemplo no primeiro acesso.
// DEPOIS: trocar por chamadas à API. O banco ainda não tem o status "rascunho" (só ativo e vendido).

const CHAVE = 'desapegauai.meus-anuncios.v1';

export const LIMITES = { fotos: 8, bytesFoto: 8 * 1024 * 1024, titulo: 80, descricao: 1000 };
export const CONDICOES = ['Novo', 'Seminovo', 'Usado'];
export const ENTREGAS = {
  retirada: { titulo: 'Retirada em mãos', descricao: 'O comprador retira o produto no local.' },
  combinar: { titulo: 'Combinar com o vendedor', descricao: 'Combine a entrega diretamente com o comprador.' },
};
export const ROTULO_STATUS = { ativo: 'Ativo', rascunho: 'Rascunho', vendido: 'Vendido' };

const exemplo = (id, titulo, preco, categoria, condicao, bairro, foto, visualizacoes, favoritos, extra = {}) => ({
  id,
  titulo,
  preco,
  categoria,
  condicao,
  descricao: `${titulo} bem conservado, pronto para usar. Chame no chat para combinar a retirada.`,
  cidade: 'Viçosa',
  bairro,
  entrega: 'retirada',
  fotos: foto ? [`/img/fotos/${foto}.webp`] : [],
  visualizacoes,
  favoritos,
  status: 'ativo',
  atualizadoEm: '2026-11-10T12:00:00.000Z',
  ...extra,
});

const EXEMPLOS = [
  exemplo('meu-1', 'Poltrona retrô verde', 450, 'casa', 'Usado', 'Centro', null, 128, 18),
  exemplo('meu-2', 'Bicicleta aro 26', 680, 'veiculos', 'Seminovo', 'Silvestre', 'bicicleta', 95, 12),
  exemplo('meu-3', 'Mesa de jantar 6 lugares', 890, 'casa', 'Usado', 'Santo Antônio', null, 76, 9),
  exemplo('meu-4', 'Sofá 2 lugares', 600, 'casa', 'Usado', 'Nova Viçosa', 'sofa', 64, 8),
  exemplo('meu-5', 'Air fryer 3,5L', 190, 'casa', 'Seminovo', 'Bom Jesus', 'airfryer', 58, 7),
  exemplo('meu-6', 'iPhone 11 64GB', 1500, 'eletronicos', 'Usado', 'Centro', 'iphone', 143, 21),
  exemplo('meu-7', 'Tênis de corrida', 180, 'moda', 'Seminovo', 'Ramos', 'tenis', 41, 5),
  exemplo('meu-8', 'Jaqueta bege', 85, 'moda', 'Usado', 'Silvestre', 'jaqueta', 33, 4),
  exemplo('meu-9', 'Bolsa de couro', 70, 'moda', 'Usado', 'Centro', 'bolsa', 29, 3),
  exemplo('meu-10', 'Óculos de sol', 110, 'moda', 'Seminovo', 'Fátima', 'oculos', 37, 6),
  exemplo('meu-11', 'Camisa social azul', 40, 'moda', 'Usado', 'Betânia', 'camisa-social', 18, 2),
  exemplo('meu-12', 'Vestido midi', 95, 'moda', 'Seminovo', 'Santa Clara', 'vestido', 26, 4),
  exemplo('rascunho-1', 'Mesa de escritório', 250, 'casa', 'Usado', '', 'mesa', 0, 0, {
    status: 'rascunho', descricao: '', cidade: 'Viçosa', atualizadoEm: '2026-11-16T12:00:00.000Z',
  }),
  exemplo('vendido-1', 'Violão Yamaha C40', 520, 'outros', 'Usado', 'Centro', null, 112, 15, {
    status: 'vendido', atualizadoEm: '2026-11-02T12:00:00.000Z',
  }),
];

let cache = null;
const ouvintes = new Set();

function ler() {
  if (cache) return cache;
  try {
    const salvo = localStorage.getItem(CHAVE);
    cache = salvo ? JSON.parse(salvo) : EXEMPLOS;
  } catch {
    cache = EXEMPLOS;
  }
  return cache;
}

function gravar(lista) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch (erro) {
    if (erro?.name === 'QuotaExceededError') {
      throw new Error('O navegador ficou sem espaço para guardar as fotos. Remova algumas e tente de novo.', { cause: erro });
    }
  }
  cache = lista;
  ouvintes.forEach((avisar) => avisar());
}

function assinar(avisar) {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}

export const useMeusAnuncios = () => useSyncExternalStore(assinar, ler);
export const listarMeusAnuncios = () => ler();
export const buscarMeuAnuncio = (id) => ler().find((a) => a.id === id) ?? null;

/** Cria ou atualiza um anúncio e devolve como ficou salvo. */
export function salvarMeuAnuncio(dados, status) {
  const lista = ler();
  const atual = dados.id ? lista.find((a) => a.id === dados.id) : null;
  const salvo = {
    visualizacoes: 0,
    favoritos: 0,
    ...atual,
    ...dados,
    id: atual?.id ?? `anuncio-${Date.now()}`,
    status,
    atualizadoEm: new Date().toISOString(),
  };
  gravar(atual ? lista.map((a) => (a.id === salvo.id ? salvo : a)) : [salvo, ...lista]);
  return salvo;
}

export function marcarComoVendido(id) {
  gravar(ler().map((a) => (a.id === id ? { ...a, status: 'vendido', atualizadoEm: new Date().toISOString() } : a)));
}

export function excluirMeuAnuncio(id) {
  gravar(ler().filter((a) => a.id !== id));
}

/** Regras de preenchimento do anúncio. Devolve { campo: 'mensagem' }. */
export function validarAnuncio(a) {
  const erros = {};
  const titulo = (a.titulo ?? '').trim();
  if (!a.fotos?.length) erros.fotos = 'Adicione pelo menos 1 foto.';
  if (titulo.length < 3) erros.titulo = 'O título precisa ter de 3 a 80 caracteres.';
  if (!a.categoria) erros.categoria = 'Escolha uma categoria.';
  if (a.categoria !== 'servicos' && !a.condicao) erros.condicao = 'Escolha a condição do produto.';
  if (!(Number(a.preco) > 0)) erros.preco = 'Informe um preço maior que zero.';
  if (!a.cidade) erros.cidade = 'Escolha a cidade.';
  if (!a.bairro) erros.bairro = 'Escolha o bairro.';
  if (!a.entrega) erros.entrega = 'Escolha a forma de entrega.';
  return erros;
}

const NOMES_CAMPOS = {
  fotos: 'fotos', titulo: 'título', categoria: 'categoria', condicao: 'condição',
  preco: 'preço', cidade: 'cidade', bairro: 'bairro', entrega: 'entrega',
};

/** O que ainda falta para publicar um rascunho. Ex.: ['bairro', 'fotos'] */
export const camposFaltando = (a) => Object.keys(validarAnuncio(a)).map((c) => NOMES_CAMPOS[c]);
