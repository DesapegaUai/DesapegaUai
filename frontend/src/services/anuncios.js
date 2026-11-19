
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
      { id: 'casa-1', titulo: 'Sofá 3 lugares', preco: 780, bairro: 'Centro', foto: fotoSofa, tipo: 'Móveis', condicao: 'Usado' },
      { id: 'casa-2', titulo: 'Guarda-roupa 6 portas', preco: 650, bairro: 'Silvestre', tipo: 'Móveis', condicao: 'Seminovo' },
      { id: 'casa-3', titulo: 'Geladeira Brastemp', preco: 1200, bairro: 'Centro', tipo: 'Eletrodomésticos', condicao: 'Usado' },
      { id: 'casa-4', titulo: 'Mesa de jantar', preco: 480, bairro: 'Nova Viçosa', tipo: 'Móveis', condicao: 'Seminovo' },
      { id: 'casa-5', titulo: 'Air fryer 4L', preco: 260, bairro: 'Bom Jesus', foto: fotoAirfryer, tipo: 'Eletrodomésticos', condicao: 'Seminovo' },
      { id: 'casa-6', titulo: 'Ventilador de teto', preco: 120, bairro: 'Santo Antônio', tipo: 'Eletrodomésticos', condicao: 'Novo' },
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
      { id: 'ele-1', titulo: 'Notebook Dell i5', preco: 1800, bairro: 'Centro', tipo: 'Notebooks', condicao: 'Usado' },
      { id: 'ele-2', titulo: 'iPhone 13 128GB', preco: 2450, bairro: 'Centro', foto: fotoIphone, tipo: 'Celulares', condicao: 'Seminovo' },
      { id: 'ele-3', titulo: 'Fone JBL Tune', preco: 120, bairro: 'Silvestre', tipo: 'Áudio', condicao: 'Seminovo' },
      { id: 'ele-4', titulo: 'Smart TV 43"', preco: 900, bairro: 'Nova Viçosa', tipo: 'TVs', condicao: 'Usado' },
      { id: 'ele-5', titulo: 'Teclado mecânico', preco: 180, bairro: 'Bom Jesus', condicao: 'Novo' },
      { id: 'ele-6', titulo: 'Monitor 24"', preco: 550, bairro: 'Santo Antônio', condicao: 'Seminovo' },
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
      { id: 'mod-1', titulo: 'Tênis Nike Air', preco: 320, bairro: 'Centro', foto: fotoTenis, condicao: 'Seminovo' },
      { id: 'mod-2', titulo: 'Jaqueta bege', preco: 90, bairro: 'Silvestre', foto: fotoJaqueta, tamanho: 'M', condicao: 'Usado' },
      { id: 'mod-3', titulo: 'Vestido de festa', preco: 150, bairro: 'Centro', foto: fotoVestido, tamanho: 'P', condicao: 'Seminovo' },
      { id: 'mod-4', titulo: 'Bolsa de couro', preco: 210, bairro: 'Nova Viçosa', foto: fotoBolsa, condicao: 'Usado' },
      { id: 'mod-5', titulo: 'Camisa social', preco: 45, bairro: 'Bom Jesus', foto: fotoCamisa, tamanho: 'G', condicao: 'Novo' },
      { id: 'mod-6', titulo: 'Óculos Ray-Ban', preco: 280, bairro: 'Santo Antônio', foto: fotoOculos, condicao: 'Seminovo' },
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
      { id: 'vei-1', titulo: 'Honda Biz 125', preco: 8900, bairro: 'Centro', tipo: 'Motos', condicao: 'Usado' },
      { id: 'vei-2', titulo: 'Bicicleta aro 29', preco: 1150, bairro: 'Silvestre', foto: fotoBicicleta, tipo: 'Bicicletas', condicao: 'Seminovo' },
      { id: 'vei-3', titulo: 'Gol G5 1.0', preco: 22500, bairro: 'Nova Viçosa', tipo: 'Carros', condicao: 'Usado' },
      { id: 'vei-4', titulo: 'Patinete elétrico', preco: 1400, bairro: 'Centro', condicao: 'Seminovo' },
      { id: 'vei-5', titulo: 'Capacete LS2', preco: 260, bairro: 'Bom Jesus', tipo: 'Peças', condicao: 'Novo' },
      { id: 'vei-6', titulo: 'Rack de teto', preco: 380, bairro: 'Santo Antônio', tipo: 'Peças', condicao: 'Usado' },
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
      { id: 'liv-1', titulo: 'Cálculo A — Flemming', preco: 60, bairro: 'Centro', tipo: 'Didáticos', condicao: 'Usado' },
      { id: 'liv-2', titulo: 'Coleção Harry Potter', preco: 240, bairro: 'Silvestre', tipo: 'Literatura', condicao: 'Seminovo' },
      { id: 'liv-3', titulo: 'Anatomia Sobotta', preco: 180, bairro: 'Centro', tipo: 'Técnicos', condicao: 'Usado' },
      { id: 'liv-4', titulo: 'Kindle 10ª geração', preco: 320, bairro: 'Nova Viçosa', condicao: 'Seminovo' },
      { id: 'liv-5', titulo: 'Box Senhor dos Anéis', preco: 190, bairro: 'Bom Jesus', tipo: 'Literatura', condicao: 'Novo' },
      { id: 'liv-6', titulo: 'Química Orgânica', preco: 85, bairro: 'Santo Antônio', tipo: 'Didáticos', condicao: 'Usado' },
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
      { id: 'gam-1', titulo: 'PlayStation 4 Slim', preco: 1450, bairro: 'Centro', tipo: 'PlayStation', condicao: 'Usado' },
      { id: 'gam-2', titulo: 'Nintendo Switch', preco: 1900, bairro: 'Silvestre', tipo: 'Nintendo', condicao: 'Seminovo' },
      { id: 'gam-3', titulo: 'Controle DualSense', preco: 320, bairro: 'Centro', tipo: 'PlayStation', condicao: 'Novo' },
      { id: 'gam-4', titulo: 'FIFA 24 PS5', preco: 180, bairro: 'Nova Viçosa', tipo: 'PlayStation', condicao: 'Seminovo' },
      { id: 'gam-5', titulo: 'Headset gamer', preco: 150, bairro: 'Bom Jesus', tipo: 'PC', condicao: 'Usado' },
      { id: 'gam-6', titulo: 'Cadeira gamer', preco: 620, bairro: 'Santo Antônio', tipo: 'PC', condicao: 'Seminovo' },
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
      { id: 'ser-1', titulo: 'Montagem de móveis', preco: 80, bairro: 'Centro', tipo: 'Reparos', cobranca: 'Por serviço' },
      { id: 'ser-2', titulo: 'Aulas de cálculo', preco: 50, unidade: 'hora', bairro: 'Silvestre', tipo: 'Aulas', cobranca: 'Por hora' },
      { id: 'ser-3', titulo: 'Frete pequeno', preco: 60, bairro: 'Centro', tipo: 'Frete', cobranca: 'Por serviço' },
      { id: 'ser-4', titulo: 'Conserto de celular', preco: 90, bairro: 'Nova Viçosa', tipo: 'Reparos', cobranca: 'A combinar' },
      { id: 'ser-5', titulo: 'Faxina residencial', preco: 120, bairro: 'Bom Jesus', tipo: 'Limpeza', cobranca: 'Por serviço' },
      { id: 'ser-6', titulo: 'Instalação de ar', preco: 200, bairro: 'Santo Antônio', tipo: 'Reparos', cobranca: 'Por serviço' },
    ],
  },

  outros: {
    total: 87,
    subcategorias: ['Instrumentos', 'Esportes', 'Pets', 'Bebê'],
    gruposFiltro: [
      { id: 'tipo', titulo: 'Tipo', ligadoAosChips: true },
      { id: 'condicao', titulo: 'Condição', opcoes: CONDICOES },
    ],
    anuncios: [
      { id: 'out-1', titulo: 'Violão Tagima', preco: 420, bairro: 'Centro', tipo: 'Instrumentos', condicao: 'Usado' },
      { id: 'out-2', titulo: 'Prancha de skate', preco: 260, bairro: 'Silvestre', tipo: 'Esportes', condicao: 'Seminovo' },
      { id: 'out-3', titulo: 'Caixa de transporte para cão', preco: 95, bairro: 'Centro', tipo: 'Pets', condicao: 'Usado' },
      { id: 'out-4', titulo: 'Carrinho de bebê', preco: 380, bairro: 'Nova Viçosa', tipo: 'Bebê', condicao: 'Seminovo' },
      { id: 'out-5', titulo: 'Halteres 10kg (par)', preco: 150, bairro: 'Bom Jesus', tipo: 'Esportes', condicao: 'Usado' },
      { id: 'out-6', titulo: 'Barraca de camping 4p', preco: 290, bairro: 'Santo Antônio', tipo: 'Esportes', condicao: 'Novo' },
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

/** Distância aproximada de cada bairro até o centro de Viçosa, em km (filtro "Distância" e "Mais próximos"). */
const DISTANCIA_DO_BAIRRO = { Centro: 0.6, 'Santo Antônio': 1.8, 'Bom Jesus': 2.4, 'Nova Viçosa': 3.2, Silvestre: 5.5 };

const temRestricao = (f) => Boolean(f.precoMin || f.precoMax || f.distancia !== DISTANCIA.padrao
  || Object.values(f.opcoes).some((marcadas) => marcadas.length));

function ordenar(lista, ordem) {
  const copia = [...lista];
  if (ordem === 'menor-preco') copia.sort((a, b) => a.preco - b.preco);
  if (ordem === 'maior-preco') copia.sort((a, b) => b.preco - a.preco);
  if (ordem === 'proximos') copia.sort((a, b) => a.distancia - b.distancia);
  return copia;
}

/**
 * Lista os anúncios de uma categoria.
 * HOJE: filtra e ordena os anúncios de exemplo no navegador. Sem filtro aplicado, mostra o total
 * do protótipo (ex.: 312 anúncios). Com filtro, mostra só os anúncios de exemplo que combinam.
 * DEPOIS: trocar por fetch(`/api/anuncios?categoria=${slug}&pagina=${pagina}&ordem=${ordem}&...`).
 */
export function listarAnuncios(slug, { pagina = 1, ordem = 'recentes', filtros = null, cidade = 'Viçosa' } = {}) {
  const dados = PAGINAS_CATEGORIA[slug];
  const todos = dados.anuncios.map((a) => ({ ...a, cidade: 'Viçosa', distancia: DISTANCIA_DO_BAIRRO[a.bairro] ?? 1 }));

  if (cidade === 'Viçosa' && !(filtros && temRestricao(filtros))) {
    return {
      anuncios: ordenar(todos, ordem),
      total: dados.total,
      pagina,
      totalPaginas: Math.max(1, Math.ceil(dados.total / POR_PAGINA)),
    };
  }

  const min = Number(filtros?.precoMin) || 0;
  const max = Number(filtros?.precoMax) || Infinity;
  const achados = todos.filter((a) => a.cidade === cidade && (!filtros || (
    a.preco >= min && a.preco <= max && a.distancia <= filtros.distancia
    && Object.entries(filtros.opcoes).every(([grupo, marcadas]) => !marcadas.length || marcadas.includes(a[grupo]))
  )));
  const totalPaginas = Math.max(1, Math.ceil(achados.length / POR_PAGINA));
  const atual = Math.min(pagina, totalPaginas);
  return {
    anuncios: ordenar(achados, ordem).slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA),
    total: achados.length,
    pagina: atual,
    totalPaginas,
  };
}
