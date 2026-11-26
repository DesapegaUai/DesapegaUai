import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icone from './IconeMarketplace.jsx';
import useFecharAoMexer from '../hooks/useFecharAoMexer.js';
import '../styles/marketplace-acoes.css';

const ALTURA_MENU = 220;

/** Três pontinhos ao lado da conversa, na lista: fixar no topo (até 3), arquivar, avaliação e excluir. */
export default function MenuConversa({ conversa, arquivada, onFixar, onArquivar, onAvaliar, onExcluir }) {
  const [posicao, setPosicao] = useState(null);
  const botaoRef = useRef(null);
  const menuRef = useRef(null);
  const fechar = useCallback(() => setPosicao(null), []);

  function alternar() {
    if (posicao) { fechar(); return; }
    const caixa = botaoRef.current.getBoundingClientRect();
    const abreParaCima = caixa.bottom + ALTURA_MENU > window.innerHeight;
    setPosicao({
      right: Math.max(8, window.innerWidth - caixa.right),
      ...(abreParaCima ? { bottom: window.innerHeight - caixa.top + 6 } : { top: caixa.bottom + 6 }),
    });
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

  const escolher = (acao) => () => { fechar(); acao(conversa); };

  return (
    <>
      <button
        type="button"
        ref={botaoRef}
        className="item-conv-mais"
        aria-label={`Mais opções da conversa com ${conversa.nome}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(posicao)}
        onClick={alternar}
      >
        <Icone nome="mais-vertical" tamanho={18} cor="#6B726C" espessura={1.9} />
      </button>

      {posicao && createPortal(
        <div className="telas-marketplace">
          <div className="acoes-menu" role="menu" ref={menuRef} style={posicao}>
            {onFixar && !arquivada && (
              <button type="button" role="menuitem" onClick={escolher(onFixar)}>
                <Icone nome="alfinete" tamanho={19} cor="#3E8B22" />{conversa.fixada ? 'Desafixar conversa' : 'Fixar conversa'}
              </button>
            )}
            <button type="button" role="menuitem" onClick={escolher(onArquivar)}>
              <Icone nome="arquivo" tamanho={19} cor="#3E8B22" />{arquivada ? 'Desarquivar conversa' : 'Arquivar conversa'}
            </button>
            <button type="button" role="menuitem" onClick={escolher(onAvaliar)}>
              <Icone nome="estrela" tamanho={19} cor="#3E8B22" />{conversa.vendendo ? 'Avaliação' : 'Avaliar vendedor'}
            </button>
            <button type="button" role="menuitem" className="perigo" onClick={escolher(onExcluir)}>
              <Icone nome="lixeira" tamanho={19} cor="#C0392B" />Excluir conversa
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
