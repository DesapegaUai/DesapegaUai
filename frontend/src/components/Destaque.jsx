import { useNavigate } from 'react-router'
import Icone from './Icone.jsx'
import './Destaque.css'

export default function Destaque() {
  const navegar = useNavigate()

  return (
    <section className="destaque">
      <div className="destaque__texto">
        <h1>
          Desapegue do que não usa.
          <br />
          <span>Encontre</span> o que você procura.
        </h1>
        <p>Compre, venda e desapegue com pessoas da sua região.</p>

        <div className="destaque__botoes">
          <button type="button" className="btn-verde" onClick={() => navegar('/anunciar')}>
            Anunciar agora
            <Icone nome="home-seta-direita" tamanho={22} />
          </button>
          <button type="button" className="btn-contorno" onClick={() => navegar('/ajuda/como-funciona')}>
            Como funciona?
          </button>
        </div>
      </div>

      <img
        className="destaque__imagem"
        src="/img/caixa-desapegauai.webp?v=3"
        alt="Caixa DesapegaUai com objetos"
        width="1152"
        height="932"
      />
    </section>
  )
}
