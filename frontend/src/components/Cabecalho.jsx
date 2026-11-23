import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useRolagem } from '../hooks/useRolagem.js'
import CaixaNotificacoes from './CaixaNotificacoes.jsx'
import Icone from './Icone.jsx'
import IconeAtalho from './IconeMarketplace.jsx'
import MenuCidade from './MenuCidade.jsx'
import MenuQueDesce from './MenuQueDesce.jsx'
import SeloMensagens from './SeloMensagens.jsx'
import { posicaoDoMenu, useCidade } from '../services/cidade.js'
import './Cabecalho.css'

// No tablet e no celular o cabeçalho fica preso no topo. Depois deste tanto de rolagem (em px)
// ele encolhe: esconde a linha da cidade para sobrar mais tela para o conteúdo.
const ROLAGEM_PARA_ENCOLHER = 220

export default function Cabecalho({ busca, onBusca }) {
  // Se a página não mandar `busca` e `onBusca`, o campo guarda o texto sozinho.
  const [buscaLocal, setBuscaLocal] = useState('')
  const texto = busca ?? buscaLocal
  const aoDigitar = onBusca ?? setBuscaLocal
  const encolhido = useRolagem(ROLAGEM_PARA_ENCOLHER)
  const navegar = useNavigate()
  const cidade = useCidade()
  const localRef = useRef(null)
  const [menuCidade, setMenuCidade] = useState(null)
  const fecharCidade = useCallback(() => setMenuCidade(null), [])
  // celular e tablet: favoritos, conta, cidade, categorias e Anunciar descem do ☰
  const [topoDoMenu, setTopoDoMenu] = useState(null)
  const burgerRef = useRef(null)
  const fecharMenu = useCallback(() => setTopoDoMenu(null), [])
  function alternarMenu() {
    if (topoDoMenu !== null) { fecharMenu(); return }
    setTopoDoMenu(Math.round(burgerRef.current.closest('header').getBoundingClientRect().bottom))
  }

  // Enter na busca abre a página de resultados
  function buscarAoTeclar(e) {
    if (e.key === 'Enter' && texto.trim()) navegar(`/busca?q=${encodeURIComponent(texto.trim())}`)
  }

  return (
    <>
    <header className={encolhido ? 'cabecalho cabecalho--encolhido' : 'cabecalho'}>
      <div className="cabecalho__barra">
        <Link className="cabecalho__logo" to="/" aria-label="DesapegaUai, página inicial">
          <img src="/img/logo-principal.svg" alt="" width="1221" height="261" />
        </Link>

        <label className="cabecalho__busca">
          <Icone nome="home-busca" tamanho={21} />
          <input
            type="search"
            placeholder="O que você está procurando?"
            aria-label="Buscar anúncios"
            enterKeyHint="search"
            value={texto}
            onChange={(e) => aoDigitar(e.target.value)}
            onKeyDown={buscarAoTeclar}
          />
        </label>

        <button
          className="cabecalho__local"
          type="button"
          ref={localRef}
          aria-haspopup="menu"
          aria-expanded={Boolean(menuCidade)}
          onClick={() => setMenuCidade(menuCidade ? null : posicaoDoMenu(localRef.current))}
        >
          <Icone nome="home-localizacao" tamanho={20} />
          <span>{cidade}, MG</span>
          <Icone nome="home-seta-baixo" tamanho={18} />
        </button>
        {menuCidade && <MenuCidade posicao={menuCidade} ancoraRef={localRef} onFechar={fecharCidade} />}

        <div className="cabecalho__acoes">
          {/* os mesmos atalhos, ícones e cores do cabeçalho das outras telas */}
          <CaixaNotificacoes />
          <button type="button" className="cabecalho__icone cabecalho__so-desktop" aria-label="Favoritos" onClick={() => navegar('/favoritos')}>
            <IconeAtalho nome="favorito" tamanho={25} cor="#3E8B22" />
          </button>
          <button type="button" className="cabecalho__icone tem-selo" aria-label="Mensagens" onClick={() => navegar('/conversas')}>
            <IconeAtalho nome="mensagens" tamanho={25} cor="#3E8B22" />
            <SeloMensagens />
          </button>
          <button type="button" className="cabecalho__icone cabecalho__so-desktop" aria-label="Minha conta" onClick={() => navegar('/perfil')}>
            <IconeAtalho nome="perfil" tamanho={25} cor="#3E8B22" />
          </button>
          <button type="button" className="botao-anunciar cabecalho__so-desktop" onClick={() => navegar('/anunciar')}>
            Anunciar
          </button>
          <button
            type="button"
            className="cabecalho__icone cabecalho__menu"
            ref={burgerRef}
            aria-label={topoDoMenu !== null ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={topoDoMenu !== null}
            aria-controls="menu-que-desce"
            onClick={alternarMenu}
          >
            <IconeAtalho nome={topoDoMenu !== null ? 'fechar' : 'menu'} tamanho={22} cor="#3E8B22" />
          </button>
        </div>
      </div>
    </header>
    <MenuQueDesce topo={topoDoMenu} onFechar={fecharMenu} botaoRef={burgerRef} />
    </>
  )
}
