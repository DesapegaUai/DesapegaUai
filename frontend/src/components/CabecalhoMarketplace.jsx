import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Icone from './IconeMarketplace.jsx';
import MenuQueDesce from './MenuQueDesce.jsx';
import AtalhoCategorias from './AtalhoCategorias.jsx';
import MenuCidade from './MenuCidade.jsx';
import CaixaNotificacoes from './CaixaNotificacoes.jsx';
import SeloMensagens from './SeloMensagens.jsx';
import { posicaoDoMenu } from '../services/cidade.js';
import { nomeDaReferencia, useLocalizacao } from '../services/localizacao.js';

const logoPrincipal = '/img/logo-principal.svg';

/**
 * Cabeçalho do marketplace.
 * Computador: logo · busca · local · favoritos/mensagens/perfil · Anunciar
 * Tablet: igual, com busca menor e local só com ícone
 * Celular e tablet: logo · sininho · mensagens · ☰, com a busca na linha de baixo (o "Anunciar" também vira o botão flutuante)
 *
 * ☰ abre o menu que desce (favoritos, conta, cidade, categorias e Anunciar).
 * O botão de localização abre o menu de localização (GPS, raio, cidade e bairro).
 */
export default function CabecalhoMarketplace({ comCategorias = false }) {
  const local = useLocalizacao();
  const cidade = `${nomeDaReferencia(local)} · ${local.raioKm} km`;
  const localRef = useRef(null);
  const [menuCidade, setMenuCidade] = useState(null);
  const fecharCidade = useCallback(() => setMenuCidade(null), []);
  const navegar = useNavigate();
  const [termo, setTermo] = useState('');
  const [topoDoMenu, setTopoDoMenu] = useState(null); // onde o cabeçalho termina (null = menu fechado)
  const burgerRef = useRef(null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const campoRef = useRef(null);
  const fecharMenu = useCallback(() => setTopoDoMenu(null), []);

  function alternarMenu() {
    if (topoDoMenu !== null) { fecharMenu(); return; }
    setTopoDoMenu(Math.round(burgerRef.current.closest('header').getBoundingClientRect().bottom));
  }

  function buscar(evento) {
    evento.preventDefault();
    const q = termo.trim();
    if (q) navegar(`/busca?q=${encodeURIComponent(q)}`);
  }

  function alternarBusca() {
    const abrir = !buscaAberta;
    setBuscaAberta(abrir);
    if (abrir) setTimeout(() => campoRef.current?.focus(), 0);
  }

  return (
    <>
      <header className={`cab${buscaAberta ? ' buscando' : ''}`}>
        <button
          type="button"
          className="cab-burger"
          ref={burgerRef}
          aria-label={topoDoMenu !== null ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={topoDoMenu !== null}
          aria-controls="menu-que-desce"
          onClick={alternarMenu}
        >
          <Icone nome={topoDoMenu !== null ? 'fechar' : 'menu'} tamanho={22} cor="#3E8B22" />
        </button>

        <Link to="/" className="cab-logo-link" aria-label="DesapegaUai — página inicial">
          <img className="cab-logo" src={logoPrincipal} alt="DesapegaUai" width="215" height="46" />
        </Link>

        <form className="busca" role="search" onSubmit={buscar}>
          <Icone nome="busca" tamanho={21} cor="#4CA02B" espessura={1.7} />
          <label htmlFor="busca-cabecalho" className="oculto">Buscar anúncios</label>
          <input
            id="busca-cabecalho"
            ref={campoRef}
            type="search"
            placeholder="O que você está procurando?"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
        </form>

        <button
          type="button"
          className="cab-lupa"
          aria-label={buscaAberta ? 'Fechar busca' : 'Buscar'}
          aria-expanded={buscaAberta}
          onClick={alternarBusca}
        >
          <Icone nome={buscaAberta ? 'fechar' : 'busca'} tamanho={21} cor="#3E8B22" espessura={1.7} />
        </button>

        <button
          type="button"
          className="local"
          aria-label={`Localização: ${cidade}. Trocar`}
          aria-haspopup="menu"
          aria-expanded={Boolean(menuCidade)}
          title={cidade}
          ref={localRef}
          onClick={() => setMenuCidade(menuCidade ? null : posicaoDoMenu(localRef.current))}
        >
          {/* só o pino, do tamanho dos outros atalhos; o lugar e a distância aparecem ao passar o mouse e no menu */}
          <Icone nome="local" tamanho={24} cor="#3E8B22" espessura={1.7} />
        </button>
        {menuCidade && <MenuCidade posicao={menuCidade} ancoraRef={localRef} onFechar={fecharCidade} />}

        <nav className="cab-icones" aria-label="Atalhos">
          <Link className="cab-icone" to="/" aria-label="Início" title="Início">
            <Icone nome="inicio" tamanho={25} cor="#3E8B22" />
          </Link>
          {/* nas telas sem a barra de abas, as categorias ficam a um clique daqui */}
          {comCategorias && <AtalhoCategorias />}
          <CaixaNotificacoes />
          <Link className="cab-icone" to="/favoritos" aria-label="Favoritos">
            <Icone nome="favorito" tamanho={25} cor="#3E8B22" />
          </Link>
          <Link className="cab-icone tem-selo" to="/conversas" aria-label="Mensagens">
            <Icone nome="mensagens" tamanho={25} cor="#3E8B22" />
            <SeloMensagens />
          </Link>
          <Link className="cab-icone" to="/perfil" aria-label="Perfil">
            <Icone nome="perfil" tamanho={25} cor="#3E8B22" />
          </Link>
        </nav>

        <Link className="btn-anunciar" to="/anunciar">Anunciar</Link>
      </header>

      <MenuQueDesce topo={topoDoMenu} onFechar={fecharMenu} botaoRef={burgerRef} />
    </>
  );
}
