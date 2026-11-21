import Icone from './IconeMarketplace.jsx';
import { CATEGORIAS } from '../services/categorias.js';
import '../styles/marketplace-selos.css';

/** Anúncio sem foto: o ícone da categoria sobre o verde-claro do site, no lugar do ícone de imagem. */
export default function SemFoto({ categoria, tamanho = 44 }) {
  const icone = CATEGORIAS.find((c) => c.slug === categoria)?.icone ?? 'etiqueta';
  return (
    <span className="sem-foto" role="img" aria-label="Anúncio sem foto">
      <Icone nome={icone} tamanho={tamanho} cor="#4CA02B" espessura={1.5} />
    </span>
  );
}
