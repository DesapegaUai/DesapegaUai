import { Link } from 'react-router';
import Icone from './IconeMarketplace.jsx';
import { formatarPreco } from '../services/formatar.js';

/**
 * Card de anúncio: foto 4:3 (634×470), coração, título, preço e bairro.
 * O card inteiro é clicável (link no título); o coração fica por cima e não abre o anúncio.
 */
export default function CardAnuncioMarketplace({ anuncio, favorito = false, onFavoritar }) {
  const { id, titulo, preco, unidade, bairro, cidade, foto } = anuncio;
  const local = anuncio.local ?? `${bairro}, ${cidade}`;

  return (
    <article className="card">
      <div className="card-foto">
        {foto ? (
          <img src={foto} alt={titulo} width="634" height="470" loading="lazy" decoding="async" />
        ) : (
          <span className="card-sem-foto" role="img" aria-label="Anúncio sem foto">
            <Icone nome="imagem" tamanho={44} espessura={1.4} />
          </span>
        )}
        <button
          type="button"
          className="card-fav"
          aria-label={`${favorito ? 'Remover dos favoritos' : 'Favoritar'} ${titulo}`}
          aria-pressed={favorito}
          onClick={() => onFavoritar?.(id)}
        >
          <Icone
            nome="favorito"
            tamanho={21}
            cor="#3E8B22"
            preenchimento={favorito ? '#3E8B22' : 'none'}
          />
        </button>
      </div>

      <div className="card-info">
        <h3 className="card-titulo">
          <Link className="card-link" to={`/anuncio/${id}`}>{titulo}</Link>
        </h3>
        <div className="card-preco">{formatarPreco(preco, unidade)}</div>
        <div className="card-local">
          <Icone nome="local" tamanho={17} cor="#4CA02B" />
          <span>{local}</span>
        </div>
      </div>
    </article>
  );
}
