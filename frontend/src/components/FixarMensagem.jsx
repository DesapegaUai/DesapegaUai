import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icone from './IconeMarketplace.jsx';
import useGaveta from '../hooks/useGaveta.js';
import '../styles/marketplace-programadas.css';

const DURACOES = [
  { valor: '24h', rotulo: '24 horas' },
  { valor: '7d', rotulo: '7 dias' },
  { valor: '30d', rotulo: '30 dias' },
];

/**
 * "Fixar mensagem" (como no WhatsApp): por quanto tempo a mensagem fica no topo da conversa, para as duas
 * pessoas. Com 3 já fixadas, a janela avisa e pergunta se a mais antiga pode sair.
 * onFixar(duracao, substituir) devolve uma promessa; se falhar com LIMITE_DE_FIXADAS, a janela pergunta.
 */
export default function FixarMensagem({ onFixar, onFechar }) {
  const [duracao, setDuracao] = useState('7d');
  const [substituir, setSubstituir] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fecharRef = useRef(null);
  const fechar = useCallback(() => { if (!enviando) onFechar(); }, [enviando, onFechar]);
  useGaveta(true, fechar, fecharRef);

  async function fixar() {
    setEnviando(true);
    setErro('');
    try {
      await onFixar(duracao, substituir);
    } catch (falha) {
      if (falha.codigo === 'LIMITE_DE_FIXADAS') setSubstituir(true);
      setErro(falha.message);
      setEnviando(false);
    }
  }

  return createPortal(
    <div className="telas-marketplace">
      <div className="pm-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
        <div className="pm-folha" role="dialog" aria-modal="true" aria-labelledby="fx-titulo">
          <span className="pm-alca" aria-hidden="true" />
          <div className="pm-cab">
            <span className="pm-icone" aria-hidden="true"><Icone nome="alfinete" tamanho={20} cor="#fff" espessura={2} /></span>
            <h2 id="fx-titulo">Fixar mensagem</h2>
            <button type="button" className="pm-x" aria-label="Fechar" ref={fecharRef} onClick={fechar}>
              <Icone nome="fechar" tamanho={22} cor="#16281C" espessura={2} />
            </button>
          </div>
          <p className="fx-texto">Por quanto tempo ela fica no topo da conversa? As duas pessoas veem, e dá para desafixar quando quiser.</p>
          <fieldset className="fx-opcoes" disabled={enviando}>
            <legend className="oculto">Por quanto tempo</legend>
            {DURACOES.map((opcao) => (
              <label key={opcao.valor} className={`fx-opcao${duracao === opcao.valor ? ' on' : ''}`}>
                <input type="radio" name="duracao-fixada" value={opcao.valor} checked={duracao === opcao.valor} onChange={() => setDuracao(opcao.valor)} />
                <span>{opcao.rotulo}</span>
              </label>
            ))}
          </fieldset>
          {erro && <p className={substituir ? 'fx-aviso' : 'pm-erro'} role="alert">{erro}</p>}
          <button type="button" className="pm-enviar" disabled={enviando} onClick={fixar}>
            {enviando ? 'Fixando…' : substituir ? 'Tirar a mais antiga e fixar' : 'Fixar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
