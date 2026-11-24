import { useEffect, useEffectEvent, useRef, useState } from 'react';
import Icone from './IconeMarketplace.jsx';
import { OndasDoAudio } from './AudioDoChat.jsx';
import {
  MAXIMO_DE_SEGUNDOS, alturaDaBarra, duracaoEmTexto, formatoDeGravacao, nivelDoVolume, resumirNiveis, textoDoErroDoMicrofone,
} from '../services/audio.js';

// as mais novas entram pela direita; na tela estreita do celular, as mais antigas saem pela esquerda
const BARRAS_AO_VIVO = 90;
const MINIMO_DE_SEGUNDOS = 1;
const INTERVALO_MS = 100;

// desliga o microfone e o relógio da gravação (pode ser chamado mais de uma vez)
function liberar(r) {
  clearInterval(r.relogio);
  r.stream?.getTracks().forEach((faixa) => faixa.stop());
  r.stream = null;
}

/**
 * Gravador de áudio da caixa de mensagem. Abre já gravando (a pessoa tocou no microfone).
 * - Gravando: lixeira (cancela) · ponto vermelho e o tempo · as ondas ao vivo · quadrado (para).
 * - Pronto: lixeira · tocar para ouvir antes de mandar · as ondas · o tempo · enviar.
 * Para sozinho em 2 minutos. O microfone desliga assim que a gravação para (a luz do aparelho apaga).
 * contexto: o AudioContext criado no toque do microfone (o iPhone só deixa ouvir o volume assim).
 */
export default function GravadorAudio({ contexto, onEnviar, onFechar, onErro }) {
  const [estado, setEstado] = useState('abrindo'); // abrindo | gravando | pronto | enviando
  const [segundos, setSegundos] = useState(0);
  const [aoVivo, setAoVivo] = useState(() => Array(BARRAS_AO_VIVO).fill(0));
  const [gravacao, setGravacao] = useState(null); // { blob, url, niveis, segundos }
  const [ouvindo, setOuvindo] = useState(false);
  const [atual, setAtual] = useState(0);
  const recursos = useRef({ stream: null, gravador: null, partes: [], niveis: [], inicio: 0, relogio: null, descartar: false, url: null });
  const ouvirRef = useRef(null);

  // a gravação parou (quadrado, 2 minutos ou lixeira): monta o arquivo, a não ser que seja para jogar fora
  const terminar = useEffectEvent(() => {
    const r = recursos.current;
    const duracao = (performance.now() - r.inicio) / 1000;
    liberar(r);
    if (r.descartar) return;
    if (duracao < MINIMO_DE_SEGUNDOS || !r.partes.length) {
      onErro('O áudio ficou curto demais. Toque no microfone e fale por pelo menos 1 segundo.');
      onFechar();
      return;
    }
    const blob = new Blob(r.partes, { type: r.gravador?.mimeType || 'audio/webm' });
    r.url = URL.createObjectURL(blob);
    setGravacao({ blob, url: r.url, niveis: resumirNiveis(r.niveis), segundos: Math.min(MAXIMO_DE_SEGUNDOS, duracao) });
    setEstado('pronto');
  });

  const falhar = useEffectEvent((erro) => {
    onErro(textoDoErroDoMicrofone(erro));
    onFechar();
  });

  const comecou = useEffectEvent(() => setEstado('gravando'));

  // ao abrir: pede o microfone, começa a gravar e mede o volume 10 vezes por segundo
  useEffect(() => {
    const r = recursos.current;
    let cancelado = false;
    // começa do zero (no modo de desenvolvimento o React monta duas vezes e a primeira vez é descartada)
    Object.assign(r, { gravador: null, partes: [], niveis: [], descartar: false });
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (cancelado) {
          stream.getTracks().forEach((faixa) => faixa.stop());
          return;
        }
        r.stream = stream;
        let analisador = null;
        try {
          if (contexto) {
            analisador = contexto.createAnalyser();
            analisador.fftSize = 1024;
            contexto.createMediaStreamSource(stream).connect(analisador);
            contexto.resume?.().catch(() => {});
          }
        } catch {
          analisador = null; // sem o volume ao vivo a gravação funciona igual; só as ondas ficam retas
        }
        const tipo = formatoDeGravacao();
        const gravador = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
        r.gravador = gravador;
        const partes = r.partes; // as partes desta gravação (a montagem descartada não mistura as dela)
        gravador.ondataavailable = (e) => { if (e.data?.size) partes.push(e.data); };
        gravador.onstop = () => { if (!cancelado) terminar(); };
        gravador.start(250);
        r.inicio = performance.now();
        comecou();

        const amostras = analisador ? new Float32Array(analisador.fftSize) : null;
        r.relogio = setInterval(() => {
          const passados = (performance.now() - r.inicio) / 1000;
          let nivel = 0;
          if (analisador) {
            analisador.getFloatTimeDomainData(amostras);
            let soma = 0;
            for (const valor of amostras) soma += valor * valor;
            nivel = nivelDoVolume(Math.sqrt(soma / amostras.length));
          }
          r.niveis.push(nivel);
          setSegundos(passados);
          setAoVivo((lista) => [...lista.slice(1), nivel]);
          if (passados >= MAXIMO_DE_SEGUNDOS && gravador.state === 'recording') {
            clearInterval(r.relogio);
            gravador.stop();
          }
        }, INTERVALO_MS);
      } catch (erro) {
        if (!cancelado) {
          liberar(r);
          falhar(erro);
        }
      }
    })();
    return () => {
      cancelado = true;
      if (r.gravador?.state === 'recording') r.gravador.stop();
      liberar(r);
      if (r.url) URL.revokeObjectURL(r.url);
      r.url = null;
    };
  }, [contexto]);

  // ouvindo antes de mandar: as barrinhas acompanham o som
  useEffect(() => {
    if (!ouvindo) return undefined;
    let quadro;
    const andar = () => {
      setAtual(ouvirRef.current?.currentTime ?? 0);
      quadro = requestAnimationFrame(andar);
    };
    quadro = requestAnimationFrame(andar);
    return () => cancelAnimationFrame(quadro);
  }, [ouvindo]);

  function parar() {
    const r = recursos.current;
    clearInterval(r.relogio);
    if (r.gravador?.state === 'recording') r.gravador.stop(); // o onstop monta o áudio
  }

  function cancelar() {
    const r = recursos.current;
    r.descartar = true;
    ouvirRef.current?.pause();
    if (r.gravador?.state === 'recording') r.gravador.stop();
    liberar(r);
    onFechar();
  }

  function alternarOuvir() {
    const audio = ouvirRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  async function enviar() {
    if (!gravacao || estado === 'enviando') return;
    ouvirRef.current?.pause();
    setEstado('enviando');
    const foi = await onEnviar(gravacao.blob);
    if (foi === false) setEstado('pronto'); // deu certo: a caixa de mensagem fecha o gravador
  }

  const lixeira = (
    <button type="button" className="gravador-botao" aria-label="Apagar o áudio" title="Apagar o áudio" onClick={cancelar} disabled={estado === 'enviando'}>
      <Icone nome="lixeira" tamanho={20} cor="#6B726C" />
    </button>
  );

  if (estado === 'abrindo' || estado === 'gravando') {
    return (
      <div className="gravador" role="group" aria-label="Gravação de áudio">
        {lixeira}
        <span className={`gravador-ponto${estado === 'gravando' ? ' ligado' : ''}`} aria-hidden="true" />
        <span className="gravador-tempo" role="timer" aria-live="off">
          {estado === 'abrindo' ? 'Abrindo o microfone…' : duracaoEmTexto(segundos)}
        </span>
        <span className="gravador-ondas" aria-hidden="true">
          {aoVivo.map((nivel, i) => <i key={i} style={{ height: alturaDaBarra(nivel) }} />)}
        </span>
        <span className="oculto" role="status">{estado === 'gravando' ? 'Gravando áudio' : ''}</span>
        <button type="button" className="gravador-parar" aria-label="Parar a gravação" title="Parar a gravação" onClick={parar} disabled={estado !== 'gravando'}>
          <i aria-hidden="true" />
        </button>
      </div>
    );
  }

  const total = gravacao?.segundos ?? 0;
  return (
    <div className="gravador" role="group" aria-label="Áudio gravado">
      {lixeira}
      <audio
        ref={ouvirRef}
        src={gravacao?.url}
        preload="auto"
        onPlay={() => setOuvindo(true)}
        onPause={() => setOuvindo(false)}
        onEnded={() => { setOuvindo(false); setAtual(0); }}
      />
      <button type="button" className="gravador-ouvir" onClick={alternarOuvir} disabled={estado === 'enviando'}
        aria-label={ouvindo ? 'Pausar' : 'Ouvir antes de mandar'} title={ouvindo ? 'Pausar' : 'Ouvir antes de mandar'}>
        <Icone nome={ouvindo ? 'pausar' : 'tocar'} tamanho={15} cor="#3E8B22" preenchimento="#3E8B22" espessura={1.2} />
      </button>
      <OndasDoAudio niveis={gravacao?.niveis ?? []} parte={total ? atual / total : 0} total={total} atual={atual} classe="gravador-ondas-prontas" />
      <span className="gravador-tempo">{duracaoEmTexto(ouvindo || atual > 0 ? atual : total)}</span>
      <span className="oculto" role="status">{estado === 'enviando' ? 'Enviando o áudio' : 'Áudio gravado. Ouça ou envie.'}</span>
      <button type="button" className="btn-enviar" aria-label="Enviar o áudio" title="Enviar o áudio" onClick={enviar} disabled={estado === 'enviando'}>
        <Icone nome="seta-link" tamanho={18} cor="#fff" espessura={2.4} className="seta-para-cima" />
      </button>
    </div>
  );
}
