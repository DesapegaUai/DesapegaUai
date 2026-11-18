import Icone from './IconeMarketplace.jsx';

/** Paginação: mostra 3 números por vez + setas (como o protótipo: 1 2 3 ›). */
export default function Paginacao({ pagina, totalPaginas, onMudar }) {
  if (totalPaginas <= 1) return null;

  const primeira = Math.max(1, Math.min(pagina - 1, totalPaginas - 2));
  const numeros = [];
  for (let n = primeira; n < primeira + 3 && n <= totalPaginas; n += 1) numeros.push(n);

  return (
    <nav className="paginacao" aria-label="Paginação">
      {pagina > 1 && (
        <button type="button" className="pag" aria-label="Página anterior" onClick={() => onMudar(pagina - 1)}>
          <Icone nome="seta-esquerda" tamanho={19} cor="#3E8B22" />
        </button>
      )}
      {numeros.map((n) => (
        <button
          key={n}
          type="button"
          className={`pag${n === pagina ? ' on' : ''}`}
          aria-label={`Página ${n}`}
          aria-current={n === pagina ? 'page' : undefined}
          onClick={() => onMudar(n)}
        >
          {n}
        </button>
      ))}
      {pagina < totalPaginas && (
        <button type="button" className="pag" aria-label="Próxima página" onClick={() => onMudar(pagina + 1)}>
          <Icone nome="seta-direita" tamanho={19} cor="#3E8B22" />
        </button>
      )}
    </nav>
  );
}
