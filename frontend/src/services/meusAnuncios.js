// Opções e textos dos anúncios da conta. Os anúncios vêm da API (GET /meus-anuncios) e é ela que
// valida tudo; a conferência daqui só avisa antes de enviar.

export const LIMITES = { fotos: 8, bytesFoto: 8 * 1024 * 1024, titulo: 80, descricao: 1000 };
export const CONDICOES = ['Novo', 'Seminovo', 'Usado'];
export const ENTREGAS = {
  retirada: { titulo: 'Retirada em mãos', descricao: 'O comprador retira o produto no local.' },
  combinar: { titulo: 'Combinar com o vendedor', descricao: 'Combine a entrega diretamente com o comprador.' },
};
// Como levar o item: evita a pergunta "cabe num carro de app?" no chat
export const TRANSPORTES = {
  mochila: { titulo: 'Cabe na mochila', descricao: 'Dá para levar a pé ou de ônibus.', icone: 'sacola' },
  carro: { titulo: 'Cabe em carro de app', descricao: 'Vai no porta-malas ou no banco.', icone: 'veiculos' },
  carreto: { titulo: 'Precisa de carreto', descricao: 'Item grande: combine o frete.', icone: 'caminhao' },
};
export const ROTULO_STATUS = { ativo: 'Disponível', reservado: 'Reservado', rascunho: 'Rascunho', vendido: 'Vendido' };
// aparece na busca e no perfil público: disponível ou reservado
export const estaVisivel = (anuncio) => anuncio.status === 'ativo' || anuncio.status === 'reservado';

/** Regras de preenchimento (as mesmas da API), para avisar antes de enviar. Devolve { campo: 'mensagem' }. */
export function validarAnuncio(a) {
  const erros = {};
  const titulo = (a.titulo ?? '').trim();
  if (!a.fotos?.length) erros.fotos = 'Adicione pelo menos 1 foto.';
  if (titulo.length < 3) erros.titulo = 'O título precisa ter de 3 a 80 caracteres.';
  if (!a.categoria) erros.categoria = 'Escolha uma categoria.';
  if (a.categoria !== 'servicos' && !a.condicao) erros.condicao = 'Escolha a condição do produto.';
  if (a.categoria !== 'servicos' && !a.transporte) erros.transporte = 'Escolha como o item pode ser levado.';
  if (!(Number(a.preco) > 0)) erros.preco = 'Informe um preço maior que zero.';
  if (!a.cidadeId) erros.cidade = 'Escolha a cidade.';
  if (!a.bairroId) erros.bairro = 'Escolha o bairro.';
  if (!a.entrega) erros.entrega = 'Escolha a forma de entrega.';
  return erros;
}

// nomes dos campos que a API devolve em campos_faltando
const NOMES_DA_API = {
  fotos: 'fotos', titulo: 'título', categoria_id: 'categoria', condicao: 'condição',
  preco: 'preço', bairro_id: 'bairro', forma_entrega: 'entrega',
};
export const nomesDosCampos = (campos = []) => campos.map((c) => NOMES_DA_API[c] ?? c);
