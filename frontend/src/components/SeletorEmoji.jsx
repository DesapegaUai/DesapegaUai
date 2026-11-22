import { useEffect, useRef, useState } from 'react';
// os emojis com os nomes em português (para a busca), servidos pelo próprio site
import { DADOS_EM_PORTUGUES, LOCAL_DOS_EMOJIS } from '../services/emojis.js';

/**
 * Painel de emojis do chat, completo como o do WhatsApp: todos os emojis, nas categorias (carinhas,
 * pessoas, animais, comida, viagens, atividades, objetos, símbolos e bandeiras), busca em português,
 * tom de pele e os usados por último. Usa o emoji-picker-element (licença Apache 2.0), carregado só
 * quando a pessoa abre o painel. Fecha com Esc ou clicando fora.
 * `ignorarRef`: o botão que abre o painel (clicar nele não conta como "fora").
 */
export default function SeletorEmoji({ id, onEscolher, onFechar, ignorarRef }) {
  const painelRef = useRef(null);
  const escolherRef = useRef(onEscolher);
  const [erro, setErro] = useState(false);
  useEffect(() => { escolherRef.current = onEscolher; }, [onEscolher]);

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

  // cria o seletor já com os dados em português (sem isso ele buscaria os dados num site de fora)
  useEffect(() => {
    let ativo = true;
    let seletor = null;
    const escolher = (e) => escolherRef.current(e.detail.unicode);
    Promise.all([import('emoji-picker-element'), import('emoji-picker-element/i18n/pt_BR.js')])
      .then(([{ Picker }, { default: traducao }]) => {
        if (!ativo || !painelRef.current) return;
        seletor = new Picker({ locale: LOCAL_DOS_EMOJIS, dataSource: DADOS_EM_PORTUGUES, i18n: traducao });
        seletor.classList.add('light'); // o site é claro: o seletor não troca para o tema escuro sozinho
        seletor.addEventListener('emoji-click', escolher);
        painelRef.current.append(seletor);
        // no computador o cursor já vai para a busca; no celular não, para o teclado não cobrir os emojis
        if (window.matchMedia('(pointer: fine)').matches) {
          requestAnimationFrame(() => seletor?.shadowRoot?.querySelector('input')?.focus({ preventScroll: true }));
        }
      })
      .catch(() => { if (ativo) setErro(true); });
    return () => {
      ativo = false;
      seletor?.removeEventListener('emoji-click', escolher);
      seletor?.remove();
    };
  }, []);

  return (
    <div className="emoji-painel" id={id} ref={painelRef} role="dialog" aria-label="Escolher emoji">
      {erro && <p className="emoji-erro">Não foi possível abrir os emojis. Tente de novo.</p>}
    </div>
  );
}
