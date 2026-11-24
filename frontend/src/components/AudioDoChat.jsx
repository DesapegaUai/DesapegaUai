import { useEffect, useMemo, useRef, useState } from 'react';
import Icone from './IconeMarketplace.jsx';
import { alturaDaBarra, duracaoEmTexto, niveisDasOndas } from '../services/audio.js';

const VELOCIDADES = [1, 1.5, 2];
let tocandoAgora = null; // só um áudio toca por vez: dar play num pausa o que estava tocando

// a velocidade escolhida vale para os próximos áudios também, como no WhatsApp (guardada neste navegador)
const CHAVE_DA_VELOCIDADE = 'desapegauai:velocidade-do-audio';
function velocidadeGuardada() {
  try {
    const salva = Number(localStorage.getItem(CHAVE_DA_VELOCIDADE));
    return VELOCIDADES.includes(salva) ? salva : 1;
  } catch {
    return 1;
  }
}

/**
 * As ondas do áudio, como no WhatsApp: cada barrinha é o volume de um pedaço (fala sobe, silêncio fica
 * reto) e as que já tocaram ficam coloridas. Com onBuscar, tocar nas ondas (ou as setas do teclado)
 * pula para aquele ponto.
 */
export function OndasDoAudio({ niveis, parte, total, atual, onBuscar, classe = '' }) {
  const parteSegura = Number.isFinite(parte) ? parte : 0;
  function buscarNoPonto(e) {
    const caixa = e.currentTarget.getBoundingClientRect();
    if (caixa.width > 0) onBuscar((e.clientX - caixa.left) / caixa.width);
  }
  function teclar(e) {
    const passos = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 };
    let alvo = null;
    if (e.key in passos) alvo = atual + passos[e.key];
    else if (e.key === 'Home') alvo = 0;
    else if (e.key === 'End') alvo = total;
    if (alvo === null || !total) return;
    e.preventDefault();
    onBuscar(alvo / total);
  }
  // as barrinhas são fixas: a posição é a identidade de cada uma
  const barras = niveis.map((nivel, i) => (
    <i key={i} className={(i + 0.5) / niveis.length <= parteSegura ? 'ouvida' : undefined} style={{ height: alturaDaBarra(nivel) }} />
  ));
  if (!onBuscar) return <span className={`audio-ondas ${classe}`} aria-hidden="true">{barras}</span>;
  return (
    <span
      className={`audio-ondas ${classe}`}
      role="slider"
      tabIndex={0}
      aria-label="Posição do áudio"
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(atual)}
      aria-valuetext={`${duracaoEmTexto(atual)} de ${duracaoEmTexto(total)}`}
      onClick={buscarNoPonto}
      onKeyDown={teclar}
    >
      {barras}
    </span>
  );
}

/**
 * Áudio no balão da conversa: tocar/pausar, as ondas e o tempo. Como no WhatsApp, do lado direito fica a foto de
 * quem mandou (com o microfone); ao dar o play, a foto vira o botão de velocidade (1x, 1,5x, 2x). Pausado no
 * meio, a velocidade continua ali (mesmo rolando a conversa) até ouvir tudo; quando o áudio acaba, ou a página
 * recarrega, a foto volta.
 * foto e iniciais: de quem mandou o áudio (sem foto, as iniciais).
 */
export default function AudioDoChat({ url, segundos, ondas, foto, iniciais }) {
  const audioRef = useRef(null);
  const [tocando, setTocando] = useState(false);
  const [iniciado, setIniciado] = useState(false); // já deu play e ainda não ouviu até o fim
  const [atual, setAtual] = useState(0);
  const [velocidade, setVelocidade] = useState(velocidadeGuardada);
  const [falhou, setFalhou] = useState(false);
  const niveis = useMemo(() => niveisDasOndas(ondas), [ondas]);
  const total = Number(segundos) || 0;

  // saiu da tela tocando: para (e não fica preso como "o que está tocando")
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
      if (tocandoAgora === audio) tocandoAgora = null;
    };
  }, []);

  // enquanto toca, as barrinhas acompanham o som (o aviso de tempo do navegador vem só 4 vezes por segundo)
  useEffect(() => {
    if (!tocando) return undefined;
    let quadro;
    const andar = () => {
      setAtual(audioRef.current?.currentTime ?? 0);
      quadro = requestAnimationFrame(andar);
    };
    quadro = requestAnimationFrame(andar);
    return () => cancelAnimationFrame(quadro);
  }, [tocando]);

  function alternar() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (tocandoAgora && tocandoAgora !== audio) tocandoAgora.pause();
    tocandoAgora = audio;
    audio.playbackRate = velocidade;
    audio.play().catch(() => setFalhou(true));
  }

  function buscar(fracao) {
    const audio = audioRef.current;
    if (!audio || !total) return;
    const tempo = Math.max(0, Math.min(1, fracao)) * total;
    audio.currentTime = tempo;
    setAtual(tempo);
  }

  function trocarVelocidade() {
    const nova = VELOCIDADES[(VELOCIDADES.indexOf(velocidade) + 1) % VELOCIDADES.length];
    setVelocidade(nova);
    if (audioRef.current) audioRef.current.playbackRate = nova;
    try { localStorage.setItem(CHAVE_DA_VELOCIDADE, String(nova)); } catch { /* sem localStorage: vale só para este áudio */ }
  }

  const textoDaVelocidade = `${String(velocidade).replace('.', ',')}x`;
  return (
    // tocar no áudio não abre o menu da mensagem (segurar o balão continua abrindo)
    <div className="audio-chat" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => { setTocando(true); setIniciado(true); }}
        onPause={() => { setTocando(false); setAtual(audioRef.current?.currentTime ?? 0); }}
        onEnded={() => { setTocando(false); setIniciado(false); setAtual(0); }}
        onError={() => setFalhou(true)}
      />
      <button type="button" className="audio-tocar" onClick={alternar} disabled={falhou}
        aria-label={tocando ? 'Pausar o áudio' : `Tocar o áudio de ${duracaoEmTexto(total)}`}>
        <Icone nome={tocando ? 'pausar' : 'tocar'} tamanho={18} cor="currentColor" preenchimento="currentColor" espessura={1.2} />
      </button>
      <OndasDoAudio niveis={niveis} parte={total ? atual / total : 0} total={total} atual={atual} onBuscar={buscar} />
      {/* o mesmo lugar para a foto e para a velocidade: trocar um pelo outro não mexe no balão */}
      <span className="audio-lado">
        {iniciado ? (
          <button type="button" className="audio-velocidade" onClick={trocarVelocidade} aria-label={`Velocidade ${textoDaVelocidade}. Tocar para trocar`}>
            {textoDaVelocidade}
          </button>
        ) : (
          <span className="audio-foto" aria-hidden="true">
            {foto ? <img src={foto} alt="" referrerPolicy="no-referrer" /> : iniciais}
            <span className="audio-foto-mic"><Icone nome="microfone" tamanho={11} cor="currentColor" espessura={2.4} /></span>
          </span>
        )}
      </span>
      <span className="audio-tempo" aria-hidden="true">{falhou ? 'Áudio indisponível' : duracaoEmTexto(tocando || atual > 0 ? atual : total)}</span>
    </div>
  );
}
