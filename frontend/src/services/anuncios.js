
const fotoSofa = '/img/fotos/sofa.webp';
const fotoAirfryer = '/img/fotos/airfryer.webp';
const fotoIphone = '/img/fotos/iphone.webp';
const fotoBicicleta = '/img/fotos/bicicleta.webp';
const fotoTenis = '/img/fotos/tenis.webp';
const fotoJaqueta = '/img/fotos/jaqueta.webp';
const fotoVestido = '/img/fotos/vestido.webp';
const fotoBolsa = '/img/fotos/bolsa.webp';
const fotoCamisa = '/img/fotos/camisa-social.webp';
const fotoOculos = '/img/fotos/oculos.webp';
// Dados de exemplo das telas de categoria (copiados dos protótipos 01 a 07).
// Moda (03): dados e fotos vieram da tela de Moda feita à parte (pacote DesapegaUai-Moda).
// Quando o back-end estiver pronto, troque o corpo de `listarAnuncios` por uma chamada à API
// e mantenha o mesmo formato de retorno — as telas não precisam mudar.


export const BAIRROS = ['Centro', 'Silvestre', 'Santo Antônio', 'Nova Viçosa', 'Bom Jesus'];
const CONDICOES = ['Novo', 'Seminovo', 'Usado'];

/** Distância em km. O protótipo mostra "até 11 km" com a alça em 55% (0–20). */
export const DISTANCIA = { min: 0, max: 20, padrao: 11 };

export const ORDENACOES = [
  { valor: 'recentes', rotulo: 'Mais recentes' },
  { valor: 'menor-preco', rotulo: 'Menor preço' },
  { valor: 'maior-preco', rotulo: 'Maior preço' },
  { valor: 'proximos', rotulo: 'Mais próximos' },
];

export const POR_PAGINA = 6;

/**
 * Conteúdo de cada tela.
 * - total: número exibido em "312 anúncios em Viçosa e região"
 * - subcategorias: chips acima da grade (e o 1º grupo de filtros, sincronizado com os chips)
 * - gruposFiltro: grupos de caixas de seleção entre "Preço" e "Bairro", na ordem do protótipo
 */
export const PAGINAS_CATEGORIA = {
  casa: {
    total: 312,
    subcategorias: ['Móveis', 'Eletrodomésticos', 'Decoração', 'Utensílios'],
    gruposFiltro: [
      { id: 'tipo', titulo: 'Tipo', ligadoAosChips: true },
      { id: 'condicao', titulo: 'Condição', opcoes: CONDICOES },
    ],
    anuncios: [
      { id: 'casa-1', titulo: 'Sofá 3 lugares', preco: 780, bairro: 'Centro', foto: fotoSofa },
      { id: 'casa-2', titulo: 'Guarda-roupa 6 portas', preco: 650, bairro: 'Silvestre' },
      { id: 'casa-3', titulo: 'Geladeira Brastemp', preco: 1200, bairro: 'Centro' },
      { id: 'casa-4', titulo: 'Mesa de jantar', preco: 480, bairro: 'Nova Viçosa' },
      { id: 'casa-5', titulo: 'Air fryer 4L', preco: 260, bairro: 'Bom Jesus', foto: fotoAirfryer },
      { id: 'casa-6', titulo: 'Ventilador de teto', preco: 120, bairro: 'Santo Antônio' },
    ],
  },

  eletronicos: {
    total: 128,
    subcategorias: ['Celulares', 'Notebooks', 'Áudio', 'TVs'],
    gruposFiltro: [
      { id: 'tipo', titulo: 'Tipo', ligadoAosChips: true },
      { id: 'condicao', titulo: 'Condição', opcoes: CONDICOES },
    ],
    anuncios: [
      { id: 'ele-1', titulo: 'Notebook Dell i5', preco: 1800, bairro: 'Centro' },
      { id: 'ele-2', titulo: 'iPhone 13 128GB', preco: 2450, bairro: 'Centro', foto: fotoIphone },
      { id: 'ele-3', titulo: 'Fone JBL Tune', preco: 120, bairro: 'Silvestre' },
      { id: 'ele-4', titulo: 'Smart TV 43"', preco: 900, bairro: 'Nova Viçosa' },
      { id: 'ele-5', titulo: 'Teclado mecânico', preco: 180, bairro: 'Bom Jesus' },
      { id: 'ele-6', titulo: 'Monitor 24"', preco: 550, bairro: 'Santo Antônio' },
    ],
  },

  moda: {
    total: 246,
    subcategorias: ['P', 'M', 'G', 'GG'],
    gruposFiltro: [
      { id: 'tamanho', titulo: 'Tamanho', ligadoAosChips: true },
      { id: 'condicao', titulo: 'Condição', opcoes: CONDICOES },
    ],
    anuncios: [
      { id: 'mod-1', titulo: 'Tênis Nike Air', preco: 320, bairro: 'Centro', foto: fotoTenis },
      { id: 'mod-2', titulo: 'Jaqueta bege', preco: 90, bairro: 'Silvestre', foto: fotoJaqueta },
      { id: 'mod-3', titulo: 'Vestido de festa', preco: 150, bairro: 'Centro', foto: fotoVestido },
      { id: 'mod-4', titulo: 'Bolsa de couro', preco: 210, bairro: 'Nova Viçosa', foto: fotoBolsa },
      { id: 'mod-5', titulo: 'Camisa social', preco: 45, bairro: 'Bom Jesus', foto: fotoCamisa },
      { id: 'mod-6', titulo: 'Óculos Ray-Ban', preco: 280, bairro: 'Santo Antônio', foto: fotoOculos },
    ],
  },

  veiculos: {
    total: 74,
    subcategorias: ['Carros', 'Motos', 'Bicicletas', 'Peças'],
    gruposFiltro: [
      { id: 'tipo', titulo: 'Tipo', ligadoAosChips: true },
      { id: 'condicao', titulo: 'Condição', opcoes: CONDICOES },
    ],
    anuncios: [
      { id: 'vei-1', titulo: 'Honda Biz 125', preco: 8900, bairro: 'Centro' },
      { id: 'vei-2', titulo: 'Bicicleta aro 29', preco: 1150, bairro: 'Silvestre', foto: fotoBicicleta },
      { id: 'vei-3', titulo: 'Gol G5 1.0', preco: 22500, bairro: 'Nova Viçosa' },
      { id: 'vei-4', titulo: 'Patinete elétrico', preco: 1400, bairro: 'Centro' },
      { id: 'vei-5', titulo: 'Capacete LS2', preco: 260, bairro: 'Bom Jesus' },
      { id: 'vei-6', titulo: 'Rack de teto', preco: 380, bairro: 'Santo Antônio' },
    ],
  },

  livros: {
    total: 189,
    subcategorias: ['Didáticos', 'Literatura', 'HQs', 'Técnicos'],
    gruposFiltro: [
      { id: 'tipo', titulo: 'Gênero', ligadoAosChips: true },
      { id: 'condicao', titulo: 'Condição', opcoes: CONDICOES },
    ],
    anuncios: [
      { id: 'liv-1', titulo: 'Cálculo A — Flemming', preco: 60, bairro: 'Centro' },
      { id: 'liv-2', titulo: 'Coleção Harry Potter', preco: 240, bairro: 'Silvestre' },
      { id: 'liv-3', titulo: 'Anatomia Sobotta', preco: 180, bairro: 'Centro' },
      { id: 'liv-4', titulo: 'Kindle 10ª geração', preco: 320, bairro: 'Nova Viçosa' },
      { id: 'liv-5', titulo: 'Box Senhor dos Anéis', preco: 190, bairro: 'Bom Jesus' },
      { id: 'liv-6', titulo: 'Química Orgânica', preco: 85, bairro: 'Santo Antônio' },
    ],
  },

  games: {
    total: 96,
    subcategorias: ['PlayStation', 'Xbox', 'Nintendo', 'PC'],
    gruposFiltro: [
      { id: 'tipo', titulo: 'Plataforma', ligadoAosChips: true },
      { id: 'condicao', titulo: 'Condição', opcoes: CONDICOES },
    ],
    anuncios: [
      { id: 'gam-1', titulo: 'PlayStation 4 Slim', preco: 1450, bairro: 'Centro' },
      { id: 'gam-2', titulo: 'Nintendo Switch', preco: 1900, bairro: 'Silvestre' },
      { id: 'gam-3', titulo: 'Controle DualSense', preco: 320, bairro: 'Centro' },
      { id: 'gam-4', titulo: 'FIFA 24 PS5', preco: 180, bairro: 'Nova Viçosa' },
      { id: 'gam-5', titulo: 'Headset gamer', preco: 150, bairro: 'Bom Jesus' },
      { id: 'gam-6', titulo: 'Cadeira gamer', preco: 620, bairro: 'Santo Antônio' },
    ],
  },

  servicos: {
    // ATENÇÃO: no protótipo 07-servicos o contador veio vazio. 58 é provisório — confirmar com o design.
    total: 58,
    subcategorias: ['Reparos', 'Aulas', 'Frete', 'Limpeza'],
    gruposFiltro: [
      // ATENÇÃO: no protótipo o grupo "Valor" veio sem opções. Estas são provisórias — confirmar com o design.
      { id: 'cobranca', titulo: 'Valor', opcoes: ['Por hora', 'Por serviço', 'A combinar'] },
      { id: 'tipo', titulo: 'Tipo de serviço', ligadoAosChips: true },
    ],
    anuncios: [
      { id: 'ser-1', titulo: 'Montagem de móveis', preco: 80, bairro: 'Centro' },
      { id: 'ser-2', titulo: 'Aulas de cálculo', preco: 50, unidade: 'hora', bairro: 'Silvestre' },
      { id: 'ser-3', titulo: 'Frete pequeno', preco: 60, bairro: 'Centro' },
      { id: 'ser-4', titulo: 'Conserto de celular', preco: 90, bairro: 'Nova Viçosa' },
      { id: 'ser-5', titulo: 'Faxina residencial', preco: 120, bairro: 'Bom Jesus' },
      { id: 'ser-6', titulo: 'Instalação de ar', preco: 200, bairro: 'Santo Antônio' },
    ],
  },
};

/** Estado inicial dos filtros de uma categoria (o 1º chip vem marcado, como no protótipo). */
export function filtrosIniciais(slug) {
  const pagina = PAGINAS_CATEGORIA[slug];
  const opcoes = { bairro: [] };
  pagina.gruposFiltro.forEach((g) => {
    opcoes[g.id] = g.ligadoAosChips ? [pagina.subcategorias[0]] : [];
  });
  return { precoMin: '', precoMax: '', opcoes, distancia: DISTANCIA.padrao };
}

/** Filtros zerados (botão "Limpar"). */
export function filtrosLimpos(slug) {
  const pagina = PAGINAS_CATEGORIA[slug];
  const opcoes = { bairro: [] };
  pagina.gruposFiltro.forEach((g) => { opcoes[g.id] = []; });
  return { precoMin: '', precoMax: '', opcoes, distancia: DISTANCIA.padrao };
}

/**
 * Lista os anúncios de uma categoria.
 * HOJE: devolve os dados de exemplo (não filtra nem ordena).
 * DEPOIS: trocar por fetch(`/api/anuncios?categoria=${slug}&pagina=${pagina}&ordem=${ordem}&...`).
 */
export function listarAnuncios(slug, { pagina = 1, ordem = 'recentes', filtros } = {}) {
  void ordem; void filtros; // serão enviados para a API
  const dados = PAGINAS_CATEGORIA[slug];
  return {
    anuncios: dados.anuncios.map((a) => ({ ...a, cidade: 'Viçosa' })),
    total: dados.total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(dados.total / POR_PAGINA)),
  };
}
