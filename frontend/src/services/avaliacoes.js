import { useEffect, useSyncExternalStore } from 'react';
import { api, urlDaApi } from './api.js';
import { ouvir, quandoReconectar } from './tempoReal.js';

const CHAVE_ANTIGA = 'desapegauai.avaliacoes.v1';

try {
  localStorage.removeItem(CHAVE_ANTIGA);
} catch {
  // Avaliações agora vêm da API; o armazenamento antigo era apenas local.
}

export const ROTULOS_NOTA = ['', 'Ruim', 'Regular', 'Boa', 'Muito boa', 'Excelente'];

// Pontos fortes que quem comprou pode marcar junto com as estrelas (os mesmos valores do servidor)
export const QUALIDADES = [
  { valor: 'respondeu_rapido', rotulo: 'Respondeu rápido' },
  { valor: 'como_anunciado', rotulo: 'Produto como anunciado' },
  { valor: 'pontual', rotulo: 'Pontual no encontro' },
  { valor: 'educado', rotulo: 'Educado e atencioso' },
  { valor: 'negociacao_facil', rotulo: 'Negociação fácil' },
];
export const rotuloDaQualidade = (valor) => QUALIDADES.find((q) => q.valor === valor)?.rotulo ?? valor;

const ouvintes = new Set();
const usuariosSolicitados = new Set();
let cache = [];
let minhasSolicitadas = false;
let usuarioAtualId = null;

function avisar() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

function normalizar(avaliacao) {
  const data = avaliacao.criado_em ? new Date(avaliacao.criado_em) : null;
  return {
    id: Number(avaliacao.id),
    conversa: avaliacao.conversa_id == null ? null : Number(avaliacao.conversa_id),
    avaliado_id: Number(avaliacao.avaliado_id),
    autor: avaliacao.avaliador_nome,
    autorId: avaliacao.avaliador_id == null ? null : Number(avaliacao.avaliador_id),
    autorFoto: urlDaApi(avaliacao.avaliador_foto),
    anuncio: avaliacao.anuncio_titulo,
    nota: Number(avaliacao.nota),
    qualidades: Array.isArray(avaliacao.qualidades) ? avaliacao.qualidades : [],
    comentario: avaliacao.comentario ?? '',
    minha: Boolean(avaliacao.minha),
    quando: data && !Number.isNaN(data.getTime())
      ? new Intl.DateTimeFormat('pt-BR').format(data)
      : '',
  };
}

function adicionar(avaliacoes) {
  const porId = new Map(cache.map((avaliacao) => [avaliacao.id, avaliacao]));
  avaliacoes.forEach((avaliacao) => {
    const normalizada = normalizar(avaliacao);
    const anterior = porId.get(normalizada.id);
    porId.set(normalizada.id, {
      ...anterior,
      ...normalizada,
      minha: normalizada.minha || anterior?.minha || false,
    });
  });
  cache = [...porId.values()].sort((a, b) => b.id - a.id);
  avisar();
}

function recarregarDepoisDeReconectar() {
  if (minhasSolicitadas) carregarMinhasAvaliacoes().catch(() => {});
  usuariosSolicitados.forEach((usuarioId) => carregarAvaliacoesUsuario(usuarioId).catch(() => {}));
}

function assinar(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

// quem avaliou mudou o nome ou a foto: as avaliações dessa pessoa mostram o novo na hora
function trocarAutor({ id, nome, foto_url: foto }) {
  if (!cache.some((avaliacao) => avaliacao.autorId === Number(id))) return;
  cache = cache.map((avaliacao) => (avaliacao.autorId === Number(id) ? { ...avaliacao, autor: nome, autorFoto: urlDaApi(foto) } : avaliacao));
  avisar();
}

function ler() {
  return cache;
}

// avaliações em tempo real pela conexão única do site (services/tempoReal.js)
export function useAvaliacoes() {
  const avaliacoes = useSyncExternalStore(assinar, ler);
  useEffect(() => {
    const pararNova = ouvir('nova_avaliacao', (avaliacao) => adicionar([avaliacao]));
    const pararPerfil = ouvir('perfil_atualizado', trocarAutor);
    const pararReconexao = quandoReconectar(recarregarDepoisDeReconectar);
    return () => { pararNova(); pararPerfil(); pararReconexao(); };
  }, []);
  return avaliacoes;
}

export async function carregarMinhasAvaliacoes() {
  minhasSolicitadas = true;
  const resultado = await api.get('/avaliacoes/minhas');
  const usuarioId = Number(resultado.usuario_id);
  if (usuarioAtualId !== null && usuarioAtualId !== usuarioId) {
    cache = [];
    avisar();
  }
  usuarioAtualId = usuarioId;
  adicionar([
    ...(resultado.recebidas ?? []).map((avaliacao) => ({ ...avaliacao, minha: false })),
    ...(resultado.feitas ?? []).map((avaliacao) => ({ ...avaliacao, minha: true })),
  ]);
  return resultado;
}

export async function carregarAvaliacoesUsuario(usuarioId) {
  const id = Number(usuarioId);
  if (!Number.isSafeInteger(id) || id < 1) return { avaliacoes: [] };
  usuariosSolicitados.add(id);
  const resultado = await api.get(`/avaliacoes/usuarios/${id}`);
  adicionar(resultado.avaliacoes ?? []);
  return resultado;
}

export async function avaliar({ conversa, nota, qualidades = [], comentario }) {
  const resultado = await api.post(`/avaliacoes/conversas/${conversa}`, { nota, qualidades, comentario });
  adicionar([resultado.avaliacao]);
  minhasSolicitadas = true;
  return resultado.avaliacao;
}

export const daConversa = (lista, conversa) => (
  lista.find((avaliacao) => avaliacao.minha && String(avaliacao.conversa) === String(conversa)) ?? null
);

export function resumoDe(lista, avaliadoId) {
  const id = Number(avaliadoId);
  const recebidas = Number.isSafeInteger(id)
    ? lista.filter((avaliacao) => Number(avaliacao.avaliado_id) === id)
    : [];
  const qtd = recebidas.length;
  const media = qtd ? Math.round((recebidas.reduce((total, avaliacao) => total + avaliacao.nota, 0) / qtd) * 10) / 10 : 0;
  return { media, qtd, lista: recebidas };
}

export function reputacao({ media, qtd }) {
  if (!qtd) return 'Novo por aqui';
  if (media >= 4.5) return 'Ótimo';
  if (media >= 4) return 'Muito bom';
  if (media >= 3) return 'Bom';
  return 'Regular';
}

export const textoDaMedia = (media) => media.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
