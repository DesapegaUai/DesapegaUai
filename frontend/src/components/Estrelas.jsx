import { useState } from 'react';
import Icone from './IconeMarketplace.jsx';
import { ROTULOS_NOTA } from '../services/avaliacoes.js';
import '../styles/marketplace-avaliacao.css';

const CINCO = [1, 2, 3, 4, 5];

/** Mostra a nota com estrelas preenchidas na proporção certa (4,5 = quatro e meia). */
export function Estrelas({ nota, tamanho = 16 }) {
  const pct = `${(Math.max(0, Math.min(5, nota)) / 5) * 100}%`;
  return (
    <span className="estrelas-nota" aria-hidden="true">
      <span className="fundo">
        {CINCO.map((n) => <Icone key={n} nome="estrela" tamanho={tamanho} cor="none" preenchimento="#DADDD6" espessura={0} />)}
      </span>
      <span className="cheia" style={{ width: pct }}>
        {CINCO.map((n) => <Icone key={n} nome="estrela" tamanho={tamanho} cor="none" preenchimento="#4CA02B" espessura={0} />)}
      </span>
    </span>
  );
}

/** Escolha da nota de 1 a 5 (botões de opção, funciona com teclado e leitor de tela). */
export function EscolherNota({ valor, onMudar, nome = 'nota' }) {
  const [sobre, setSobre] = useState(0);
  const mostrar = sobre || valor;
  return (
    <fieldset className="aval-escolha" onMouseLeave={() => setSobre(0)}>
      <legend className="oculto">Sua nota, de 1 a 5 estrelas</legend>
      <div className="aval-estrelas">
        {CINCO.map((n) => (
          <label key={n} onMouseEnter={() => setSobre(n)} className={n <= mostrar ? 'on' : undefined}>
            <input className="oculto" type="radio" name={nome} value={n} checked={valor === n} onChange={() => onMudar(n)} />
            <Icone nome="estrela" tamanho={36} cor={n <= mostrar ? '#4CA02B' : '#C9CDC5'} preenchimento={n <= mostrar ? '#4CA02B' : 'none'} espessura={1.5} />
            <span className="oculto">{n} {n === 1 ? 'estrela' : 'estrelas'} — {ROTULOS_NOTA[n]}</span>
          </label>
        ))}
      </div>
      <span className="aval-rotulo" aria-hidden="true">{mostrar ? ROTULOS_NOTA[mostrar] : 'Toque nas estrelas'}</span>
    </fieldset>
  );
}
