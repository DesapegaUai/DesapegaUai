import { Link } from 'react-router'
import { ACHADOS, linkDoAchado } from '../services/achados.js'
import CardAnuncio from './CardAnuncio.jsx'
import Icone from './Icone.jsx'
import '../styles/secoes.css'
import './Achados.css'

// Deixa o texto em minúsculas e sem acento, para "sofa" encontrar "Sofá".
const simplificar = (texto) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export default function Achados({ busca = '' }) {
  const termo = simplificar(busca.trim())
  const filtrados = ACHADOS.filter((a) => simplificar(a.titulo).includes(termo))

  return (
    <section className="secao achados">
      <div className="secao__topo">
        <div className="achados__titulos">
          <h2>Achados perto de você</h2>
          <Icone nome="home-localizacao" tamanho={21} />
          <span className="achados__sub">Anúncios na sua região</span>
        </div>
        <Link to="/busca" className="secao__link">
          Ver todos os anúncios
          <Icone nome="home-seta-direita" tamanho={20} />
        </Link>
      </div>

      {filtrados.length === 0 ? (
        <p className="achados__vazio">Nenhum anúncio encontrado para "{busca.trim()}".</p>
      ) : (
        <div className="lista-anuncios">
          {filtrados.map((a) => (
            <CardAnuncio key={a.id} anuncio={a} link={linkDoAchado(a)} />
          ))}
        </div>
      )}
    </section>
  )
}
