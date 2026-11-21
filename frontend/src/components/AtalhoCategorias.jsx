import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import Icone from './IconeMarketplace.jsx';
import { CATEGORIAS, caminhoCategoria } from '../services/categorias.js';
import '../styles/marketplace-acoes.css';

/** Atalho do cabeçalho para as 8 categorias, nas telas que não têm a barra de abas (Conversas, Mapa e Ajuda). */
export default function AtalhoCategorias() {
  const [posicao, setPosicao] = useState(null);
  const botaoRef = useRef(null);
  const menuRef = useRef(null);
  const fechar = useCallback(() => setPosicao(null), []);

  function alternar() {
    if (posicao) { fechar(); return; }
    const caixa = botaoRef.current.getBoundingClientRect();
    setPosicao({ top: caixa.bottom + 6, left: Math.max(8, Math.min(caixa.left, window.innerWidth - 240)) });
  }

  useEffect(() => {
    if (!posicao) return undefined;
    menuRef.current?.querySelector('a')?.focus();
    const clicouFora = (e) => {
      if (!menuRef.current?.contains(e.target) && !botaoRef.current?.contains(e.target)) fechar();
    };
    const tecla = (e) => {
      if (e.key === 'Escape') { fechar(); botaoRef.current?.focus(); }
    };
    document.addEventListener('mousedown', clicouFora);
    document.addEventListener('keydown', tecla);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', clicouFora);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [posicao, fechar]);

  return (
    <>
      <button type="button" className="cab-icone cab-categorias" ref={botaoRef} aria-label="Categorias" title="Categorias" aria-haspopup="menu" aria-expanded={Boolean(posicao)} onClick={alternar}>
        <Icone nome="grade" tamanho={25} cor="#3E8B22" />
      </button>
      {posicao && createPortal(
        <div className="telas-marketplace">
          <div className="acoes-menu" role="menu" ref={menuRef} style={posicao}>
            {CATEGORIAS.map((categoria) => (
              <Link role="menuitem" key={categoria.slug} to={caminhoCategoria(categoria.slug)} onClick={fechar}>
                <Icone nome={categoria.icone} tamanho={19} cor="#3E8B22" />{categoria.nome}
              </Link>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
