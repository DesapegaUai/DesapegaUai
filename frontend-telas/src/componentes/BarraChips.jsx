import Icone from './Icone';
import SeletorOrdem from './SeletorOrdem';
import { ORDENACOES } from '../dados/anuncios';

/**
 * Linha acima da grade nas categorias: [Filtros (tablet/celular)] + chips de subcategoria · "Ordenar por".
 * No celular os chips rolam na horizontal e o "Ordenar por" ocupa a largura toda embaixo.
 */
export default function BarraChips({
  subcategorias,
  ativas,
  onAlternar,
  ordem,
  onOrdenar,
  idPainel,
  painelAberto,
  qtdFiltros,
  onAbrirFiltros,
}) {
  return (
    <div className="barra-chips">
      <div className="chips">
        <button
          type="button"
          className="abre-filtros"
          aria-controls={idPainel}
          aria-expanded={painelAberto}
          onClick={onAbrirFiltros}
        >
          <Icone nome="filtros" tamanho={19} cor="#3E8B22" />
          Filtros
          {qtdFiltros > 0 && <span className="qtd" aria-label={`${qtdFiltros} ativos`}>{qtdFiltros}</span>}
        </button>
        {subcategorias.map((sub) => {
          const on = ativas.includes(sub);
          return (
            <button
              key={sub}
              type="button"
              className={`chip${on ? ' on' : ''}`}
              aria-pressed={on}
              onClick={() => onAlternar(sub)}
            >
              <span>{sub}</span>
            </button>
          );
        })}
      </div>

      <SeletorOrdem opcoes={ORDENACOES} valor={ordem} onMudar={onOrdenar} />
    </div>
  );
}
