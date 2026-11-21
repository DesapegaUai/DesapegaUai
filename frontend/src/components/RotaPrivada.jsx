import { Navigate, Outlet, useLocation } from 'react-router';
import { useSessao } from '../services/sessao.js';

/** Telas que precisam de login: sem sessão, vai para o login e volta depois de entrar. */
export default function RotaPrivada() {
  const { carregando, usuario } = useSessao();
  const local = useLocation();
  if (carregando) return <p className="carregando-tela" role="status">Carregando…</p>;
  if (!usuario) return <Navigate to="/entrar" replace state={{ voltar: local.pathname + local.search }} />;
  return <Outlet />;
}
