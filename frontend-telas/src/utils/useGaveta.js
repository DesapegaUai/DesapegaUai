import { useEffect } from 'react';

/**
 * Comportamento de gaveta/modal enquanto `aberta`:
 * - leva o foco para `refFoco` (ex.: botão Fechar) e devolve para quem abriu ao fechar
 * - Esc fecha
 * - a página de trás não rola
 * `onFechar` deve ser estável (useCallback).
 */
export default function useGaveta(aberta, onFechar, refFoco) {
  useEffect(() => {
    if (!aberta) return undefined;
    const quemAbriu = document.activeElement;
    refFoco?.current?.focus();

    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', aoTeclar);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAntes;
      if (quemAbriu instanceof HTMLElement && quemAbriu !== document.body) quemAbriu.focus();
      else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };
  }, [aberta, onFechar, refFoco]);
}
