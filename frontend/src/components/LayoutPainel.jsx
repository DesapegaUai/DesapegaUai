import { useCallback, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import MenuLateral from './MenuLateral.jsx';
import Rodape from './RodapeMarketplace.jsx';
import Icone from './IconeMarketplace.jsx';
import Toast from './Toast.jsx';
import { NAO_LIDAS_TOTAL } from '../services/conversas.js';
import { usePerfil } from '../services/perfil.js';
import useSair from '../hooks/useSair.js';
import '../styles/marketplace-perfil.css';

const logoPrincipal = '/img/logo-principal.svg';

const ABAS_INFERIORES = [
  { rotulo: 'Início', icone: 'inicio', para: '/', fim: true },
  { rotulo: 'Categorias', icone: 'grade', para: '/categoria/casa' },
  { rotulo: 'Favoritos', icone: 'favorito', para: '/favoritos' },
  { rotulo: 'Mensagens', icone: 'mensagens', para: '/conversas', selo: NAO_LIDAS_TOTAL },
  { rotulo: 'Perfil', icone: 'perfil', para: '/perfil' },
];

/**
 * Moldura das telas da conta (Perfil, Meus anúncios, Cadastrar anúncio e Editar perfil):
 * topo · menu lateral · conteúdo · rodapé · menu inferior no celular.
 */
export default function LayoutPainel({ classeMain = '', foto = null, children }) {
  const navegar = useNavigate();
  const perfil = usePerfil();
  const sair = useSair();
  const [menuAberto, setMenuAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [termo, setTermo] = useState('');
  const [toast, setToast] = useState(null);
  const buscaRef = useRef(null);
  const fecharMenu = useCallback(() => setMenuAberto(false), []);

  function buscar(e) {
    e.preventDefault();
    const q = termo.trim();
    if (q) navegar(`/busca?q=${encodeURIComponent(q)}`);
  }

  function alternarBusca() {
    const abrir = !buscaAberta;
    setBuscaAberta(abrir);
    if (abrir) setTimeout(() => buscaRef.current?.focus(), 0);
  }

  return (
    <div className="painel">
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      <header className={`painel-topo${buscaAberta ? ' buscando' : ''}`}>
        <button type="button" className="burger" aria-label="Abrir menu" aria-expanded={menuAberto} onClick={() => setMenuAberto(true)}>
          <Icone nome="menu" tamanho={22} cor="#3E8B22" espessura={1.7} />
        </button>
        <Link to="/" className="brand" aria-label="DesapegaUai — página inicial">
          <img src={logoPrincipal} alt="DesapegaUai" width="187" height="40" />
        </Link>
        <button
          type="button"
          className="lupa"
          aria-label={buscaAberta ? 'Fechar busca' : 'Buscar'}
          aria-expanded={buscaAberta}
          onClick={alternarBusca}
        >
          <Icone nome={buscaAberta ? 'fechar' : 'busca'} tamanho={22} cor="#3E8B22" espessura={1.7} />
        </button>
        <form className="search" role="search" onSubmit={buscar}>
          <Icone nome="busca" tamanho={20} cor="#8C918B" espessura={1.7} />
          <label htmlFor="busca-painel" className="oculto">Buscar</label>
          <input
            id="busca-painel"
            ref={buscaRef}
            type="search"
            placeholder="Buscar anúncios, categorias ou produtos..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoComplete="off"
          />
        </form>
        <div className="tacts">
          <Link className="pub" to="/anunciar" aria-label="Publicar anúncio">
            <Icone nome="mais" tamanho={20} cor="#fff" espessura={2} />
            <span className="rot">Publicar anúncio</span>
          </Link>
          <button
            type="button"
            className="ic-topo"
            aria-label="Notificações (há novidades)"
            onClick={() => setToast({ tipo: 'info', titulo: 'Notificações em breve', texto: 'Por enquanto, as novidades aparecem em Mensagens.', chave: Date.now() })}
          >
            <Icone nome="sino" tamanho={24} cor="#3E8B22" espessura={1.7} />
            <i />
          </button>
          <Link className="ic-topo" to="/conversas" aria-label="Mensagens">
            <Icone nome="mensagens" tamanho={24} cor="#3E8B22" espessura={1.7} />
          </Link>
          <Link className="me" to="/perfil" aria-label="Meu perfil">
            <span className="ph">{foto ? <img src={foto} alt="" /> : perfil.iniciais}</span>
            <Icone nome="seta-baixo" tamanho={18} cor="#6B726C" espessura={1.7} />
          </Link>
        </div>
      </header>

      <MenuLateral modo="gaveta" aberto={menuAberto} onFechar={fecharMenu} onSair={sair} />

      <div className="painel-corpo">
        <MenuLateral modo="fixo" onSair={sair} />
        <main className={`painel-main ${classeMain}`.trim()}>{children}</main>
      </div>

      <Rodape />

      <nav className="tabbar" aria-label="Navegação principal">
        {ABAS_INFERIORES.map((t) => (
          <NavLink key={t.rotulo} to={t.para} end={t.fim} className={({ isActive }) => `tb${isActive ? ' on' : ''}`}>
            {({ isActive }) => (
              <>
                <Icone nome={t.icone} tamanho={23} cor={isActive ? '#3E8B22' : '#8C918B'} espessura={1.7} />
                <span>{t.rotulo}</span>
                {t.selo > 0 && <i className="tb-selo" aria-label={`${t.selo} não lidas`}>{t.selo}</i>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
