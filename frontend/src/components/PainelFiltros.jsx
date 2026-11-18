import { Fragment, useRef } from 'react';
import Icone from './IconeMarketplace.jsx';
import { BAIRROS, DISTANCIA } from '../services/anuncios.js';
import useGaveta from '../hooks/useGaveta.js';

function Opcao({ rotulo, marcada, onAlternar }) {
  return (
    <label className={`opcao${marcada ? ' on' : ''}`}>
      <input type="checkbox" className="oculto" checked={marcada} onChange={onAlternar} />
      <span className="marca-cx" aria-hidden="true">
        <Icone nome="check" tamanho={13} cor="#fff" espessura={2.6} />
      </span>
      <span>{rotulo}</span>
    </label>
  );
}

function GrupoOpcoes({ titulo, opcoes, marcadas, onAlternar }) {
  return (
    <fieldset className="filtro-grupo">
      <legend className="grupo">{titulo}</legend>
      <div className="opcoes">
        {opcoes.map((op) => (
          <Opcao key={op} rotulo={op} marcada={marcadas.includes(op)} onAlternar={() => onAlternar(op)} />
        ))}
      </div>
    </fieldset>
  );
}

const soNumeros = (texto) => texto.replace(/\D/g, '').slice(0, 7);

/**
 * Painel de filtros.
 * Computador: coluna fixa de 320 px à esquerda da grade.
 * Tablet: gaveta de 380 px que entra pela direita. Celular: tela cheia.
 */
export default function PainelFiltros({
  id,
  pagina,
  filtros,
  onMudar,
  onAlternarOpcao,
  onLimpar,
  onAplicar,
  ehGaveta,
  aberto,
  onFechar,
}) {
  const fecharRef = useRef(null);
  const modal = ehGaveta && aberto;

  // Gaveta aberta: foco no "fechar", Esc fecha, página de trás não rola
  useGaveta(modal, onFechar, fecharRef);

  const { min, max } = DISTANCIA;
  const fracao = (filtros.distancia - min) / (max - min);
  // centro da alça de 22 px: 11 px + fração × (largura − 22 px)
  const preenchido = `calc(11px + ${fracao} * (100% - 22px))`;

  return (
    <>
      {ehGaveta && (
        <div className={`filtros-fundo${aberto ? ' visivel' : ''}`} onClick={onFechar} aria-hidden="true" />
      )}

      <aside
        id={id}
        className={`filtros${aberto ? ' aberto' : ''}`}
        aria-label="Filtros"
        role={modal ? 'dialog' : undefined}
        aria-modal={modal || undefined}
      >
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
              <input
                type="text"
                inputMode="numeric"
                placeholder="Mín."
                aria-label="Preço mínimo em reais"
                value={filtros.precoMin}
                onChange={(e) => onMudar({ precoMin: soNumeros(e.target.value) })}
              />
            </div>
            <div className="campo">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Máx."
                aria-label="Preço máximo em reais"
                value={filtros.precoMax}
                onChange={(e) => onMudar({ precoMax: soNumeros(e.target.value) })}
              />
            </div>
          </div>
        </fieldset>

        {pagina.gruposFiltro.map((g) => (
          <Fragment key={g.id}>
            <div className="div" />
            <GrupoOpcoes
              titulo={g.titulo}
              opcoes={g.ligadoAosChips ? pagina.subcategorias : g.opcoes}
              marcadas={filtros.opcoes[g.id]}
              onAlternar={(op) => onAlternarOpcao(g.id, op)}
            />
          </Fragment>
        ))}

        <div className="div" />
        <GrupoOpcoes
          titulo="Bairro"
          opcoes={BAIRROS}
          marcadas={filtros.opcoes.bairro}
          onAlternar={(op) => onAlternarOpcao('bairro', op)}
        />

        <div className="div" />
        <div className="grupo-linha">
          <label className="grupo" htmlFor={`${id}-distancia`}>Distância</label>
          <span className="t-rotulo" style={{ color: 'var(--marca)' }}>até {filtros.distancia} km</span>
        </div>
        <div className="slider">
          <input
            id={`${id}-distancia`}
            type="range"
            min={min}
            max={max}
            step="1"
            value={filtros.distancia}
            aria-valuetext={`até ${filtros.distancia} quilômetros`}
            style={{ '--preenchido': preenchido }}
            onChange={(e) => onMudar({ distancia: Math.max(1, Number(e.target.value)) })}
          />
        </div>

        <div className="filtros-aplicar">
          <button type="button" className="btn-primario" onClick={onAplicar}>Aplicar filtros</button>
        </div>
      </aside>
    </>
  );
}
