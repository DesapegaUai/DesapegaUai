
const fotoSofa = '/img/fotos/sofa.webp';
const fotoIphone = '/img/fotos/iphone.webp';
const fotoBicicleta = '/img/fotos/bicicleta.webp';
const fotoAirfryer = '/img/fotos/airfryer.webp';
// Favoritos de exemplo (protótipo 09-favoritos: os 8 primeiros são os da página 1).
// Os números da tela (salvos, listas, páginas) são calculados a partir desta lista.


// recente = aparece em "Salvos recentemente" · alerta = está em "Alertas de preço"
export const FAVORITOS = [
  { id: 'fav-1', titulo: 'Sofá 3 lugares', preco: 780, categoria: 'casa', foto: fotoSofa, recente: true },
  { id: 'fav-2', titulo: 'iPhone 13 128GB', preco: 2100, categoria: 'eletronicos', foto: fotoIphone, recente: true, alerta: true },
  { id: 'fav-3', titulo: 'Vestido longo verde', preco: 120, categoria: 'moda', recente: true },
  { id: 'fav-4', titulo: 'Bicicleta aro 29', preco: 1250, categoria: 'veiculos', foto: fotoBicicleta, recente: true, alerta: true },
  { id: 'fav-5', titulo: 'Livro Código Limpo', preco: 95, categoria: 'livros', recente: true },
  { id: 'fav-6', titulo: 'Controle PS5', preco: 250, categoria: 'games', recente: true },
  { id: 'fav-7', titulo: 'Air fryer 4L', preco: 200, categoria: 'casa', foto: fotoAirfryer, recente: true },
  { id: 'fav-8', titulo: 'Serviço de manicure', preco: 60, categoria: 'servicos' },
  { id: 'fav-9', titulo: 'Guarda-roupa 6 portas', preco: 650, categoria: 'casa' },
  { id: 'fav-10', titulo: 'Notebook Dell i5', preco: 1800, categoria: 'eletronicos', alerta: true },
  { id: 'fav-11', titulo: 'Honda Biz 125', preco: 8900, categoria: 'veiculos' },
  { id: 'fav-12', titulo: 'Coleção Harry Potter', preco: 240, categoria: 'livros' },
  { id: 'fav-13', titulo: 'Nintendo Switch', preco: 1900, categoria: 'games' },
  { id: 'fav-14', titulo: 'Smart TV 43"', preco: 900, categoria: 'eletronicos' },
  { id: 'fav-15', titulo: 'Jaqueta jeans', preco: 90, categoria: 'moda' },
  { id: 'fav-16', titulo: 'Mesa de jantar', preco: 480, categoria: 'casa' },
].map((f) => ({ ...f, local: 'Viçosa, MG' }));

export const LISTAS = [
  { id: 'todos', nome: 'Todos favoritos', icone: 'favorito', filtro: () => true },
  { id: 'recentes', nome: 'Salvos recentemente', icone: 'relogio', filtro: (f) => f.recente },
  { id: 'alertas', nome: 'Alertas de preço', icone: 'sino', filtro: (f) => f.alerta },
];

export const ORDENACOES_FAVORITOS = [
  { valor: 'recentes', rotulo: 'Salvos recentemente' },
  { valor: 'menor-preco', rotulo: 'Menor preço' },
  { valor: 'maior-preco', rotulo: 'Maior preço' },
];

export const FAVORITOS_POR_PAGINA = 8;
