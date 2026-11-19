// As 8 categorias do DesapegaUai, na ordem das abas (03-arquitetura-da-informacao).

export const CATEGORIAS = [
  { slug: 'casa', nome: 'Casa', icone: 'casa' },
  { slug: 'eletronicos', nome: 'Eletrônicos', icone: 'eletronicos' },
  { slug: 'moda', nome: 'Moda', icone: 'moda' },
  { slug: 'veiculos', nome: 'Veículos', icone: 'veiculos' },
  { slug: 'livros', nome: 'Livros', icone: 'livros' },
  { slug: 'games', nome: 'Games', icone: 'games' },
  { slug: 'servicos', nome: 'Serviços', icone: 'servicos' },
  { slug: 'outros', nome: 'Outros', icone: 'outros' },
];

export const caminhoCategoria = (slug) => `/categoria/${slug}`;

export const buscarCategoria = (slug) => CATEGORIAS.find((c) => c.slug === slug);
