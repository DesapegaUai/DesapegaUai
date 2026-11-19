import { Link } from 'react-router'
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
        <Link to="/categoria/casa" className="secao__link">
          Ver todas
          <Icone nome="home-seta-direita" tamanho={20} />
        </Link>
      </div>

      <div className="categorias">
        {categorias.map((c) => (
          <Link key={c.nome} to={`/categoria/${c.icone.replace('categoria-', '')}`} className="categoria">
            <Icone nome={`home-${c.icone}`} tamanho={36} />
            <span>{c.nome}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
