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
    menuRef.current?.querySelector('button:not(:disabled)')?.focus();
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
  // a própria mensagem (ainda não apagada) sempre mostra Editar e Apagar para todos; depois do prazo,
  // a opção fica apagada com o aviso, para ninguém achar que ela sumiu
  const minha = mensagem.minha && !mensagem.apagada;
  const editar = podeEditar(mensagem);
  const apagarParaTodos = podeApagarParaTodos(mensagem);

  return createPortal(
    <div className="telas-marketplace">
      <div className="acoes-menu menu-mensagem" role="menu" aria-label="Opções da mensagem" ref={menuRef} style={posicao}>
        {minha && (
          <button type="button" role="menuitem" disabled={!editar} onClick={escolher(onEditar)}>
            <Icone nome="lapis" tamanho={19} cor={editar ? '#3E8B22' : '#9AA39B'} />
            <span className="menu-mensagem-texto">
              Editar
              {!editar && <small>Só dá para editar até 15 minutos depois de enviar</small>}
            </span>
          </button>
        )}
        <button type="button" role="menuitem" onClick={escolher(onApagarParaMim)}>
          <Icone nome="lixeira" tamanho={19} cor="#3E8B22" />Apagar para mim
        </button>
        {minha && (
          <button type="button" role="menuitem" className="perigo" disabled={!apagarParaTodos} onClick={escolher(onApagarParaTodos)}>
            <Icone nome="lixeira" tamanho={19} cor={apagarParaTodos ? '#C0392B' : '#9AA39B'} />
            <span className="menu-mensagem-texto">
              Apagar para todos
              {!apagarParaTodos && <small>Só dá para apagar para todos até 2 dias depois de enviar</small>}
            </span>
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
