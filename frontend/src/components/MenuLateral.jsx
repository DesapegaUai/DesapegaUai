import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import Icone from './IconeMarketplace.jsx';
import SeloMensagens from './SeloMensagens.jsx';
import useGaveta from '../hooks/useGaveta.js';
import useSair from '../hooks/useSair.js';
import { CATEGORIAS, caminhoCategoria } from '../services/categorias.js';
import '../styles/marketplace-menu-lateral.css';

const logoPrincipal = '/img/logo-principal.svg';

// "Editar perfil" não entra aqui: o botão fica no topo do Perfil
const ITENS = [
  { rotulo: 'Perfil', icone: 'perfil', para: '/perfil', ativo: (p) => p.startsWith('/perfil') },
  { rotulo: 'Meus anúncios', icone: 'etiqueta', para: '/meus-anuncios', ativo: (p) => p.startsWith('/meus-anuncios') || p.startsWith('/anunciar') || p.startsWith('/anuncios/') },
  { rotulo: 'Favoritos', icone: 'favorito', para: '/favoritos', ativo: (p) => p.startsWith('/favoritos') },
  { rotulo: 'Mensagens', icone: 'mensagens', para: '/conversas', ativo: (p) => p.startsWith('/conversas') },
];

/**
 * Menu lateral.
 * modo="fixo"   → coluna do painel (Perfil): Início, Categorias e os itens da conta
 * modo="gaveta" → abre por cima da tela pelo botão ☰ (aberto / onFechar)
 */
export default function MenuLateral({
  modo = 'fixo', aberto = false, onFechar, onSair,
}) {
  const { pathname } = useLocation();
  const fecharRef = useRef(null);
  const ehGaveta = modo === 'gaveta';
  const [categoriasAbertas, setCategoriasAbertas] = useState(() => pathname.startsWith('/categoria'));
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

      <Link
        to="/"
        className={`nv${pathname === '/' ? ' on' : ''}`}
        aria-current={pathname === '/' ? 'page' : undefined}
        title="Início"
        onClick={ehGaveta ? onFechar : undefined}
      >
        <Icone nome="inicio" tamanho={21} cor={pathname === '/' ? '#3E8B22' : '#4CA02B'} espessura={1.7} />
        <span className="rot">Início</span>
      </Link>

      <div className="nv-grupo-categoria">
        <button
          type="button"
          className={`nv nv-categorias${pathname.startsWith('/categoria') ? ' on' : ''}`}
          aria-expanded={categoriasAbertas}
          aria-controls="painel-categorias"
          onClick={() => setCategoriasAbertas((abertas) => !abertas)}
        >
          <Icone nome="grade" tamanho={21} cor={pathname.startsWith('/categoria') ? '#3E8B22' : '#4CA02B'} espessura={1.7} />
          <span className="rot">Categorias</span>
          <Icone nome="seta-baixo" tamanho={17} cor="#6B726C" espessura={1.8} />
        </button>
        {categoriasAbertas && (
          <div className="nv-submenu" id="painel-categorias" aria-label="Categorias">
            {CATEGORIAS.map((categoria) => {
              const caminho = caminhoCategoria(categoria.slug);
              const ativo = pathname === caminho;
              return (
                <Link
                  key={categoria.slug}
                  to={caminho}
                  className={`nv-sub${ativo ? ' on' : ''}`}
                  aria-current={ativo ? 'page' : undefined}
                  onClick={ehGaveta ? onFechar : undefined}
                >
                  {categoria.nome}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {ehGaveta && (
        <Link
          to="/procura-se"
          className={`nv${pathname === '/procura-se' ? ' on' : ''}`}
          aria-current={pathname === '/procura-se' ? 'page' : undefined}
          title="Procura-se"
          onClick={onFechar}
        >
          <Icone nome="busca" tamanho={21} cor={pathname === '/procura-se' ? '#3E8B22' : '#4CA02B'} espessura={1.7} />
          <span className="rot">Procura-se</span>
        </Link>
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
            {item.para === '/conversas' && <SeloMensagens naLinha />}
          </Link>
        );
      })}

      <div className="promo">
        <b>Desapegue com propósito</b>
        <p>Dê uma nova chance para produtos e faça a diferença na sua região.</p>
      </div>
      <div className="nv-div" role="separator" />
      <button type="button" className="nv" title="Sair da conta" onClick={sair}>
        <Icone nome="sair" tamanho={21} cor="#4CA02B" espessura={1.7} />
        <span className="rot">Sair da conta</span>
      </button>
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
