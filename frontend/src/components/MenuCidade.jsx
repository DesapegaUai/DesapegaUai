import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icone from './IconeMarketplace.jsx';
import { escolherCidade, useCidade } from '../services/cidade.js';
import { CIDADES } from '../services/locais.js';
import '../styles/marketplace-cidade.css';

/** Lista das cidades atendidas, aberta pelo botão de localização dos cabeçalhos. */
export default function MenuCidade({ posicao, ancoraRef, onFechar }) {
  const cidade = useCidade();
  const menuRef = useRef(null);

  useEffect(() => {
    menuRef.current?.querySelector('[aria-checked="true"]')?.focus();
    const clicouFora = (e) => {
      if (!menuRef.current?.contains(e.target) && !ancoraRef.current?.contains(e.target)) onFechar();
    };
    const tecla = (e) => {
      if (e.key === 'Escape') { onFechar(); ancoraRef.current?.focus(); }
    };
    document.addEventListener('mousedown', clicouFora);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', onFechar);
    window.addEventListener('scroll', onFechar, true);
    return () => {
      document.removeEventListener('mousedown', clicouFora);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', onFechar);
      window.removeEventListener('scroll', onFechar, true);
    };
  }, [ancoraRef, onFechar]);

  function escolher(nome) {
    escolherCidade(nome);
    onFechar();
    ancoraRef.current?.focus();
  }

  return createPortal(
    <div className="telas-marketplace">
      <div className="cidade-menu" role="menu" aria-label="Escolha a cidade" ref={menuRef} style={posicao}>
        <p className="cidade-titulo" aria-hidden="true">Escolha a cidade</p>
        {CIDADES.map((c) => (
          <button
            type="button"
            role="menuitemradio"
            aria-checked={c.nome === cidade}
            className={c.nome === cidade ? 'on' : undefined}
            key={c.nome}
            onClick={() => escolher(c.nome)}
          >
            <Icone nome="local" tamanho={19} cor={c.nome === cidade ? '#3E8B22' : '#8C918B'} />
            <span>{c.nome}, MG</span>
            {c.nome === cidade && <Icone nome="check" tamanho={18} cor="#3E8B22" espessura={2.2} />}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
