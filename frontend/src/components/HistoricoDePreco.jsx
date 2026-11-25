import { useState } from 'react';
import { formatarPreco } from '../services/formatar.js';

const formatoDia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const dia = (data) => formatoDia.format(data).replace('.', '');

// tamanho do desenho (o SVG estica na largura da caixa)
const LARGURA = 320;
const ALTURA = 104;
const MARGEM = { esquerda: 10, direita: 10, topo: 12, baixo: 12 };

/**
 * Histórico do preço na página do anúncio (aparece quando o preço já mudou): um gráfico em degraus, porque
 * o preço fica igual até o vendedor mudar, com um ponto em cada mudança (o mouse em cima mostra a data e o
 * preço) e a mesma informação em lista embaixo, que o leitor de tela também lê.
 */
export default function HistoricoDePreco({ historico }) {
  const [agora] = useState(() => Date.now()); // o último degrau vai até hoje
  if (!historico || historico.length < 2) return null;
  const pontos = historico.map((p) => ({ preco: Number(p.preco), em: new Date(p.em) }));
  const inicio = pontos[0].em.getTime();
  const fim = Math.max(agora, pontos.at(-1).em.getTime());
  const precos = pontos.map((p) => p.preco);
  const menor = Math.min(...precos);
  const maior = Math.max(...precos);
  const folga = (maior - menor) * 0.18 || maior * 0.1;
  const baixo = menor - folga;
  const alto = maior + folga;

  const x = (tempo) => MARGEM.esquerda + ((tempo - inicio) / Math.max(1, fim - inicio)) * (LARGURA - MARGEM.esquerda - MARGEM.direita);
  const y = (preco) => MARGEM.topo + (1 - (preco - baixo) / (alto - baixo)) * (ALTURA - MARGEM.topo - MARGEM.baixo);

  // degraus: de cada mudança, anda na horizontal até a próxima e sobe ou desce; o último vai até hoje
  let caminho = `M${x(inicio).toFixed(1)},${y(pontos[0].preco).toFixed(1)}`;
  for (const ponto of pontos.slice(1)) caminho += ` H${x(ponto.em.getTime()).toFixed(1)} V${y(ponto.preco).toFixed(1)}`;
  caminho += ` H${x(fim).toFixed(1)}`;

  const primeiro = pontos[0];
  const atual = pontos.at(-1);
  const resumo = `Preço de ${formatarPreco(primeiro.preco)} em ${dia(primeiro.em)} para ${formatarPreco(atual.preco)} hoje, com ${pontos.length - 1} ${pontos.length === 2 ? 'mudança' : 'mudanças'}.`;

  return (
    <section className="det-bloco det-historico" aria-labelledby="det-historico">
      <h2 id="det-historico">Histórico do preço</h2>
      <svg className="hp-grafico" viewBox={`0 0 ${LARGURA} ${ALTURA}`} role="img" aria-label={resumo}>
        {/* grade: só o maior e o menor preço, bem clara */}
        {[maior, menor].map((preco) => (
          <line key={preco} className="hp-grade" x1={MARGEM.esquerda} x2={LARGURA - MARGEM.direita} y1={y(preco)} y2={y(preco)} />
        ))}
        <path className="hp-linha" d={caminho} />
        {pontos.map((ponto, i) => (
          <g key={`${ponto.em.getTime()}-${i}`}>
            <title>{`${dia(ponto.em)}: ${formatarPreco(ponto.preco)}`}</title>
            <circle className="hp-alvo" cx={x(ponto.em.getTime())} cy={y(ponto.preco)} r="12" />
            <circle className="hp-ponto" cx={x(ponto.em.getTime())} cy={y(ponto.preco)} r="4" />
          </g>
        ))}
      </svg>
      <div className="hp-eixo" aria-hidden="true"><span>{dia(primeiro.em)}</span><span>hoje</span></div>
      <ol className="hp-lista">
        {pontos.map((ponto, i) => {
          const antes = pontos[i - 1];
          const direcao = !antes ? '' : ponto.preco < antes.preco ? 'baixou' : 'subiu';
          return (
            <li key={`${ponto.em.getTime()}-${i}`} className={direcao || undefined}>
              <span>{dia(ponto.em)}</span>
              <b>{formatarPreco(ponto.preco)}</b>
              {direcao && <i>{direcao === 'baixou' ? '↓ baixou' : '↑ subiu'}</i>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
