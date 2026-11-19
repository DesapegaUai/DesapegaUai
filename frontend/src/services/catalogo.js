import { ACHADOS } from './achados.js';
import { PAGINAS_CATEGORIA } from './anuncios.js';
import { buscarCategoria } from './categorias.js';
import { CONVERSAS } from './conversas.js';
import { FAVORITOS } from './favoritos.js';
import { ENTREGAS, listarMeusAnuncios } from './meusAnuncios.js';

// Junta todos os anúncios de exemplo para as telas de detalhes e de busca.
// DEPOIS: trocar por GET /api/anuncios/:id e GET /api/anuncios?busca=...

const VENDEDORES = ['Rafael Lima', 'Juliana Prado', 'Marcos Vinícius', 'Carla Bittencourt', 'Diego Rocha', 'Lorena Castro'];
const CONDICOES = ['Seminovo', 'Usado', 'Novo'];

const numeroDoId = (id) => [...id].reduce((soma, letra) => soma + letra.charCodeAt(0), 0);
const iniciais = (nome) => nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();

function deExemplo(anuncio, categoria) {
  const n = numeroDoId(anuncio.id);
  const conversa = CONVERSAS.find((c) => c.anuncio.id === anuncio.id);
  const nome = conversa?.nome ?? VENDEDORES[n % VENDEDORES.length];
  return {
    ...anuncio,
    categoria,
    cidade: 'Viçosa',
    bairro: anuncio.bairro ?? 'Centro',
    condicao: categoria === 'servicos' ? null : anuncio.condicao ?? CONDICOES[n % CONDICOES.length],
    descricao: `${anuncio.titulo} em bom estado, pronto para usar. Combine os detalhes e a retirada pelo chat.`,
    entrega: n % 2 ? 'retirada' : 'combinar',
    fotos: anuncio.foto ? [anuncio.foto] : [],
    vendedor: { nome, iniciais: iniciais(nome), desde: `${2022 + (n % 4)}` },
    status: conversa?.anuncio.vendido ? 'vendido' : 'ativo',
    meu: false,
  };
}

const deMeusAnuncios = (a) => ({
  ...a,
  foto: a.fotos[0],
  vendedor: { nome: 'Você', iniciais: 'AB', desde: '2023' },
  meu: true,
});

function exemplos() {
  const porCategoria = Object.entries(PAGINAS_CATEGORIA).flatMap(([slug, pagina]) =>
    pagina.anuncios.map((a) => deExemplo(a, slug)));
  const daHome = ACHADOS.map((a) => deExemplo({ id: `home-${a.id}`, titulo: a.titulo, preco: a.preco, bairro: a.local.split(',')[0], foto: a.foto }, a.categoria));
  return [...porCategoria, ...FAVORITOS.map((f) => deExemplo(f, f.categoria)), ...daHome];
}

export function buscarAnuncio(id) {
  const meu = listarMeusAnuncios().find((a) => a.id === id && a.status !== 'rascunho');
  if (meu) return deMeusAnuncios(meu);
  return exemplos().find((a) => a.id === id) ?? null;
}

export const anunciosParecidos = (anuncio, limite = 3) =>
  exemplos().filter((a) => a.categoria === anuncio.categoria && a.id !== anuncio.id && !/^(fav|home)-/.test(a.id)).slice(0, limite);

const simplificar = (texto) => texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Procura no título e na descrição, sem diferenciar acentos e maiúsculas. */
export function pesquisarAnuncios(termo, ordem = 'recentes', cidade = 'Viçosa') {
  const busca = simplificar(termo.trim());
  const publicados = listarMeusAnuncios().filter((a) => a.status === 'ativo').map(deMeusAnuncios);
  const achados = [...exemplos().filter((a) => !/^(fav|home)-/.test(a.id)), ...publicados]
    .filter((a) => a.cidade === cidade && simplificar(`${a.titulo} ${a.descricao}`).includes(busca));
  if (ordem === 'menor-preco') return [...achados].sort((a, b) => a.preco - b.preco);
  if (ordem === 'maior-preco') return [...achados].sort((a, b) => b.preco - a.preco);
  return achados;
}

export const nomeDaCategoria = (slug) => buscarCategoria(slug)?.nome ?? 'Anúncios';
export const textoDaEntrega = (entrega) => ENTREGAS[entrega]?.titulo ?? '';
