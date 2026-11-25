import { useState } from 'react';
import Icone from './IconeMarketplace.jsx';

function duracaoEmTexto(segundos = 0) {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// o que aparece na faixa: o texto, ou o tipo do anexo
function previaDaFixada(mensagem) {
  if (mensagem.texto) return mensagem.texto;
  if (mensagem.foto) return '📷 Foto';
  if (mensagem.video) return '🎥 Vídeo';
  if (mensagem.audio) return `🎤 Áudio (${duracaoEmTexto(mensagem.audio.segundos)})`;
  return 'Mensagem';
}

/**
 * Faixa das mensagens fixadas no topo da conversa (como no WhatsApp): mostra a mais nova; tocar leva até
 * ela na conversa e a faixa passa para a próxima. Os tracinhos do lado mostram qual das fixadas é.
 */
export default function MensagensFixadas({ fixadas, onIr }) {
  const [vez, setVez] = useState(0);
  if (!fixadas.length) return null;
  const total = fixadas.length;
  const posicao = vez % total;
  const ordem = [...fixadas].reverse(); // a mais nova primeiro
  const atual = ordem[posicao];
  const previa = previaDaFixada(atual.mensagem);

  return (
    <button
      type="button"
      className="conv-fixadas"
      onClick={() => { onIr(atual.mensagem_id); setVez((v) => (v + 1) % total); }}
      aria-label={`Mensagem fixada${total > 1 ? ` ${posicao + 1} de ${total}` : ''}: ${previa}. Ir até ela na conversa`}
    >
      {total > 1 && (
        <span className="conv-fixadas-barras" aria-hidden="true">
          {ordem.map((f, i) => <i key={f.mensagem_id} className={i === posicao ? 'on' : undefined} />)}
        </span>
      )}
      <span className="conv-fixadas-icone" aria-hidden="true"><Icone nome="alfinete" tamanho={17} cor="#3E8B22" espessura={2} /></span>
      <span className="conv-fixadas-txt" aria-hidden="true">
        <small>{total > 1 ? `Mensagem fixada ${posicao + 1} de ${total}` : 'Mensagem fixada'}</small>
        <b>{previa}</b>
      </span>
    </button>
  );
}
