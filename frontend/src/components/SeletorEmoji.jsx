import { useEffect, useRef, useState } from 'react';

// Emojis mais usados numa negociação, em 4 grupos (sem biblioteca externa).
const GRUPOS = [
  {
    id: 'carinhas',
    titulo: 'Carinhas',
    aba: '😀',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '🙂', '😉', '😍', '🥰', '😘', '😋', '😎',
      '🤩', '🥳', '🤔', '🤗', '🙃', '😌', '😴', '😮', '😢', '😭', '😤', '😡', '😬', '🙄', '😱', '🤯'],
  },
  {
    id: 'gestos',
    titulo: 'Gestos',
    aba: '👍',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤙', '👋', '🙏', '👏', '🙌', '💪', '🤝', '👊', '✋', '🖐️', '🤘',
      '👉', '👈', '☝️', '👆', '👇', '🫶', '🤌', '✍️'],
  },
  {
    id: 'simbolos',
    titulo: 'Símbolos',
    aba: '❤️',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '✅', '❌', '⭐', '✨', '🔥', '🎉', '💬',
      '❗', '❓', '⚠️', '🆗', '🆕', '💲', '💰', '📍'],
  },
  {
    id: 'objetos',
    titulo: 'Objetos',
    aba: '📦',
    emojis: ['🏠', '🛋️', '🛏️', '🪑', '📱', '💻', '🖥️', '🎧', '📺', '📷', '🎮', '📚', '📖', '🚲', '🛵', '🚗',
      '👕', '👗', '👟', '🎒', '🔧', '🛠️', '📦', '🚚', '🕐', '📅', '🔑', '🧾'],
  },
];

/**
 * Painel de emojis do chat. Fecha com Esc ou clicando fora.
 * `ignorarRef`: o botão que abre o painel (clicar nele não conta como "fora").
 */
export default function SeletorEmoji({ id, onEscolher, onFechar, ignorarRef }) {
  const [grupo, setGrupo] = useState(GRUPOS[0].id);
  const painelRef = useRef(null);
  const atual = GRUPOS.find((g) => g.id === grupo);

  useEffect(() => {
    const aoClicarFora = (e) => {
      if (painelRef.current?.contains(e.target)) return;
      if (ignorarRef?.current?.contains(e.target)) return;
      onFechar();
    };
    const aoTeclar = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onFechar(true); }
    };
    document.addEventListener('pointerdown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('pointerdown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [onFechar, ignorarRef]);

  return (
    <div className="emoji-painel" id={id} ref={painelRef} role="dialog" aria-label="Escolher emoji">
      <div className="emoji-abas" role="tablist" aria-label="Grupos de emoji">
        {GRUPOS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            className={`emoji-aba${g.id === grupo ? ' on' : ''}`}
            aria-selected={g.id === grupo}
            aria-label={g.titulo}
            title={g.titulo}
            onClick={() => setGrupo(g.id)}
          >
            {g.aba}
          </button>
        ))}
      </div>
      <p className="emoji-titulo">{atual.titulo}</p>
      <div className="emoji-grade" role="tabpanel" aria-label={atual.titulo}>
        {atual.emojis.map((e) => (
          <button key={e} type="button" onClick={() => onEscolher(e)} aria-label={`Inserir ${e}`}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
