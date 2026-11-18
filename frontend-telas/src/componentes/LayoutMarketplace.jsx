import { Link } from 'react-router-dom';
import Cabecalho from './Cabecalho';
import AbasCategorias from './AbasCategorias';
import Rodape from './Rodape';
import Icone from './Icone';
import '../estilos/marketplace.css';

/**
 * Moldura das telas do marketplace: cabeçalho · [abas] · conteúdo · rodapé · [botão flutuante].
 * Usada por Categorias, Favoritos e Conversas.
 */
export default function LayoutMarketplace({ comAbas = true, comFab = true, classeConteudo = '', children }) {
  return (
    <div className="shell">
      <Cabecalho />
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
