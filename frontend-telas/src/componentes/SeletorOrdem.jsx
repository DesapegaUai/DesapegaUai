import Icone from './Icone';

/**
 * Pílula "Ordenar por: Mais recentes ⌄".
 * Um <select> nativo invisível cobre a pílula: mantém o visual do protótipo,
 * é acessível e abre o seletor do próprio sistema no celular.
 */
export default function SeletorOrdem({ opcoes, valor, onMudar }) {
  const rotulo = opcoes.find((o) => o.valor === valor)?.rotulo;
  return (
    <div className="ordenar">
      <span className="r" aria-hidden="true">Ordenar por:</span>
      <span className="v" aria-hidden="true">{rotulo}</span>
      <Icone nome="seta-baixo" tamanho={18} cor="#4CA02B" />
      <select aria-label="Ordenar por" value={valor} onChange={(e) => onMudar(e.target.value)}>
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    </div>
  );
}
