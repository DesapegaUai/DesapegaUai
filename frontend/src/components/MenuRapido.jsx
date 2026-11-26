import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icone from './IconeMarketplace.jsx';
import useFecharAoMexer from '../hooks/useFecharAoMexer.js';
import '../styles/marketplace-acoes.css';

/** Botão das respostas rápidas do chat que abre uma lista curta de opções (ponto de encontro, oferta). */
export default function MenuRapido({ rotulo, icone, itens, onEscolher }) {
  const [posicao, setPosicao] = useState(null);
  const botaoRef = useRef(null);
  const menuRef = useRef(null);
  const fechar = useCallback(() => setPosicao(null), []);

  function alternar() {
    if (posicao) { fechar(); return; }
    const caixa = botaoRef.current.getBoundingClientRect();
    // a caixa de mensagem fica embaixo da tela: a lista abre para cima
    setPosicao({ left: Math.max(8, Math.min(caixa.left, window.innerWidth - 240)), bottom: window.innerHeight - caixa.top + 6 });
  }

  useEffect(() => {
    if (!posicao) return undefined;
    menuRef.current?.querySelector('button')?.focus();
    const clicouFora = (e) => {
      if (!menuRef.current?.contains(e.target) && !botaoRef.current?.contains(e.target)) fechar();
    };
    const tecla = (e) => {
      if (e.key === 'Escape') { fechar(); botaoRef.current?.focus(); }
    };
    document.addEventListener('mousedown', clicouFora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', clicouFora);
      document.removeEventListener('keydown', tecla);
    };
  }, [posicao, fechar]);
  useFecharAoMexer(Boolean(posicao), botaoRef, fechar);

  return (
    <>
      <button type="button" className="rapida rapida-menu" ref={botaoRef} aria-haspopup="menu" aria-expanded={Boolean(posicao)} onClick={alternar}>
        <Icone nome={icone} tamanho={17} cor="#3E8B22" espessura={1.8} />{rotulo}
      </button>
      {posicao && createPortal(
        <div className="telas-marketplace">
          <div className="acoes-menu" role="menu" ref={menuRef} style={posicao}>
            {itens.map((item) => (
              <button type="button" role="menuitem" key={item.rotulo} onClick={() => { fechar(); onEscolher(item); }}>
                {item.rotulo}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
