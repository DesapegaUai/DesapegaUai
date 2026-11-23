import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import MenuLateral from './MenuLateral.jsx';
import MenuQueDesce from './MenuQueDesce.jsx';
import Rodape from './RodapeMarketplace.jsx';
import Icone from './IconeMarketplace.jsx';
import CaixaNotificacoes from './CaixaNotificacoes.jsx';
import { carregarPerfil, usePerfil } from '../services/perfil.js';
import useSair from '../hooks/useSair.js';
import SeloMensagens from './SeloMensagens.jsx';
import '../styles/marketplace-perfil.css';

const logoPrincipal = '/img/logo-principal.svg';

const ABAS_INFERIORES = [
  { rotulo: 'Início', icone: 'inicio', para: '/', fim: true },
  { rotulo: 'Categorias', icone: 'grade', para: '/categoria/casa' },
  { rotulo: 'Favoritos', icone: 'favorito', para: '/favoritos' },
  { rotulo: 'Mensagens', icone: 'mensagens', para: '/conversas' },
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
  const [menuPerfilAberto, setMenuPerfilAberto] = useState(false);
  const buscaRef = useRef(null);
  const menuPerfilRef = useRef(null);
  const fecharMenu = useCallback(() => setMenuAberto(false), []);
  // celular e tablet: o menu desce abaixo do cabeçalho; entre 901 e 1024 px, a gaveta lateral
  const [topoDoMenu, setTopoDoMenu] = useState(null);
  const burgerRef = useRef(null);
  const fecharMenuQueDesce = useCallback(() => setTopoDoMenu(null), []);
  function alternarMenu() {
    if (topoDoMenu !== null) { fecharMenuQueDesce(); return; }
    if (window.matchMedia('(max-width: 900px)').matches) {
      setTopoDoMenu(Math.round(burgerRef.current.closest('header').getBoundingClientRect().bottom));
    } else setMenuAberto(true);
  }
  const fotoPerfil = foto ?? perfil.foto_url;

  // abriu direto em Meus anúncios ou no cadastro: o perfil ainda não veio e o avatar do topo ficava vazio
  useEffect(() => {
    if (!perfil.id) carregarPerfil().catch(() => {});
  }, [perfil.id]);

  useEffect(() => {
    if (!menuPerfilAberto) return undefined;
    const aoClicarFora = (evento) => {
      if (!menuPerfilRef.current?.contains(evento.target)) setMenuPerfilAberto(false);
    };
    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') setMenuPerfilAberto(false);
    };
    document.addEventListener('pointerdown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('pointerdown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [menuPerfilAberto]);


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
      <header className={`painel-topo${buscaAberta ? ' buscando' : ''}`}>
        <button
          type="button"
          className="burger"
          ref={burgerRef}
          aria-label={topoDoMenu !== null ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuAberto || topoDoMenu !== null}
          onClick={alternarMenu}
        >
          <Icone nome={topoDoMenu !== null ? 'fechar' : 'menu'} tamanho={22} cor="#3E8B22" espessura={1.7} />
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
            placeholder="O que você está procurando?"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoComplete="off"
          />
        </form>
        {/* a mesma ordem em todas as telas: Início, avisos, mensagens, favoritos, conta e Anunciar */}
        <div className="tacts">
          <Link className="ic-topo" to="/" aria-label="Início">
            <Icone nome="inicio" tamanho={24} cor="#3E8B22" espessura={1.7} />
          </Link>
          <CaixaNotificacoes />
          <Link className="ic-topo tem-selo" to="/conversas" aria-label="Mensagens">
            <Icone nome="mensagens" tamanho={24} cor="#3E8B22" espessura={1.7} />
            <SeloMensagens />
          </Link>
          <Link className="ic-topo" to="/favoritos" aria-label="Favoritos">
            <Icone nome="favorito" tamanho={24} cor="#3E8B22" espessura={1.7} />
          </Link>
          <div className="me-wrap" ref={menuPerfilRef}>
            <button
              type="button"
              className="me"
              aria-label="Abrir menu do perfil"
              aria-expanded={menuPerfilAberto}
              aria-controls="menu-perfil-cabecalho"
              onClick={() => setMenuPerfilAberto((aberto) => !aberto)}
            >
              <span className="ph">{fotoPerfil ? <img src={fotoPerfil} alt="" /> : perfil.iniciais}</span>
              <Icone nome="seta-baixo" tamanho={18} cor="#6B726C" espessura={1.7} />
            </button>
            {menuPerfilAberto && (
              <div className="me-menu" id="menu-perfil-cabecalho" aria-label="Menu do perfil">
                <div className="me-menu-conta">
                  <span className="me-menu-avatar">
                    {fotoPerfil ? <img src={fotoPerfil} alt="" /> : perfil.iniciais}
                  </span>
                  <span className="me-menu-identidade">
                    <strong>{perfil.nome}</strong>
                    <span>{perfil.email}</span>
                  </span>
                </div>
                <p className="me-menu-titulo">Minha conta</p>
                <nav className="me-menu-links" aria-label="Atalhos da conta">
                  <Link className="me-menu-item" to="/" onClick={() => setMenuPerfilAberto(false)}>
                    <span className="me-menu-item-icone"><Icone nome="inicio" tamanho={19} cor="#3E8B22" /></span>
                    <span><strong>Início</strong><small>Voltar para a página inicial</small></span>
                  </Link>
                  <Link className="me-menu-item" to="/perfil" onClick={() => setMenuPerfilAberto(false)}>
                    <span className="me-menu-item-icone"><Icone nome="perfil" tamanho={19} cor="#3E8B22" /></span>
                    <span><strong>Meu perfil</strong><small>Suas informações e avaliações</small></span>
                  </Link>
                  <Link className="me-menu-item" to="/meus-anuncios" onClick={() => setMenuPerfilAberto(false)}>
                    <span className="me-menu-item-icone"><Icone nome="etiqueta" tamanho={19} cor="#3E8B22" /></span>
                    <span><strong>Meus anúncios</strong><small>Gerencie suas publicações</small></span>
                  </Link>
                  <Link className="me-menu-item" to="/ajuda/perguntas-frequentes" onClick={() => setMenuPerfilAberto(false)}>
                    <span className="me-menu-item-icone"><Icone nome="ajuda" tamanho={19} cor="#3E8B22" /></span>
                    <span><strong>Ajuda e suporte</strong><small>Dúvidas frequentes</small></span>
                  </Link>
                </nav>
                <div className="me-menu-div" role="separator" />
                <button
                  type="button"
                  className="me-menu-sair"
                  onClick={() => {
                    setMenuPerfilAberto(false);
                    sair();
                  }}
                >
                  <span className="me-menu-item-icone"><Icone nome="sair" tamanho={19} cor="#B42318" /></span>
                  <span><strong>Sair da conta</strong><small>Encerrar sua sessão</small></span>
                </button>
              </div>
            )}
          </div>
          <Link className="pub" to="/anunciar" aria-label="Anunciar">
            <Icone nome="mais" tamanho={20} cor="#fff" espessura={2} />
            <span className="rot">Anunciar</span>
          </Link>
        </div>
      </header>

      <MenuLateral
        modo="gaveta"
        aberto={menuAberto}
        onFechar={fecharMenu}
        onSair={sair}
      />
      <MenuQueDesce topo={topoDoMenu} onFechar={fecharMenuQueDesce} botaoRef={burgerRef} />

      <div className="painel-corpo">
        <MenuLateral
          modo="fixo"
          onSair={sair}
        />
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
                {t.para === '/conversas' && <SeloMensagens />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
