import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

const avisoPadrao = (estado) => estado?.aviso ?? null;

/**
 * Aviso que a tela anterior mandou junto com a navegação (ex.: "Alterações salvas", "Você saiu da sua conta").
 * Aparece uma vez só: logo depois sai do histórico do navegador, senão voltava toda vez que a pessoa
 * recarregasse a página ou voltasse para ela pelo botão Voltar.
 */
export default function useAvisoDaNavegacao(ler = avisoPadrao) {
  const { pathname, search, hash, state } = useLocation();
  const navegar = useNavigate();
  const [aviso, setAviso] = useState(() => ler(state));
  const veioComEstado = state != null;

  useEffect(() => {
    if (veioComEstado) navegar({ pathname, search, hash }, { replace: true, state: null });
  }, [veioComEstado, navegar, pathname, search, hash]);

  return [aviso, setAviso];
}
