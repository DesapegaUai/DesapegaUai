// Perfil da conta logada, mantido em cache local e sincronizado com a API.

import { useSyncExternalStore } from 'react';
import { api } from './api.js';

export const USUARIO = {
  nome: '',
  email: '',
  foto_url: null,
  telefone: '',
  usuario: '',
  iniciais: '',
  bio: '', // vazio → mostra o convite "Adicione uma bio"
  membroDesde: 'Não disponível',
  membroDesdeExtenso: 'Não disponível',
  ultimoAcesso: 'Não disponível',
  total_favoritos: null,
  total_conversas: null,
};

export const NUMEROS = [
  { icone: 'sacola', rotulo: 'Anúncios ativos', para: '/meus-anuncios' },
  { icone: 'favorito', rotulo: 'Favoritos', para: '/favoritos' },
  { icone: 'mensagens', rotulo: 'Conversas', para: '/conversas' },
  { icone: 'estrela', rotulo: 'Avaliação', para: '#avaliacoes' },
];

export const LINKS_CONTA = [
  { icone: 'perfil', titulo: 'Informações pessoais', descricao: 'Nome, e-mail, telefone e mais', para: '/perfil/editar' },
  { icone: 'cadeado', titulo: 'Privacidade', descricao: 'Seus dados e exclusão da conta' },
  { icone: 'sino', titulo: 'Notificações', descricao: 'Preferências de alertas' },
  { icone: 'verificado', titulo: 'Verificação de conta', descricao: 'Selo de vínculo acadêmico' },
  { icone: 'local', titulo: 'Endereços', descricao: 'Gerencie seus endereços' },
  { icone: 'ajuda', titulo: 'Ajuda e suporte', descricao: 'Dúvidas frequentes', para: '/ajuda/perguntas-frequentes' },
];

// Perfil em memória (não fica guardado no navegador: tem e-mail e telefone).
try {
  localStorage.removeItem('desapegauai.perfil.v1');
} catch {
  // sem armazenamento: nada para limpar
}
const ouvintes = new Set();
let perfilAtual = null;

const comIniciais = (dados) => ({
  ...USUARIO,
  ...dados,
  iniciais: (dados.nome || USUARIO.nome).split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase(),
});

function formatarData(valor, opcoes, padrao) {
  if (!valor) return padrao;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? padrao : new Intl.DateTimeFormat('pt-BR', opcoes).format(data);
}

function mapearPerfil(dados) {
  const fotoUrl = dados.foto_url?.startsWith('/api/')
    ? `${import.meta.env.VITE_API_URL ?? ''}${dados.foto_url}`
    : dados.foto_url;

  return comIniciais({
    ...dados,
    foto_url: fotoUrl,
    usuario: dados.email ? `@${dados.email.split('@')[0]}` : USUARIO.usuario,
    membroDesde: formatarData(dados.criado_em, { month: 'short', year: 'numeric' }, 'Não disponível'),
    membroDesdeExtenso: formatarData(dados.criado_em, { month: 'long', year: 'numeric' }, 'Não disponível'),
    ultimoAcesso: formatarData(dados.ultimo_acesso, { dateStyle: 'short', timeStyle: 'short' }, 'Não disponível'),
    total_favoritos: contar(dados.total_favoritos),
    total_conversas: contar(dados.total_conversas),
  });
}

function contar(valor) {
  if (valor === undefined || valor === null || !Number.isFinite(Number(valor))) return null;
  return Number(valor);
}

function guardarPerfil(dados) {
  perfilAtual = mapearPerfil(dados);
  ouvintes.forEach((avisar) => avisar());
  return perfilAtual;
}

function lerPerfil() {
  perfilAtual ??= comIniciais({});
  return perfilAtual;
}

function assinarPerfil(avisar) {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}

export const usePerfil = () => useSyncExternalStore(assinarPerfil, lerPerfil);

// dois pedidos ao mesmo tempo (a moldura e a tela de Perfil) viram um só
let pedidoDoPerfil = null;
export function carregarPerfil() {
  pedidoDoPerfil ??= api.get('/perfil').then(guardarPerfil).finally(() => { pedidoDoPerfil = null; });
  return pedidoDoPerfil;
}

export async function salvarPerfil(dados) {
  return guardarPerfil(await api.put('/perfil', dados));
}

export async function atualizarFotoPerfil(arquivo) {
  const formulario = new FormData();
  formulario.append('foto', arquivo);
  return guardarPerfil(await api.put('/perfil/foto', formulario));
}

// exclui a conta, os anúncios, as conversas e as fotos; a API apaga o cookie de login
export const excluirConta = () => api.delete('/perfil', { confirmar: 'EXCLUIR' });

export async function removerFotoPerfil() {
  return guardarPerfil(await api.delete('/perfil/foto'));
}

window.addEventListener('desapegauai:logout', () => {
  perfilAtual = comIniciais({});
  ouvintes.forEach((avisar) => avisar());
});
