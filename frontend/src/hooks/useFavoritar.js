import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { desfavoritar, favoritar } from '../services/mercadoApi.js';
import { useSessao } from '../services/sessao.js';

/** Favoritar pela API. Sem login, leva para o login. */
export default function useFavoritar({ aoMudar, aoErrar } = {}) {
  const { usuario } = useSessao();
  const navegar = useNavigate();

  return useCallback(async (anuncio) => {
    if (!usuario) {
      navegar('/entrar');
      return;
    }
    const novo = !anuncio.favoritado;
    aoMudar?.(anuncio.id, novo);
    try {
      if (novo) await favoritar(anuncio.id);
      else await desfavoritar(anuncio.id);
    } catch (erro) {
      aoMudar?.(anuncio.id, !novo);
      aoErrar?.(erro);
    }
  }, [usuario, navegar, aoMudar, aoErrar]);
}
