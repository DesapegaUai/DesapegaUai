import { useRef } from 'react';
import { Link, useLocation } from 'react-router';
import Icone from './IconeMarketplace.jsx';
import useGaveta from '../hooks/useGaveta.js';
import useSair from '../hooks/useSair.js';
import { NAO_LIDAS_TOTAL } from '../services/conversas.js';
import '../styles/marketplace-menu-lateral.css';

const logoPrincipal = '/img/logo-principal.svg';

const ITENS = [
  { rotulo: 'Início', icone: 'inicio', para: '/', ativo: (p) => p === '/' },
  { rotulo: 'Categorias', icone: 'grade', para: '/categoria/casa', ativo: (p) => p.startsWith('/categoria') },
  { rotulo: 'Favoritos', icone: 'favorito', para: '/favoritos', ativo: (p) => p.startsWith('/favoritos') },
  { rotulo: 'Mensagens', icone: 'mensagens', para: '/conversas', ativo: (p) => p.startsWith('/conversas'), contador: true },
  { rotulo: 'Meus anúncios', icone: 'etiqueta', para: '/meus-anuncios', ativo: (p) => p.startsWith('/meus-anuncios') || p.startsWith('/anunciar') || p.startsWith('/anuncios/') },
  { rotulo: 'Perfil', icone: 'perfil', para: '/perfil', ativo: (p) => p.startsWith('/perfil') },
];

/**
 * Menu lateral.
 * modo="fixo"   → coluna do painel (Perfil)
 * modo="gaveta" → abre por cima da tela pelo botão ☰ (aberto / onFechar)
 */
export default function MenuLateral({ modo = 'fixo', aberto = false, onFechar, onSair }) {
  const { pathname } = useLocation();
  const fecharRef = useRef(null);
  const ehGaveta = modo === 'gaveta';
  useGaveta(ehGaveta && aberto, onFechar, fecharRef);

  const sairDaConta = useSair();
  const sair = onSair ?? sairDaConta;

  const nav = (
    <nav
      className={`painel-nav ${modo}${aberto ? ' aberto' : ''}`}
      aria-label="Menu principal"
      role={ehGaveta && aberto ? 'dialog' : undefined}
      aria-modal={ehGaveta && aberto ? true : undefined}
    >
      {ehGaveta && (
        <div className="gaveta-topo">
          <img src={logoPrincipal} alt="DesapegaUai" width="159" height="34" />
          <button type="button" className="gaveta-fecha" aria-label="Fechar menu" onClick={onFechar} ref={fecharRef}>
            <Icone nome="fechar" tamanho={18} cor="#16281C" />
          </button>
        </div>
      )}

      {ITENS.map((item) => {
        const ativo = item.ativo(pathname);
        return (
          <Link
            key={item.rotulo}
            to={item.para}
            className={`nv${ativo ? ' on' : ''}`}
            aria-current={ativo ? 'page' : undefined}
            title={item.rotulo}
            onClick={ehGaveta ? onFechar : undefined}
          >
            <Icone nome={item.icone} tamanho={21} cor={ativo ? '#3E8B22' : '#4CA02B'} espessura={1.7} />
            <span className="rot">{item.rotulo}</span>
            {item.contador && NAO_LIDAS_TOTAL > 0 && (
              <span className="cnt" aria-label={`${NAO_LIDAS_TOTAL} não lidas`}>{NAO_LIDAS_TOTAL}</span>
            )}
          </Link>
        );
      })}

      <div className="nv-div" role="separator" />
      <button type="button" className="nv" title="Sair" onClick={sair}>
        <Icone nome="sair" tamanho={21} cor="#4CA02B" espessura={1.7} />
        <span className="rot">Sair</span>
      </button>

      <div className="promo">
        <b>Desapegue com propósito</b>
        <p>Dê uma nova chance para produtos e faça a diferença na sua região.</p>
      </div>
    </nav>
  );

  if (!ehGaveta) return nav;
  return (
    <>
      <div className={`menu-fundo${aberto ? ' visivel' : ''}`} onClick={onFechar} aria-hidden="true" />
      {nav}
    </>
  );
}
