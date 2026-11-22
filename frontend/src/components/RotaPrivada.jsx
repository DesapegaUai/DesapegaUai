import { Navigate, Outlet } from 'react-router';
import { useSessao } from '../services/sessao.js';

/** Telas que precisam de login: sem sessão, vai para o login (depois de entrar, a pessoa vai para a Home). */
export default function RotaPrivada() {
  const { carregando, usuario } = useSessao();
  if (carregando) return <p className="carregando-tela" role="status">Carregando…</p>;
  if (!usuario) return <Navigate to="/entrar" replace />;
  return <Outlet />;
}
