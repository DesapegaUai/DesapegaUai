import { Link } from 'react-router';
import Cabecalho from './CabecalhoMarketplace.jsx';
import AbasCategorias from './AbasCategorias.jsx';
import Rodape from './RodapeMarketplace.jsx';
import Icone from './IconeMarketplace.jsx';
import '../styles/marketplace.css';

/**
 * Moldura das telas do marketplace: cabeçalho · [abas] · conteúdo · rodapé · [botão flutuante].
 * Usada por Categorias, Favoritos e Conversas.
 */
export default function LayoutMarketplace({ comAbas = true, comFab = true, classeConteudo = '', children }) {
  return (
    <div className="shell">
      <Cabecalho comCategorias={!comAbas} />
      {comAbas && <AbasCategorias />}
      <main className={`conteudo ${classeConteudo}`.trim()}>{children}</main>
      <Rodape />
      {comFab && (
        <Link className="fab" to="/anunciar">
          <Icone nome="mais" tamanho={20} cor="#fff" />
          Anunciar
        </Link>
      )}
    </div>
  );
}
