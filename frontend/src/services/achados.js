// Anúncios de exemplo do bloco "Achados perto de você" da página inicial.
// Quando a busca da API estiver pronta, esta lista vem do back-end.

export const ACHADOS = [
  { id: 1, titulo: 'iPhone 13 128GB', preco: 2450, local: 'Centro, Viçosa', foto: '/img/fotos/iphone.webp', categoria: 'eletronicos' },
  { id: 2, titulo: 'Bicicleta Aro 29', preco: 850, local: 'Silvestre, Viçosa', foto: '/img/fotos/bicicleta.webp', categoria: 'veiculos' },
  { id: 3, titulo: 'Mesa de escritório', preco: 250, local: 'Santo Antônio, Viçosa', foto: '/img/fotos/mesa.webp', categoria: 'casa' },
  { id: 4, titulo: 'Sofá 2 lugares', preco: 600, local: 'Nova Viçosa, Viçosa', foto: '/img/fotos/sofa.webp', categoria: 'casa' },
  { id: 5, titulo: 'Air Fryer Mondial', preco: 180, local: 'Bom Jesus, Viçosa', foto: '/img/fotos/airfryer.webp', categoria: 'casa' },
];

export const linkDoAchado = (achado) => `/anuncio/home-${achado.id}`;
