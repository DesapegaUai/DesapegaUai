import { useEffect, useRef, useState } from 'react';
import Icone from './IconeMarketplace.jsx';
import useGaveta from '../hooks/useGaveta.js';
import { ativarGps, definirRaio, nomeDaReferencia, useLocalizacao } from '../services/localizacao.js';

const DISTANCIA_MINIMA = 1;
const DISTANCIA_MAXIMA = 100;

/**
 * Barra de distância: puxa de 1 a 100 km e os anúncios mudam enquanto a pessoa puxa, sem precisar do
 * "Aplicar". Mede a partir da localização da pessoa (se ela deixou) ou da cidade e do bairro escolhidos;
 * sem nenhum dos dois, do centro de Viçosa. Um raio maior (até 300 km) continua no botão de localização
 * do topo; aqui a barra fica no fim e o texto mostra o valor de verdade.
 */
function FiltroDistancia({ id }) {
  const local = useLocalizacao();
  const [puxando, setPuxando] = useState(null); // valor enquanto a pessoa arrasta
  const espera = useRef(null);
  useEffect(() => () => clearTimeout(espera.current), []);

  const valor = puxando ?? Math.min(local.raioKm, DISTANCIA_MAXIMA);
  const mostrado = puxando ?? local.raioKm;
  const fracao = (valor - DISTANCIA_MINIMA) / (DISTANCIA_MAXIMA - DISTANCIA_MINIMA);
  // centro da alça de 22 px: 11 px + fração × (largura − 22 px)
  const preenchido = `calc(11px + ${fracao} * (100% - 22px))`;

  function mudar(km) {
    setPuxando(km);
    // atualiza a busca enquanto puxa, sem pedir a cada pixel
    clearTimeout(espera.current);
    espera.current = setTimeout(() => { definirRaio(km); setPuxando(null); }, 250);
  }

  return (
    <div className="filtro-distancia">
      <div className="grupo-linha">
        <label className="grupo" htmlFor={`${id}-distancia`}>Distância</label>
        <span className="t-rotulo" style={{ color: 'var(--marca)' }}>até {mostrado} km</span>
      </div>
      <div className="slider">
        <input
          id={`${id}-distancia`}
          type="range"
          min={DISTANCIA_MINIMA}
          max={DISTANCIA_MAXIMA}
          step="1"
          value={valor}
          aria-valuetext={`até ${mostrado} quilômetros`}
          style={{ '--preenchido': preenchido }}
          onChange={(e) => mudar(Number(e.target.value))}
        />
      </div>
      <div className="filtro-distancia-ref">
        <span>A partir de <b>{nomeDaReferencia(local)}</b></span>
        {!(local.modo === 'gps' && local.posicao) && (
          <button type="button" className="raio-gps" onClick={ativarGps}>Usar minha localização</button>
        )}
      </div>
    </div>
  );
}

function GrupoOpcoes({ titulo, opcoes, marcadas, onAlternar }) {
  return (
    <fieldset className="filtro-grupo">
      <legend className="grupo">{titulo}</legend>
      <div className="opcoes">
        {opcoes.map((op) => {
          const marcada = marcadas.includes(op.valor);
          return (
            <label key={op.valor} className={`opcao${marcada ? ' on' : ''}`}>
              <input type="checkbox" className="oculto" checked={marcada} onChange={() => onAlternar(op.valor)} />
              <span className="marca-cx" aria-hidden="true">
                <Icone nome="check" tamanho={13} cor="#fff" espessura={2.6} />
              </span>
              <span>{op.rotulo}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const soNumeros = (texto) => texto.replace(/\D/g, '').slice(0, 7);

/**
 * Painel de filtros: preço, grupos de opções e a barra de distância (que vale na hora, sem o "Aplicar").
 * Computador: coluna fixa à esquerda da grade. Tablet: gaveta pela direita. Celular: tela cheia.
 */
export default function PainelFiltros({ id, grupos, filtros, onMudar, onAlternarOpcao, onLimpar, onAplicar, ehGaveta, aberto, onFechar }) {
  const fecharRef = useRef(null);
  const modal = ehGaveta && aberto;
  useGaveta(modal, onFechar, fecharRef);

  return (
    <>
      {ehGaveta && <div className={`filtros-fundo${aberto ? ' visivel' : ''}`} onClick={onFechar} aria-hidden="true" />}

      <aside id={id} className={`filtros${aberto ? ' aberto' : ''}`} aria-label="Filtros" role={modal ? 'dialog' : undefined} aria-modal={modal || undefined}>
        <div className="filtros-topo">
          <h2 className="t-titulo-3">Filtros</h2>
          <button type="button" className="lim" onClick={onLimpar}>Limpar</button>
          {ehGaveta && (
            <button type="button" className="filtros-fecha" aria-label="Fechar filtros" onClick={onFechar} ref={fecharRef}>
              <Icone nome="fechar" tamanho={18} cor="#16281C" />
            </button>
          )}
        </div>

        <div className="div" />
        <fieldset className="filtro-grupo">
          <legend className="grupo">Preço</legend>
          <div className="faixa">
            <div className="campo">
              <input type="text" inputMode="numeric" placeholder="Mín." aria-label="Preço mínimo em reais" value={filtros.precoMin} onChange={(e) => onMudar({ precoMin: soNumeros(e.target.value) })} />
            </div>
            <div className="campo">
              <input type="text" inputMode="numeric" placeholder="Máx." aria-label="Preço máximo em reais" value={filtros.precoMax} onChange={(e) => onMudar({ precoMax: soNumeros(e.target.value) })} />
            </div>
          </div>
        </fieldset>

        {grupos.filter((g) => g.opcoes.length).map((g) => (
          <div key={g.id}>
            <div className="div" />
            <GrupoOpcoes titulo={g.titulo} opcoes={g.opcoes} marcadas={filtros.opcoes[g.id] ?? []} onAlternar={(valor) => onAlternarOpcao(g.id, valor)} />
          </div>
        ))}

        <div className="div" />
        <FiltroDistancia id={id} />

        <div className="filtros-aplicar">
          <button type="button" className="btn-primario" onClick={onAplicar}>Aplicar filtros</button>
        </div>
      </aside>
    </>
  );
}
