import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import CardAnuncio from '../components/CardAnuncioMarketplace.jsx';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import SeletorOrdem from '../components/SeletorOrdem.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import { ORDENACOES } from '../services/anuncios.js';
import { pesquisarAnuncios } from '../services/catalogo.js';
import { CATEGORIAS, caminhoCategoria } from '../services/categorias.js';
import { useCidade } from '../services/cidade.js';
import { formatarQuantidade } from '../services/formatar.js';
import '../styles/marketplace-busca.css';

const ORDENS = ORDENACOES.filter((o) => o.valor !== 'proximos');

/** Resultado da busca do cabeçalho: /busca?q=sofa */
export default function Busca() {
  const [parametros] = useSearchParams();
  const termo = (parametros.get('q') ?? '').trim();
  const [ordem, setOrdem] = useState('recentes');
  const cidade = useCidade();
  const [favoritos, setFavoritos] = useState(() => new Set());
  const resultado = useMemo(() => pesquisarAnuncios(termo, ordem, cidade), [termo, ordem, cidade]);

  useEffect(() => {
    document.title = termo ? `DesapegaUai — Busca por ${termo}` : 'DesapegaUai — Todos os anúncios';
  }, [termo]);

  function alternarFavorito(id) {
    setFavoritos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  return (
    <LayoutMarketplace>
      <nav aria-label="Você está em">
        <ol className="trilha">
          <li><Link to="/">Início</Link></li>
          <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>
          <li><span className="at" aria-current="page">Busca</span></li>
        </ol>
      </nav>

      <div className="bus-cabeca">
        <div className="titulo-pagina">
          <h1 className="t-titulo-1">{termo ? <>Resultados para “{termo}”</> : 'Todos os anúncios'}</h1>
          <span className="cont" role="status">{formatarQuantidade(resultado.length)} em {cidade} e região</span>
        </div>
        {resultado.length > 1 && <SeletorOrdem opcoes={ORDENS} valor={ordem} onMudar={setOrdem} />}
      </div>

      {resultado.length ? (
        <div className="bus-grade">
          {resultado.map((a) => (
            <CardAnuncio key={a.id} anuncio={a} favorito={favoritos.has(a.id)} onFavoritar={alternarFavorito} />
          ))}
        </div>
      ) : (
        <div className="bus-vazio">
          <Icone nome="busca" tamanho={42} cor="#4CA02B" />
          <h2>{termo ? 'Nenhum anúncio encontrado' : `Ainda não há anúncios em ${cidade}`}</h2>
          <p>{termo ? 'Confira a escrita ou explore as categorias abaixo.' : 'Por enquanto, os anúncios são de Viçosa. Explore as categorias abaixo.'}</p>
          <ul>
            {CATEGORIAS.map((c) => <li key={c.slug}><Link to={caminhoCategoria(c.slug)}>{c.nome}</Link></li>)}
          </ul>
        </div>
      )}
    </LayoutMarketplace>
  );
}
