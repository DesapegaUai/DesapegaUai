import { formatarPreco } from './formatar.js'

// Compartilhar o anúncio (referência: o compartilhar da OLX): no celular, a janela do próprio aparelho;
// no computador, a escolha entre WhatsApp, Facebook, X e copiar o link (CompartilharAnuncio).

export const enderecoDoAnuncio = (anuncio) => `${window.location.origin}/anuncio/${anuncio.id}`
export const textoDoAnuncio = (anuncio) => `${anuncio.titulo} por ${formatarPreco(anuncio.preco)} no DesapegaUai`

/** No celular, abre a janela de compartilhar do aparelho. Devolve true se ela cuidou (ou a pessoa fechou). */
export async function compartilharNoAparelho(anuncio) {
  if (!navigator.share || !window.matchMedia('(pointer: coarse)').matches) return false
  try {
    await navigator.share({ title: anuncio.titulo, text: textoDoAnuncio(anuncio), url: enderecoDoAnuncio(anuncio) })
    return true
  } catch (erro) {
    return erro.name === 'AbortError' // a pessoa fechou a janela do aparelho
  }
}
