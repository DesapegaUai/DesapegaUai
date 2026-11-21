import { useRef } from 'react';
import Icone from './IconeMarketplace.jsx';
import useGaveta from '../hooks/useGaveta.js';

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
 * Painel de filtros (preço e grupos de opções). A distância fica na barra de raio.
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

        <div className="filtros-aplicar">
          <button type="button" className="btn-primario" onClick={onAplicar}>Aplicar filtros</button>
        </div>
      </aside>
    </>
  );
}
