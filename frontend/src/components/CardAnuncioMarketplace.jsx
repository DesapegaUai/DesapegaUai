import { Link } from 'react-router';
import Icone from './IconeMarketplace.jsx';
import SemFoto from './SemFoto.jsx';
import { formatarPreco } from '../services/formatar.js';
import { textoDaFaixa } from '../services/comparador.js';

const formatoKm = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/**
 * Card de anúncio: foto 4:3 (634×470), coração, título, preço, bairro e distância.
 * O card inteiro é clicável (link no título); o coração fica por cima e não abre o anúncio.
 * A distância vem calculada pela API (em linha reta, a partir da sua referência).
 * faixa (na busca): o preço comparado com a média dos parecidos, pela IA do DesapegaUai.
 */
export default function CardAnuncioMarketplace({ anuncio, favorito = false, onFavoritar, selo = null, faixa = null }) {
  const { id, titulo, preco, unidade, bairro, cidade, foto } = anuncio;
  const local = anuncio.local ?? [bairro, cidade].filter(Boolean).join(', ');
  const distancia = typeof anuncio.distancia_km === 'number'
    ? (anuncio.distancia_km < 0.1 ? 'a menos de 100 m' : `a ${formatoKm.format(anuncio.distancia_km)} km`)
    : null;

  return (
    <article className="card">
      <div className="card-foto">
        {foto ? (
          <img src={foto} alt={titulo} width="634" height="470" loading="lazy" decoding="async" />
        ) : (
          <SemFoto categoria={anuncio.categoria} />
        )}
        {anuncio.status === 'reservado' && <span className="card-etiqueta">Reservado</span>}
        {selo && <span className="card-etiqueta vizinha">{selo}</span>}
        {onFavoritar && (
          <button
            type="button"
            className="card-fav"
            aria-label={`${favorito ? 'Remover dos favoritos' : 'Favoritar'} ${titulo}`}
            aria-pressed={favorito}
            onClick={() => onFavoritar(anuncio)}
          >
            <Icone nome="favorito" tamanho={21} cor="#3E8B22" preenchimento={favorito ? '#3E8B22' : 'none'} />
          </button>
        )}
      </div>

      <div className="card-info">
        <h3 className="card-titulo">
          <Link className="card-link" to={`/anuncio/${id}`}>{titulo}</Link>
        </h3>
        <div className="card-preco">
          {formatarPreco(preco, unidade)}
          {faixa && <span className={`card-faixa ${faixa.tipo}`}>{textoDaFaixa(faixa)}</span>}
        </div>
        <div className="card-local">
          <Icone nome="local" tamanho={17} cor="#4CA02B" />
          <span>{local}{distancia && <> · <b className="card-distancia">{distancia}</b></>}</span>
        </div>
      </div>
    </article>
  );
}
