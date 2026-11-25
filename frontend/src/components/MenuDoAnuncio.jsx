import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icone from './IconeMarketplace.jsx';
import CompartilharAnuncio from './CompartilharAnuncio.jsx';
import DenunciarAnuncio from './DenunciarAnuncio.jsx';
import { compartilharNoAparelho } from '../services/compartilhar.js';
import '../styles/marketplace-acoes.css';

const ALTURA_MENU = 112;

/**
 * Os três pontinhos no alto do anúncio: Compartilhar e Denunciar anúncio (quem é dono só compartilha).
 * Sem login, Denunciar leva para a tela de entrar.
 */
export default function MenuDoAnuncio({ anuncio, logado, onAviso, onEntrar }) {
  const [posicao, setPosicao] = useState(null);
  const [janela, setJanela] = useState(null); // 'compartilhar' ou 'denunciar'
  const botaoRef = useRef(null);
  const menuRef = useRef(null);
  const fecharMenu = useCallback(() => setPosicao(null), []);
  const fecharJanela = useCallback(() => setJanela(null), []);

  function alternar() {
    if (posicao) { fecharMenu(); return; }
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
      if (!menuRef.current?.contains(e.target) && !botaoRef.current?.contains(e.target)) fecharMenu();
    };
    const tecla = (e) => {
      if (e.key === 'Escape') { fecharMenu(); botaoRef.current?.focus(); }
    };
    document.addEventListener('mousedown', clicouFora);
    document.addEventListener('keydown', tecla);
    window.addEventListener('scroll', fecharMenu, true);
    window.addEventListener('resize', fecharMenu);
    return () => {
      document.removeEventListener('mousedown', clicouFora);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('scroll', fecharMenu, true);
      window.removeEventListener('resize', fecharMenu);
    };
  }, [posicao, fecharMenu]);

  // o foco volta para os três pontinhos antes de abrir a janela: ao fechar, ela devolve o foco para eles
  function abrir(qual) {
    fecharMenu();
    botaoRef.current?.focus();
    setJanela(qual);
  }

  async function compartilhar() {
    fecharMenu();
    botaoRef.current?.focus();
    if (await compartilharNoAparelho(anuncio)) return;
    setJanela('compartilhar');
  }

  function denunciar() {
    if (!logado) { fecharMenu(); onEntrar(); return; }
    abrir('denunciar');
  }

  return (
    <>
      <button
        type="button"
        ref={botaoRef}
        className="det-mais"
        aria-label="Mais opções do anúncio"
        aria-haspopup="menu"
        aria-expanded={Boolean(posicao)}
        onClick={alternar}
      >
        <Icone nome="mais-vertical" tamanho={22} cor="#4A524C" espessura={2} />
      </button>

      {posicao && createPortal(
        <div className="telas-marketplace">
          <div className="acoes-menu" role="menu" aria-label="Mais opções do anúncio" ref={menuRef} style={posicao}>
            <button type="button" role="menuitem" onClick={compartilhar}>
              <Icone nome="compartilhar" tamanho={19} cor="#3E8B22" />Compartilhar
            </button>
            {!anuncio.meu && (
              <button type="button" role="menuitem" className="perigo" onClick={denunciar}>
                <Icone nome="bandeira" tamanho={19} cor="#C0392B" />Denunciar anúncio
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}

      {janela === 'compartilhar' && <CompartilharAnuncio anuncio={anuncio} onAviso={onAviso} onFechar={fecharJanela} />}
      {janela === 'denunciar' && (
        <DenunciarAnuncio
          anuncio={anuncio}
          onFechar={fecharJanela}
          onDenunciado={() => onAviso('sucesso', 'Denúncia enviada', 'Obrigado por avisar. A equipe do DesapegaUai vai analisar o anúncio.')}
        />
      )}
    </>
  );
}
