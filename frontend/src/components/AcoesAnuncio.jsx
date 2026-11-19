import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import Icone from './IconeMarketplace.jsx';
import useGaveta from '../hooks/useGaveta.js';
import { excluirMeuAnuncio, marcarComoVendido } from '../services/meusAnuncios.js';
import '../styles/marketplace-acoes.css';

const ALTURA_MENU = 210;

function ConfirmarExclusao({ anuncio, onCancelar, onConfirmar }) {
  const cancelarRef = useRef(null);
  useGaveta(true, onCancelar, cancelarRef);

  return createPortal(
    <div className="telas-marketplace">
      <div className="acoes-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancelar(); }}>
        <div className="acoes-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="acoes-titulo" aria-describedby="acoes-texto">
          <h2 id="acoes-titulo">Excluir este anúncio?</h2>
          <p id="acoes-texto">
            <b>{anuncio.titulo}</b> será apagado com as fotos, os favoritos e as conversas ligadas a ele.
            A exclusão não pode ser desfeita.
          </p>
          <div className="acoes-botoes">
            <button type="button" className="acoes-btn" onClick={onCancelar} ref={cancelarRef}>Cancelar</button>
            <button type="button" className="acoes-btn perigo" onClick={onConfirmar}>Excluir anúncio</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Botão de três pontos com as opções do anúncio: editar, marcar como vendido e excluir. */
export default function AcoesAnuncio({ anuncio, classeBotao = 'acoes-abrir', onAviso }) {
  const [posicao, setPosicao] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const botaoRef = useRef(null);
  const menuRef = useRef(null);
  const fechar = useCallback(() => setPosicao(null), []);
  const cancelar = useCallback(() => setConfirmando(false), []);

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
    menuRef.current?.querySelector('a, button')?.focus();
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

  function vender() {
    marcarComoVendido(anuncio.id);
    fechar();
    onAviso?.({ tipo: 'sucesso', titulo: 'Anúncio marcado como vendido', texto: 'Ele saiu da busca e continua em Meus anúncios.' });
  }

  function excluir() {
    excluirMeuAnuncio(anuncio.id);
    setConfirmando(false);
    onAviso?.({ tipo: 'sucesso', titulo: 'Anúncio excluído' });
  }

  const rascunho = anuncio.status === 'rascunho';

  return (
    <>
      <button
        type="button"
        ref={botaoRef}
        className={classeBotao}
        aria-label={`Mais opções de ${anuncio.titulo || 'rascunho'}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(posicao)}
        onClick={alternar}
      >
        <Icone nome="mais-horizontal" tamanho={18} cor="#9AA39B" espessura={1.9} />
      </button>

      {posicao && createPortal(
        <div className="telas-marketplace">
          <div className="acoes-menu" role="menu" ref={menuRef} style={posicao}>
            {!rascunho && (
              <Link role="menuitem" to={`/anuncio/${anuncio.id}`} onClick={fechar}>
                <Icone nome="olho" tamanho={19} cor="#3E8B22" />Ver anúncio
              </Link>
            )}
            {anuncio.status !== 'vendido' && (
              <Link role="menuitem" to={`/anuncios/${anuncio.id}/editar`} onClick={fechar}>
                <Icone nome="lapis" tamanho={19} cor="#3E8B22" />{rascunho ? 'Continuar editando' : 'Editar'}
              </Link>
            )}
            {anuncio.status === 'ativo' && (
              <button type="button" role="menuitem" onClick={vender}>
                <Icone nome="check" tamanho={19} cor="#3E8B22" />Marcar como vendido
              </button>
            )}
            <button type="button" role="menuitem" className="perigo" onClick={() => { fechar(); setConfirmando(true); }}>
              <Icone nome="fechar" tamanho={19} cor="#C0392B" />Excluir
            </button>
          </div>
        </div>,
        document.body,
      )}

      {confirmando && <ConfirmarExclusao anuncio={anuncio} onCancelar={cancelar} onConfirmar={excluir} />}
    </>
  );
}
