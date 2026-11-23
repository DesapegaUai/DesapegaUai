import { useEffect, useRef, useState } from 'react';
import Icone from './IconeMarketplace.jsx';
import '../styles/marketplace-acoes.css';

const ZOOM_MINIMO = 1;
const ZOOM_MAXIMO = 4;
const LADO_FINAL = 640; // a foto sai quadrada, 640 x 640, e o servidor ainda reduz para 512
const limitar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

/**
 * Ajustar a foto de perfil antes de salvar, como no WhatsApp e no Instagram: a foto aparece atrás de um
 * círculo; arrastando, a pessoa escolhe o enquadramento, e a barra (ou dois dedos no celular, ou a rodinha
 * do mouse) aproxima ou afasta. "Usar foto" devolve só o pedaço que está dentro do círculo, já leve.
 * Pelo teclado: setas movem, + e - aproximam e afastam, Esc cancela.
 */
export default function AjustarFoto({ arquivo, onUsar, onCancelar }) {
  const [endereco, setEndereco] = useState(null);
  const [tamanhoOriginal, setTamanhoOriginal] = useState(null); // { largura, altura } da foto
  const [zoom, setZoom] = useState(1);
  const [deslocamento, setDeslocamento] = useState({ x: 0, y: 0 });
  // o quadro ocupa o espaço que tiver, até 320 px
  const medirLado = () => Math.round(Math.min(320, window.innerWidth - 72));
  const [lado, setLado] = useState(medirLado);
  const [gerando, setGerando] = useState(false);
  const imagemRef = useRef(null);
  const quadroRef = useRef(null);
  const dedos = useRef(new Map()); // ponteiros apertados (1 = arrastar, 2 = aproximar com os dedos)
  const gesto = useRef(null);

  // lê a foto escolhida (o endereço "data:" não precisa ser liberado depois)
  useEffect(() => {
    let ativo = true;
    const leitor = new FileReader();
    leitor.onload = () => { if (ativo) setEndereco(leitor.result); };
    leitor.readAsDataURL(arquivo);
    return () => { ativo = false; };
  }, [arquivo]);

  useEffect(() => {
    const medir = () => setLado(medirLado());
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  // escala em que a foto cobre o círculo inteiro sem sobrar espaço (o zoom 1)
  const cobrir = tamanhoOriginal ? Math.max(lado / tamanhoOriginal.largura, lado / tamanhoOriginal.altura) : 1;
  const escala = cobrir * zoom;
  const largura = tamanhoOriginal ? tamanhoOriginal.largura * escala : lado;
  const altura = tamanhoOriginal ? tamanhoOriginal.altura * escala : lado;
  // a foto nunca sai de trás do círculo: o deslocamento fica dentro da sobra
  const prender = ({ x, y }, l = largura, a = altura) => ({
    x: limitar(x, -(l - lado) / 2, (l - lado) / 2),
    y: limitar(y, -(a - lado) / 2, (a - lado) / 2),
  });
  const posicao = prender(deslocamento);

  function mudarZoom(novo) {
    const z = limitar(novo, ZOOM_MINIMO, ZOOM_MAXIMO);
    setZoom(z);
    if (tamanhoOriginal) setDeslocamento((d) => prender(d, tamanhoOriginal.largura * cobrir * z, tamanhoOriginal.altura * cobrir * z));
  }

  function apertar(e) {
    quadroRef.current?.setPointerCapture?.(e.pointerId);
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesto.current = null;
  }

  function mover(e) {
    if (!dedos.current.has(e.pointerId)) return;
    const antes = dedos.current.get(e.pointerId);
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.current.size === 1) {
      setDeslocamento((d) => prender({ x: d.x + e.clientX - antes.x, y: d.y + e.clientY - antes.y }));
      return;
    }
    // dois dedos: a distância entre eles aproxima ou afasta
    const [a, b] = [...dedos.current.values()];
    const distancia = Math.hypot(a.x - b.x, a.y - b.y);
    if (gesto.current) mudarZoom(zoom * (distancia / gesto.current));
    gesto.current = distancia;
  }

  function soltar(e) {
    dedos.current.delete(e.pointerId);
    gesto.current = null;
  }

  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCancelar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onCancelar]);

  function teclado(e) {
    const passo = e.shiftKey ? 30 : 10;
    const movimentos = { ArrowLeft: [passo, 0], ArrowRight: [-passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] };
    if (movimentos[e.key]) {
      e.preventDefault();
      const [x, y] = movimentos[e.key];
      setDeslocamento((d) => prender({ x: d.x + x, y: d.y + y }));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      mudarZoom(zoom + 0.2);
    } else if (e.key === '-') {
      e.preventDefault();
      mudarZoom(zoom - 0.2);
    }
  }

  // só o que está dentro do círculo, em 640 x 640
  async function usar() {
    const imagem = imagemRef.current;
    if (!imagem || !tamanhoOriginal) return;
    setGerando(true);
    const esquerda = (lado - largura) / 2 + posicao.x;
    const topo = (lado - altura) / 2 + posicao.y;
    const tela = document.createElement('canvas');
    tela.width = LADO_FINAL;
    tela.height = LADO_FINAL;
    const pincel = tela.getContext('2d');
    pincel.imageSmoothingQuality = 'high';
    pincel.drawImage(imagem, -esquerda / escala, -topo / escala, lado / escala, lado / escala, 0, 0, LADO_FINAL, LADO_FINAL);
    tela.toBlob((blob) => {
      setGerando(false);
      if (blob) onUsar(new File([blob], 'foto-de-perfil.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  }

  const fracao = (zoom - ZOOM_MINIMO) / (ZOOM_MAXIMO - ZOOM_MINIMO);

  return (
    <div className="acoes-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancelar(); }}>
      <div className="acoes-dialogo ajustar-foto" role="dialog" aria-modal="true" aria-labelledby="ajustar-foto-titulo">
        <h2 id="ajustar-foto-titulo">Ajustar foto</h2>
        <p>Arraste para enquadrar e use a barra para aproximar ou afastar.</p>
        <div
          ref={quadroRef}
          className="ajustar-foto-quadro"
          style={{ width: lado, height: lado }}
          tabIndex={0}
          role="img"
          aria-label="Foto de perfil. Use as setas para mover e as teclas mais e menos para aproximar ou afastar."
          onPointerDown={apertar}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          onWheel={(e) => mudarZoom(zoom - e.deltaY * 0.0015)}
          onKeyDown={teclado}
        >
          {endereco && (
            <img
              ref={imagemRef}
              src={endereco}
              alt=""
              draggable={false}
              onLoad={(e) => setTamanhoOriginal({ largura: e.currentTarget.naturalWidth, altura: e.currentTarget.naturalHeight })}
              style={{ width: largura, height: altura, transform: `translate(${(lado - largura) / 2 + posicao.x}px, ${(lado - altura) / 2 + posicao.y}px)` }}
            />
          )}
          <span className="ajustar-foto-circulo" aria-hidden="true" />
        </div>
        <div className="ajustar-foto-zoom">
          <button type="button" aria-label="Afastar" onClick={() => mudarZoom(zoom - 0.25)}><Icone nome="imagem" tamanho={16} cor="#6B726C" /></button>
          <div className="slider">
            <input
              type="range"
              min={ZOOM_MINIMO}
              max={ZOOM_MAXIMO}
              step="0.01"
              value={zoom}
              aria-label="Aproximar ou afastar"
              style={{ '--preenchido': `calc(11px + ${fracao} * (100% - 22px))` }}
              onChange={(e) => mudarZoom(Number(e.target.value))}
            />
          </div>
          <button type="button" aria-label="Aproximar" onClick={() => mudarZoom(zoom + 0.25)}><Icone nome="imagem" tamanho={24} cor="#6B726C" /></button>
        </div>
        <div className="acoes-botoes">
          <button type="button" className="acoes-btn" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="acoes-btn ajustar-foto-usar" onClick={usar} disabled={!tamanhoOriginal || gerando}>
            {gerando ? 'Preparando…' : 'Usar foto'}
          </button>
        </div>
      </div>
    </div>
  );
}
