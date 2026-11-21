import { LIMITES } from './meusAnuncios.js';

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];

/** Devolve a mensagem de erro da foto, ou null se ela puder ser usada (a API confere de novo). */
export function erroDaFoto(arquivo) {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) return 'Envie somente fotos JPG, PNG ou WebP.';
  if (arquivo.size > LIMITES.bytesFoto) return 'Cada foto pode ter no máximo 8 MB.';
  return null;
}
