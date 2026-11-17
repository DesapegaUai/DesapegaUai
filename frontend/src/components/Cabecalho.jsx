import { useState } from 'react'
import { Link } from 'react-router'
import { useRolagem } from '../hooks/useRolagem.js'
import Icone from './Icone.jsx'
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

  return (
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
          />
        </label>

        <button className="cabecalho__local" type="button">
          <Icone nome="home-localizacao" tamanho={20} />
          <span>Viçosa, MG</span>
          <Icone nome="home-seta-baixo" tamanho={18} />
        </button>

        <div className="cabecalho__acoes">
          <button type="button" className="cabecalho__icone" aria-label="Favoritos">
            <Icone nome="home-favorito" tamanho={27} />
          </button>
          <button type="button" className="cabecalho__icone cabecalho__so-desktop" aria-label="Mensagens">
            <Icone nome="home-mensagens" tamanho={27} />
          </button>
          <button type="button" className="cabecalho__icone" aria-label="Minha conta">
            <Icone nome="home-perfil" tamanho={27} />
          </button>
          <button type="button" className="botao-anunciar">
            Anunciar
          </button>
        </div>
      </div>
    </header>
  )
}
