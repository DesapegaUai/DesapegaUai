import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icone from './IconeMarketplace.jsx';
import useGaveta from '../hooks/useGaveta.js';
import { denunciarAnuncio, minhaDenunciaDoAnuncio } from '../services/mercadoApi.js';
import '../styles/marketplace-denuncia.css';

// Os valores são os mesmos que o servidor aceita em POST /api/anuncios/:id/denuncia
const MOTIVOS = [
  { valor: 'proibido', rotulo: 'Produto proibido ou ilegal', dica: 'Arma, droga, remédio controlado ou outra coisa que não pode ser vendida.' },
  { valor: 'golpe', rotulo: 'Parece golpe', dica: 'Preço bom demais, pede pagamento adiantado ou manda link estranho.' },
  { valor: 'improprio', rotulo: 'Foto ou texto impróprio', dica: 'Nudez, violência, ofensa ou algo que não tem a ver com o produto.' },
  { valor: 'falso', rotulo: 'Anúncio falso ou enganoso', dica: 'O produto não existe, as fotos são de outro ou a descrição engana.' },
  { valor: 'outro', rotulo: 'Outro motivo', dica: 'Conte o que há de errado no campo abaixo.' },
];
const MAX_DESCRICAO = 500;

/**
 * Janela de denunciar o anúncio (aberta pelo menu ⋮ da página do anúncio). Cada pessoa denuncia uma vez;
 * com 3 pessoas diferentes, o anúncio sai da busca até a equipe revisar. O vendedor não sabe quem denunciou.
 * `onFechar` deve ser estável (useCallback).
 */
export default function DenunciarAnuncio({ anuncio, onFechar, onDenunciado }) {
  const [feita, setFeita] = useState(undefined); // undefined: carregando; null: ainda não denunciou
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fecharRef = useRef(null);
  useGaveta(true, onFechar, fecharRef);

  useEffect(() => {
    let ativo = true;
    minhaDenunciaDoAnuncio(anuncio.id)
      .then(({ denuncia }) => { if (ativo) setFeita(denuncia); })
      .catch(() => { if (ativo) setFeita(null); });
    return () => { ativo = false; };
  }, [anuncio.id]);

  const precisaDescrever = motivo === 'outro';
  const podeEnviar = Boolean(motivo) && (!precisaDescrever || descricao.trim().length > 0) && !enviando;

  async function enviar(e) {
    e.preventDefault();
    if (!podeEnviar) return;
    setEnviando(true);
    setErro('');
    try {
      await denunciarAnuncio(anuncio.id, { motivo, descricao: descricao.trim() || undefined });
      onDenunciado?.();
      onFechar();
    } catch (falha) {
      setErro(falha.message);
      setEnviando(false);
    }
  }

  const motivoFeito = feita && MOTIVOS.find((m) => m.valor === feita.motivo);

  return createPortal(
    <div className="telas-marketplace">
      <div className="denuncia-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
        <form className="denuncia-janela" role="dialog" aria-modal="true" aria-labelledby="den-anuncio-titulo" onSubmit={enviar}>
          <div className="denuncia-topo">
            <h2 id="den-anuncio-titulo">{feita ? 'Denúncia enviada' : 'Denunciar anúncio'}</h2>
            <button type="button" className="denuncia-fechar" aria-label="Fechar" onClick={onFechar} ref={fecharRef}>
              <Icone nome="fechar" tamanho={20} cor="#16281C" />
            </button>
          </div>

          {feita === undefined && <div className="denuncia-corpo"><p className="denuncia-texto" role="status">Carregando…</p></div>}

          {feita && (
            <div className="denuncia-corpo">
              <p className="denuncia-texto">
                Você já denunciou este anúncio{motivoFeito ? ` (${motivoFeito.rotulo.toLowerCase()})` : ''}. A equipe do DesapegaUai vai
                analisar, e o vendedor não fica sabendo que foi você.
              </p>
              <div className="denuncia-botoes">
                <button type="button" className="denuncia-btn principal" onClick={onFechar}>Entendi</button>
              </div>
            </div>
          )}

          {feita === null && (
            <div className="denuncia-corpo">
              <p className="denuncia-texto">O que há de errado com “{anuncio.titulo}”? O vendedor não fica sabendo que foi você.</p>

              <fieldset className="denuncia-motivos">
                <legend className="oculto">Motivo da denúncia</legend>
                {MOTIVOS.map((m) => (
                  <label key={m.valor} className={`denuncia-motivo${motivo === m.valor ? ' on' : ''}`}>
                    <input type="radio" name="motivo-anuncio" value={m.valor} checked={motivo === m.valor} onChange={() => { setMotivo(m.valor); setErro(''); }} />
                    <span>
                      <b>{m.rotulo}</b>
                      <i>{m.dica}</i>
                    </span>
                  </label>
                ))}
              </fieldset>

              <label className="denuncia-campo">
                <span>{precisaDescrever ? 'Conte o que há de errado' : 'Quer contar mais? (opcional)'}</span>
                <textarea
                  rows={3}
                  maxLength={MAX_DESCRICAO}
                  value={descricao}
                  required={precisaDescrever}
                  placeholder="Ex.: as fotos são de outro anúncio."
                  onChange={(e) => setDescricao(e.target.value)}
                />
                <small>{descricao.length}/{MAX_DESCRICAO}</small>
              </label>

              {erro && <p className="denuncia-erro" role="alert">{erro}</p>}

              <div className="denuncia-botoes">
                <button type="button" className="denuncia-btn" onClick={onFechar}>Cancelar</button>
                <button type="submit" className="denuncia-btn perigo" disabled={!podeEnviar}>{enviando ? 'Enviando…' : 'Enviar denúncia'}</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}
