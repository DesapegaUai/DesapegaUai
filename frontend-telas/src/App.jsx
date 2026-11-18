import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Casa from './paginas/Casa';
import Eletronicos from './paginas/Eletronicos';
import Moda from './paginas/Moda';
import Veiculos from './paginas/Veiculos';
import Livros from './paginas/Livros';
import Games from './paginas/Games';
import Servicos from './paginas/Servicos';
import Favoritos from './paginas/Favoritos';
import Conversas from './paginas/Conversas';
import Perfil from './paginas/Perfil';

/** Volta ao topo a cada troca de tela (menos quando é só um #âncora). */
function RolarParaTopo() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo(0, 0); }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <RolarParaTopo />
      <Routes>
        {/* A Home (Henrique) entra aqui no projeto final. Enquanto isso, "/" abre Casa. */}
        <Route path="/" element={<Navigate to="/categoria/casa" replace />} />

        {/* Categorias */}
        <Route path="/categoria/casa" element={<Casa />} />
        <Route path="/categoria/eletronicos" element={<Eletronicos />} />
        <Route path="/categoria/moda" element={<Moda />} />
        <Route path="/categoria/veiculos" element={<Veiculos />} />
        <Route path="/categoria/livros" element={<Livros />} />
        <Route path="/categoria/games" element={<Games />} />
        <Route path="/categoria/servicos" element={<Servicos />} />

        {/* Área do usuário */}
        <Route path="/favoritos" element={<Favoritos />} />
        <Route path="/conversas" element={<Conversas />} />
        <Route path="/conversas/:id" element={<Conversas />} />
        <Route path="/perfil" element={<Perfil />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
