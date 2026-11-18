import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Icone from './Icone';
import { CATEGORIAS, caminhoCategoria } from '../dados/categorias';

/** Abas das 8 categorias. No celular rolam na horizontal; a aba ativa entra na tela sozinha. */
export default function AbasCategorias() {
  const navRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const ativa = navRef.current?.querySelector('.aba.on');
    if (!ativa) return;
    const nav = navRef.current;
    const aba = ativa.getBoundingClientRect();
    const area = nav.getBoundingClientRect();
    if (aba.left < area.left || aba.right > area.right) {
      nav.scrollLeft += aba.left - area.left - 16;
    }
  }, [pathname]);

  return (
    <nav className="abas" aria-label="Categorias" ref={navRef}>
      {CATEGORIAS.map((cat) => (
        <NavLink
          key={cat.slug}
          to={caminhoCategoria(cat.slug)}
          className={({ isActive }) => (isActive ? 'aba on' : 'aba')}
        >
          {({ isActive }) => (
            <>
              <Icone nome={cat.icone} tamanho={21} cor={isActive ? '#3E8B22' : '#4CA02B'} />
              <span>{cat.nome}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
