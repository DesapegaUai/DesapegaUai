import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icone from './IconeMarketplace.jsx';
import useGaveta from '../hooks/useGaveta.js';

const SEM_PERMISSAO =
  'Você não liberou a câmera. Clique no cadeado ao lado do endereço do site, permita a câmera e tente de novo.';
const SEM_CAMERA = 'Não encontramos nenhuma câmera neste aparelho.';
const CAMERA_OCUPADA = 'A câmera está sendo usada por outro programa. Feche-o e tente de novo.';

const ERROS = {
  NotAllowedError: SEM_PERMISSAO,
  SecurityError: SEM_PERMISSAO,
  NotFoundError: SEM_CAMERA,
  OverconstrainedError: SEM_CAMERA,
  NotReadableError: CAMERA_OCUPADA,
  AbortError: CAMERA_OCUPADA,
};

function nomeDaFoto() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `foto-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
}

const CAMERA_BLOQUEADA = 'Este navegador não deixou a página usar a câmera (ela só funciona em endereços https).';
const temCamera = () => Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * Câmera dentro da página (usada no computador):
 * imagem ao vivo → tira a foto → confere → anexa à mensagem.
 * A foto vira um File JPEG, igual aos arquivos escolhidos no 📎.
 * No celular/tablet a CaixaMensagem abre a câmera do próprio aparelho em vez desta janela.
 */
export default function CameraFoto({ onUsar, onFechar, onEscolherArquivo }) {
  const [etapa, setEtapa] = useState(() => (temCamera() ? 'iniciando' : 'erro')); // iniciando · ao-vivo · conferindo · erro
  const [erro, setErro] = useState(() => (temCamera() ? '' : CAMERA_BLOQUEADA));
  const [foto, setFoto] = useState(null); // { arquivo, url }
  const [lado, setLado] = useState('environment'); // traseira quando houver; senão a que existir
  const [espelhar, setEspelhar] = useState(true);
  const [podeVirar, setPodeVirar] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const videoRef = useRef(null);
  const janelaRef = useRef(null);
  const fecharRef = useRef(null);
  const disparoRef = useRef(null);
  const usarRef = useRef(null);
  const fotoRef = useRef(foto);
  useEffect(() => { fotoRef.current = foto; }, [foto]);
  const reiniciar = () => setEtapa(temCamera() ? 'iniciando' : 'erro');

  useGaveta(true, onFechar, fecharRef);

  // Liga a câmera (e desliga ao fechar, virar ou tentar de novo)
  useEffect(() => {
    let cancelado = false;
    let fluxo = null;
    const video = videoRef.current;

    if (!temCamera()) return undefined;

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: lado }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then(async (s) => {
        if (cancelado) { s.getTracks().forEach((t) => t.stop()); return; }
        fluxo = s;
        video.srcObject = s;
        await video.play().catch(() => {});
        if (cancelado) return;
        const config = s.getVideoTracks()[0]?.getSettings?.() ?? {};
        setEspelhar(config.facingMode !== 'environment'); // webcam/frontal: prévia como espelho
        setEtapa('ao-vivo');
        const aparelhos = await navigator.mediaDevices.enumerateDevices?.().catch(() => []);
        if (!cancelado) setPodeVirar((aparelhos ?? []).filter((a) => a.kind === 'videoinput').length > 1);
      })
      .catch((e) => {
        if (cancelado) return;
        setErro(ERROS[e?.name] ?? 'Não deu para abrir a câmera. Tente de novo.');
        setEtapa('erro');
      });

    return () => {
      cancelado = true;
      fluxo?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
  }, [lado, tentativa]);

  // Libera a prévia da foto ao fechar
  useEffect(() => () => { if (fotoRef.current) URL.revokeObjectURL(fotoRef.current.url); }, []);

  // Leva o foco para a ação principal de cada etapa
  useEffect(() => {
    if (etapa === 'ao-vivo') disparoRef.current?.focus();
    if (etapa === 'conferindo') usarRef.current?.focus();
  }, [etapa]);

  function fotografar() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const tela = document.createElement('canvas');
    tela.width = video.videoWidth;
    tela.height = video.videoHeight;
    tela.getContext('2d').drawImage(video, 0, 0); // a foto sai sem espelho (textos ficam legíveis)
    tela.toBlob((blob) => {
      if (!blob) return;
      const arquivo = new File([blob], nomeDaFoto(), { type: 'image/jpeg', lastModified: Date.now() });
      setFoto({ arquivo, url: URL.createObjectURL(blob) });
      setEtapa('conferindo');
    }, 'image/jpeg', 0.9);
  }

  function tirarOutra() {
    if (foto) URL.revokeObjectURL(foto.url);
    setFoto(null);
    setEtapa('ao-vivo');
  }

  function prenderFoco(e) {
    if (e.key !== 'Tab') return;
    const focaveis = janelaRef.current?.querySelectorAll('button:not([disabled])');
    if (!focaveis?.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  }

  const aoVivo = etapa === 'iniciando' || etapa === 'ao-vivo';

  return createPortal(
    <div className="telas-marketplace">
    <div
      className="camera-fundo"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div
        ref={janelaRef}
        className="camera-janela"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-titulo"
        onKeyDown={prenderFoco}
      >
        <div className="camera-topo">
          <h2 id="camera-titulo">Tirar foto</h2>
          <button ref={fecharRef} type="button" className="camera-fechar" aria-label="Fechar câmera" onClick={onFechar}>
            <Icone nome="fechar" tamanho={22} cor="#16281C" espessura={2} />
          </button>
        </div>

        <div className="camera-visor">
          <video
            ref={videoRef}
            className={espelhar ? 'espelhado' : undefined}
            hidden={!aoVivo}
            playsInline
            muted
            aria-label="Imagem da câmera ao vivo"
          />
          {etapa === 'iniciando' && <p className="camera-status">Abrindo a câmera…</p>}
          {etapa === 'conferindo' && foto && <img src={foto.url} alt="Foto que você acabou de tirar" />}
          {etapa === 'erro' && (
            <div className="camera-erro" role="alert">
              <Icone nome="camera" tamanho={40} cor="#fff" espessura={1.5} />
              <p>{erro}</p>
            </div>
          )}
        </div>

        <p className="oculto" aria-live="polite">
          {etapa === 'conferindo' ? 'Foto tirada. Confira e anexe à mensagem ou tire outra.' : ''}
        </p>

        {aoVivo && (
          <div className="camera-acoes ao-vivo">
            {podeVirar ? (
              <button
                type="button"
                className="camera-virar"
                aria-label="Trocar de câmera"
                title="Trocar de câmera"
                onClick={() => { reiniciar(); setLado((l) => (l === 'environment' ? 'user' : 'environment')); }}
              >
                <Icone nome="trocar" tamanho={22} cor="#3E8B22" espessura={1.8} />
              </button>
            ) : <span />}
            <button
              ref={disparoRef}
              type="button"
              className="camera-disparo"
              aria-label="Tirar foto"
              disabled={etapa !== 'ao-vivo'}
              onClick={fotografar}
            >
              <Icone nome="camera" tamanho={28} cor="#fff" espessura={1.8} />
            </button>
            <span />
          </div>
        )}

        {etapa === 'conferindo' && (
          <div className="camera-acoes">
            <button type="button" className="camera-btn secundario" onClick={tirarOutra}>Tirar outra</button>
            <button ref={usarRef} type="button" className="camera-btn primario" onClick={() => onUsar(foto.arquivo)}>
              Anexar foto
            </button>
          </div>
        )}

        {etapa === 'erro' && (
          <div className="camera-acoes">
            <button type="button" className="camera-btn secundario" onClick={onEscolherArquivo}>
              Escolher uma foto
            </button>
            <button type="button" className="camera-btn primario" onClick={() => { reiniciar(); setTentativa((t) => t + 1); }}>
              Tentar de novo
            </button>
          </div>
        )}
      </div>
    </div>
    </div>,
    document.body,
  );
}
