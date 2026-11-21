// Opções fixas das telas de anúncios. Os anúncios em si vêm da API (services/mercadoApi.js).

export const ORDENACOES = [
  { valor: 'proximos', rotulo: 'Mais próximos' },
  { valor: 'recentes', rotulo: 'Mais recentes' },
  { valor: 'menor_preco', rotulo: 'Menor preço' },
  { valor: 'maior_preco', rotulo: 'Maior preço' },
];

export const CONDICOES = [
  { valor: 'novo', rotulo: 'Novo' },
  { valor: 'seminovo', rotulo: 'Seminovo' },
  { valor: 'usado', rotulo: 'Usado' },
];

export const POR_PAGINA = 12;

export const filtrosVazios = () => ({ precoMin: '', precoMax: '', opcoes: { subcategoria: [], condicao: [] } });

// filtros da tela no formato da API
export const filtrosParaApi = (f) => ({
  subcategoria_id: f.opcoes.subcategoria,
  condicao: f.opcoes.condicao,
  preco_min: f.precoMin,
  preco_max: f.precoMax,
});
