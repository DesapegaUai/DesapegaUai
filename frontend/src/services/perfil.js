// Perfil de exemplo (protótipo 11-perfil). Trocar pelos dados do usuário logado (API).

import { useSyncExternalStore } from 'react';
import { FAVORITOS } from './favoritos.js';
import { CONVERSAS, NAO_LIDAS_TOTAL } from './conversas.js';

export const USUARIO = {
  nome: 'Ana Beatriz Moreira',
  email: 'ana.beatriz@exemplo.com',
  telefone: '',
  usuario: '@anabeatriz',
  iniciais: 'AB',
  bio: '', // vazio → mostra o convite "Adicione uma bio"
  membroDesde: 'mai/2023',
  membroDesdeExtenso: 'Maio de 2023',
  ultimoAcesso: 'Hoje, 09:41',
  anunciosAtivos: 12,
};

export const NUMEROS = [
  { icone: 'sacola', valor: USUARIO.anunciosAtivos, rotulo: 'Anúncios ativos' },
  { icone: 'favorito', valor: FAVORITOS.length, rotulo: 'Favoritos' },
  { icone: 'mensagens', valor: CONVERSAS.length, rotulo: 'Conversas' },
  { icone: 'estrela', valor: '—', rotulo: 'Avaliação' }, // o Perfil troca pela média de services/avaliacoes.js
];

export const LINKS_CONTA = [
  { icone: 'perfil', titulo: 'Informações pessoais', descricao: 'Nome, e-mail, telefone e mais', para: '/perfil/editar' },
  { icone: 'cadeado', titulo: 'Privacidade', descricao: 'Quem pode ver seu perfil e anúncios' },
  { icone: 'sino', titulo: 'Notificações', descricao: 'Preferências de alertas' },
  { icone: 'verificado', titulo: 'Verificação de conta', descricao: 'CPF/CNPJ e segurança' },
  { icone: 'local', titulo: 'Endereços', descricao: 'Gerencie seus endereços' },
  { icone: 'ajuda', titulo: 'Ajuda e suporte', descricao: 'Dúvidas frequentes', para: '/ajuda/perguntas-frequentes' },
];

export const ACOES_RAPIDAS = [
  { icone: 'mais', rotulo: 'Publicar um novo anúncio', para: '/anunciar' },
  { icone: 'etiqueta', rotulo: 'Ver meus anúncios', para: '/meus-anuncios' },
  { icone: 'favorito', rotulo: 'Ver favoritos', para: '/favoritos' },
  { icone: 'mensagens', rotulo: 'Mensagens', para: '/conversas', contador: NAO_LIDAS_TOTAL },
  { icone: 'engrenagem', rotulo: 'Configurações', para: '/perfil/editar' },
];

// Dados que a pessoa pode alterar em "Editar perfil". Ficam no navegador até as telas serem ligadas na API.
const CHAVE_PERFIL = 'desapegauai.perfil.v1';
const ouvintes = new Set();
let perfilAtual = null;

const comIniciais = (dados) => ({
  ...USUARIO,
  ...dados,
  iniciais: (dados.nome ?? USUARIO.nome).split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase(),
});

function lerPerfil() {
  if (perfilAtual) return perfilAtual;
  try {
    perfilAtual = comIniciais(JSON.parse(localStorage.getItem(CHAVE_PERFIL)) ?? {});
  } catch {
    perfilAtual = comIniciais({});
  }
  return perfilAtual;
}

function assinarPerfil(avisar) {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}

export const usePerfil = () => useSyncExternalStore(assinarPerfil, lerPerfil);

export function salvarPerfil(dados) {
  try {
    localStorage.setItem(CHAVE_PERFIL, JSON.stringify(dados));
  } catch {
    // sem acesso ao armazenamento: mantém os dados só nesta visita
  }
  perfilAtual = comIniciais(dados);
  ouvintes.forEach((avisar) => avisar());
}
