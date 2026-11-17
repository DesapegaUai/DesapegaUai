import Icone from './Icone.jsx'
import '../styles/secoes.css'
import './Categorias.css'

const categorias = [
  { nome: 'Casa', icone: 'categoria-casa' },
  { nome: 'Eletrônicos', icone: 'categoria-eletronicos' },
  { nome: 'Moda', icone: 'categoria-moda' },
  { nome: 'Veículos', icone: 'categoria-veiculos' },
  { nome: 'Livros', icone: 'categoria-livros' },
  { nome: 'Games', icone: 'categoria-games' },
  { nome: 'Serviços', icone: 'categoria-servicos' },
  { nome: 'Outros', icone: 'categoria-outros' },
]

export default function Categorias() {
  return (
    <section className="secao">
      <div className="secao__topo">
        <h2>Explore por categoria</h2>
        <a href="#" className="secao__link">
          Ver todas
          <Icone nome="home-seta-direita" tamanho={20} />
        </a>
      </div>

      <div className="categorias">
        {categorias.map((c) => (
          <a key={c.nome} href="#" className="categoria">
            <Icone nome={`home-${c.icone}`} tamanho={36} />
            <span>{c.nome}</span>
          </a>
        ))}
      </div>
    </section>
  )
}
