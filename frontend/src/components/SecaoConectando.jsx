import Icone from './Icone.jsx'
import './SecaoConectando.css'

const formatarPreco = (valor) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/* `classe` diz em que lugar da foto o card fica (o CSS define a posição de cada uma) */
const cards = [
  { classe: 'rg-bici', titulo: 'Bicicleta Aro 29', preco: 850, local: 'Palmeiras, Ponte Nova', foto: '/img/fotos/bicicleta.webp' },
  { classe: 'rg-sofa', titulo: 'Sofá 2 lugares', preco: 600, local: 'São Domingos, Ubá', foto: '/img/fotos/sofa.webp' },
  { classe: 'rg-iphone', titulo: 'iPhone 13 128GB', preco: 2450, local: 'Centro, Viçosa', foto: '/img/fotos/iphone.webp' },
  { classe: 'rg-mesa', titulo: 'Mesa de escritório', preco: 250, local: 'Centro, Teixeiras', foto: '/img/fotos/mesa.webp' },
]

const pinos = ['rg-p1', 'rg-p2', 'rg-p3', 'rg-p4']

export default function SecaoConectando() {
  return (
    <section className="conecta">
      <div className="rg-grade">
        <div className="rg-cab-txt">
          <div className="rg-sobre">
            <i />
            Viçosa e região
          </div>
          <h2 className="rg-tit">
            Conectando
            <br />
            pessoas da
            <br />
            <span>sua região.</span>
          </h2>
        </div>

        <div className="rg-cab-cta">
          <p className="rg-apoio">Produtos mais perto de você, mais praticidade e uma comunidade mais forte.</p>
          <a className="rg-btn" href="#">
            Ver anúncios perto de mim
            <Icone nome="home-seta-botao" tamanho={19} />
          </a>
        </div>

        {/* Para o leitor de tela, a foto com os cards por cima conta como uma imagem só */}
        <div
          className="rg-caixa"
          role="img"
          aria-label="Foto de Viçosa com anúncios de Viçosa, Ponte Nova, Ubá e Teixeiras"
        >
          <img className="rg-foto" src="/img/fotos/cidade-regiao.webp" alt="" loading="lazy" />
          <div className="rg-veu" />

          {pinos.map((p) => (
            <img key={p} className={`rg-pino ${p}`} src="/img/marcador-mapa.svg" alt="" />
          ))}

          {cards.map((c) => (
            <div key={c.classe} className={`rg-card ${c.classe}`}>
              <img src={c.foto} alt="" loading="lazy" />
              <div className="rg-card-txt">
                <b>{c.titulo}</b>
                <span className="rg-preco">{formatarPreco(c.preco)}</span>
                <span className="rg-local">
                  <Icone nome="home-localizacao-pequeno" tamanho={13} />
                  {c.local}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
