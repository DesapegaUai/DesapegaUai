import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { desfavoritar, favoritar } from '../services/mercadoApi.js';
import { useSessao } from '../services/sessao.js';

/** Favoritar pela API. Sem login, leva para o login e volta para a mesma tela. */
export default function useFavoritar({ aoMudar, aoErrar } = {}) {
  const { usuario } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();

  return useCallback(async (anuncio) => {
    if (!usuario) {
      navegar('/entrar', { state: { voltar: local.pathname + local.search } });
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
  }, [usuario, navegar, local, aoMudar, aoErrar]);
}
