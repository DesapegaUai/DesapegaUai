import { useEffect, useRef, useState } from 'react';
import Icone from './IconeMarketplace.jsx';
import { formatarPreco } from '../services/formatar.js';
import '../styles/marketplace-acoes.css';

// desenhos das marcas do pacote Simple Icons (licença CC0, de uso livre)
const MARCAS = {
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
  facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
};

function Marca({ nome, cor }) {
  return (
    <span className="comp-marca" style={{ background: cor }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" focusable="false"><path d={MARCAS[nome]} /></svg>
    </span>
  );
}

/**
 * Botão de compartilhar o anúncio (referência: o compartilhar da OLX).
 * Celular: abre a janela de compartilhar do próprio aparelho (WhatsApp, Instagram, mensagem...).
 * Computador: abre a escolha entre WhatsApp, Facebook, X e copiar o link.
 */
export default function CompartilharAnuncio({ anuncio, onAviso }) {
  const [aberto, setAberto] = useState(false);
  const primeiroRef = useRef(null);
  const botaoRef = useRef(null);
  const endereco = `${window.location.origin}/anuncio/${anuncio.id}`;
  const texto = `${anuncio.titulo} por ${formatarPreco(anuncio.preco)} no DesapegaUai`;

  useEffect(() => {
    if (!aberto) return undefined;
    primeiroRef.current?.focus();
    const teclar = (e) => {
      if (e.key !== 'Escape') return;
      setAberto(false);
      botaoRef.current?.focus();
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  }, [aberto]);

  function fechar() {
    setAberto(false);
    botaoRef.current?.focus();
  }

  async function compartilhar() {
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: anuncio.titulo, text: texto, url: endereco });
        return;
      } catch (erro) {
        if (erro.name === 'AbortError') return; // a pessoa fechou a janela do aparelho
      }
    }
    setAberto(true);
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(endereco);
      onAviso?.('sucesso', 'Link copiado', 'É só colar na conversa com quem você quer mostrar.');
    } catch {
      onAviso?.('erro', 'Não foi possível copiar o link', endereco);
    }
    fechar();
  }

  const redes = [
    { nome: 'whatsapp', rotulo: 'WhatsApp', cor: '#25D366', link: `https://wa.me/?text=${encodeURIComponent(`${texto} ${endereco}`)}` },
    { nome: 'facebook', rotulo: 'Facebook', cor: '#0866FF', link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(endereco)}` },
    { nome: 'x', rotulo: 'X', cor: '#000000', link: `https://x.com/intent/post?text=${encodeURIComponent(texto)}&url=${encodeURIComponent(endereco)}` },
  ];

  return (
    <>
      <button type="button" ref={botaoRef} className="det-btn" aria-haspopup="dialog" onClick={compartilhar}>
        <Icone nome="compartilhar" tamanho={20} cor="#3E8B22" />Compartilhar
      </button>
      {aberto && (
        <div className="acoes-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
          <div className="acoes-dialogo comp-dialogo" role="dialog" aria-modal="true" aria-labelledby="comp-titulo">
            <div className="comp-topo">
              <h2 id="comp-titulo">Compartilhar</h2>
              <button type="button" className="comp-fechar" aria-label="Fechar" onClick={fechar}>
                <Icone nome="fechar" tamanho={20} cor="#6B726C" />
              </button>
            </div>
            <p>Escolha como deseja compartilhar</p>
            <ul className="comp-opcoes">
              {redes.map((rede, i) => (
                <li key={rede.nome}>
                  <a ref={i === 0 ? primeiroRef : undefined} href={rede.link} target="_blank" rel="noopener noreferrer" onClick={() => setAberto(false)}>
                    <Marca nome={rede.nome} cor={rede.cor} />{rede.rotulo}
                  </a>
                </li>
              ))}
              <li>
                <button type="button" onClick={copiarLink}>
                  <span className="comp-marca" style={{ background: 'var(--marca)' }} aria-hidden="true"><Icone nome="link" tamanho={20} cor="#fff" /></span>
                  Copiar link
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
