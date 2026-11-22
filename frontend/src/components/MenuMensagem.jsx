import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icone from './IconeMarketplace.jsx';
import { podeApagarParaTodos, podeEditar } from '../services/conversas.js';
import '../styles/marketplace-acoes.css';

/**
 * Opções de uma mensagem do chat, como no WhatsApp:
 * editar (a sua, até 15 minutos), apagar para mim (qualquer uma) e apagar para todos (a sua, até 2 dias).
 */
export default function MenuMensagem({ mensagem, posicao, onEditar, onApagarParaMim, onApagarParaTodos, onFechar }) {
  const menuRef = useRef(null);

  useEffect(() => {
    menuRef.current?.querySelector('button')?.focus();
    const clicouFora = (e) => { if (!menuRef.current?.contains(e.target)) onFechar(); };
    const tecla = (e) => { if (e.key === 'Escape') onFechar(true); };
    document.addEventListener('mousedown', clicouFora);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', onFechar);
    return () => {
      document.removeEventListener('mousedown', clicouFora);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', onFechar);
    };
  }, [onFechar]);

  const escolher = (acao) => () => { onFechar(); acao(mensagem); };

  return createPortal(
    <div className="telas-marketplace">
      <div className="acoes-menu menu-mensagem" role="menu" aria-label="Opções da mensagem" ref={menuRef} style={posicao}>
        {podeEditar(mensagem) && (
          <button type="button" role="menuitem" onClick={escolher(onEditar)}>
            <Icone nome="lapis" tamanho={19} cor="#3E8B22" />Editar
          </button>
        )}
        <button type="button" role="menuitem" onClick={escolher(onApagarParaMim)}>
          <Icone nome="lixeira" tamanho={19} cor="#3E8B22" />Apagar para mim
        </button>
        {podeApagarParaTodos(mensagem) && (
          <button type="button" role="menuitem" className="perigo" onClick={escolher(onApagarParaTodos)}>
            <Icone nome="lixeira" tamanho={19} cor="#C0392B" />Apagar para todos
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
