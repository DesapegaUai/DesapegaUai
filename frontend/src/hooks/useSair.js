import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { sair } from '../services/sessao.js';

/** Encerra a sessão (e o push deste aparelho) e volta para o login, que mostra "Você saiu da sua conta". */
export default function useSair() {
  const navegar = useNavigate();
  return useCallback(async () => {
    await sair();
    navegar('/entrar', { state: { saiu: true } });
  }, [navegar]);
}
