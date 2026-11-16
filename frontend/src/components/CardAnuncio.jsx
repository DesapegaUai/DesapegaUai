import { useState } from 'react'
import './CardAnuncio.css'

// Preço no formato do site: "R$ 1.250", sem centavos.
const formatarPreco = (valor) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function CardAnuncio({ anuncio }) {
  const [favorito, setFavorito] = useState(false)

  return (
    <article className="card-anuncio">
      <div className="card-anuncio__foto">
        <img src={anuncio.foto} alt={anuncio.titulo} width="262" height="235" loading="lazy" />
        <button
          type="button"
          className={favorito ? 'card-anuncio__fav ativo' : 'card-anuncio__fav'}
          aria-label={favorito ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
          aria-pressed={favorito}
          onClick={() => setFavorito(!favorito)}
        >
          {/* O coração é desenhado aqui (e não pelo sprite) para poder ser pintado quando está favoritado */}
          <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20.8 4.9a5.4 5.4 0 0 0-7.7 0l-1.1 1.1-1.1-1.1a5.4 5.4 0 1 0-7.7 7.7l8.8 8.7 8.8-8.7a5.4 5.4 0 0 0 0-7.7Z" />
          </svg>
        </button>
      </div>

      <div className="card-anuncio__info">
        <h3 title={anuncio.titulo}>{anuncio.titulo}</h3>
        <p className="card-anuncio__preco">{formatarPreco(anuncio.preco)}</p>
        <p className="card-anuncio__local">{anuncio.local}</p>
      </div>
    </article>
  )
}
