import { Link } from 'react-router'
import useFavoritar from '../hooks/useFavoritar.js'
import useFeedProximo from '../hooks/useFeedProximo.js'
import CardAnuncio from './CardAnuncio.jsx'
import Icone from './Icone.jsx'
import '../styles/secoes.css'
import './Achados.css'

// Anúncios mais recentes perto da referência da pessoa (GPS ou cidade escolhida), vindos da API.
export default function Achados({ busca = '' }) {
  const termo = busca.trim()
  const feed = useFeedProximo({ busca: termo || undefined, ordenar: 'recentes', por_pagina: 8 })
  const favoritarAnuncio = useFavoritar({ aoMudar: feed.marcarFavorito })
  const itens = feed.dados?.itens ?? []

  // sem anúncio por perto (ou ainda carregando), a seção inteira não aparece: nada de texto solto na home
  if (itens.length === 0) return null

  return (
    <section className="secao achados">
      <div className="secao__topo">
        <div className="achados__titulos">
          <h2>Achados perto de você</h2>
        </div>
        <Link to={termo ? `/busca?q=${encodeURIComponent(termo)}` : '/busca'} className="secao__link">
          Ver todos os anúncios
          <Icone nome="home-seta-direita" tamanho={20} />
        </Link>
      </div>

      <div className="lista-anuncios">
        {itens.map((a) => (
          <CardAnuncio key={a.id} anuncio={a} link={`/anuncio/${a.id}`} onFavoritar={favoritarAnuncio} />
        ))}
      </div>
    </section>
  )
}
