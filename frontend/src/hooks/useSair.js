import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../services/api.js';

/** Encerra a sessão e volta para o login, que mostra "Você saiu da sua conta". */
export default function useSair() {
  const navegar = useNavigate();
  return useCallback(async () => {
    await api.post('/auth/logout').catch(() => {}); // sem a API no ar, só volta para o login
    navegar('/entrar', { state: { saiu: true } });
  }, [navegar]);
}
