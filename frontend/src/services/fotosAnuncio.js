import { LIMITES } from './meusAnuncios.js';

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAIOR_LADO = 1000;

/** Devolve a mensagem de erro da foto, ou null se ela puder ser usada. */
export function erroDaFoto(arquivo) {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) return 'Envie somente fotos JPG, PNG ou WebP.';
  if (arquivo.size > LIMITES.bytesFoto) return 'Cada foto pode ter no máximo 8 MB.';
  return null;
}

/** Reduz a foto para caber no navegador enquanto as telas não estão ligadas na API. */
export async function prepararFoto(arquivo) {
  const imagem = await createImageBitmap(arquivo);
  const escala = Math.min(1, MAIOR_LADO / Math.max(imagem.width, imagem.height));
  const tela = document.createElement('canvas');
  tela.width = Math.round(imagem.width * escala);
  tela.height = Math.round(imagem.height * escala);
  tela.getContext('2d').drawImage(imagem, 0, 0, tela.width, tela.height);
  imagem.close();
  return tela.toDataURL('image/jpeg', 0.76);
}
