// Perfil de exemplo (protótipo 11-perfil). Trocar pelos dados do usuário logado (API).

import fotoBicicleta from '../assets/fotos/foto-exemplo-bicicleta.webp';
import { FAVORITOS } from './favoritos';
import { CONVERSAS, NAO_LIDAS_TOTAL } from './conversas';

export const USUARIO = {
  nome: 'Ana Beatriz Moreira',
  usuario: '@anabeatriz',
  iniciais: 'AB',
  bio: '', // vazio → mostra o convite "Adicione uma bio"
  membroDesde: 'mai/2023',
  membroDesdeExtenso: 'Maio de 2023',
  ultimoAcesso: 'Hoje, 09:41',
  avaliacao: 4.9,
  qtdAvaliacoes: 23,
  reputacao: 'Ótimo',
  anunciosAtivos: 12,
};

export const NUMEROS = [
  { icone: 'sacola', valor: USUARIO.anunciosAtivos, rotulo: 'Anúncios ativos' },
  { icone: 'favorito', valor: FAVORITOS.length, rotulo: 'Favoritos' },
  { icone: 'mensagens', valor: CONVERSAS.length, rotulo: 'Conversas' },
  {
    icone: 'estrela',
    valor: USUARIO.avaliacao.toLocaleString('pt-BR'),
    rotulo: `Avaliação (${USUARIO.qtdAvaliacoes})`,
  },
];

export const LINKS_CONTA = [
  { icone: 'perfil', titulo: 'Informações pessoais', descricao: 'Nome, e-mail, telefone e mais' },
  { icone: 'cadeado', titulo: 'Privacidade', descricao: 'Quem pode ver seu perfil e anúncios' },
  { icone: 'sino', titulo: 'Notificações', descricao: 'Preferências de alertas' },
  { icone: 'verificado', titulo: 'Verificação de conta', descricao: 'CPF/CNPJ e segurança' },
  { icone: 'local', titulo: 'Endereços', descricao: 'Gerencie seus endereços' },
  { icone: 'ajuda', titulo: 'Ajuda e suporte', descricao: 'Dúvidas frequentes' },
];

export const MEUS_ANUNCIOS = [
  { id: 'meu-1', titulo: 'Poltrona retrô verde', preco: 450, visualizacoes: 128, favoritos: 18, status: 'Ativo' },
  { id: 'meu-2', titulo: 'Bicicleta aro 26', preco: 680, visualizacoes: 95, favoritos: 12, status: 'Ativo', foto: fotoBicicleta },
  { id: 'meu-3', titulo: 'Mesa de jantar 6 lugares', preco: 890, visualizacoes: 76, favoritos: 9, status: 'Ativo' },
];

export const ACOES_RAPIDAS = [
  { icone: 'mais', rotulo: 'Publicar um novo anúncio', para: '/anunciar' },
  { icone: 'etiqueta', rotulo: 'Ver meus anúncios', para: '/perfil#meus-anuncios' },
  { icone: 'favorito', rotulo: 'Ver favoritos', para: '/favoritos' },
  { icone: 'mensagens', rotulo: 'Mensagens', para: '/conversas', contador: NAO_LIDAS_TOTAL },
  { icone: 'engrenagem', rotulo: 'Configurações', para: '#' },
];
