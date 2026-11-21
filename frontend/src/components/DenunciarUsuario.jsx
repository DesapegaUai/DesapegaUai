import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icone from './IconeMarketplace.jsx';
import useGaveta from '../hooks/useGaveta.js';
import { buscarDenuncia, denunciarConversa } from '../services/mercadoApi.js';
import '../styles/marketplace-denuncia.css';

// Os valores são os mesmos que o servidor aceita em POST /api/conversas/:id/denuncia
const MOTIVOS = [
  { valor: 'golpe', rotulo: 'Tentativa de golpe', dica: 'Pediu pagamento adiantado, mandou link ou comprovante falso.' },
  { valor: 'ofensa', rotulo: 'Ofensa, ameaça ou assédio', dica: 'Xingou, ameaçou ou insistiu depois de você dizer não.' },
  { valor: 'proibido', rotulo: 'Produto proibido ou ilegal', dica: 'Está vendendo algo que não pode ser vendido.' },
  { valor: 'perfil_falso', rotulo: 'Perfil falso', dica: 'Está se passando por outra pessoa ou empresa.' },
  { valor: 'spam', rotulo: 'Spam ou propaganda', dica: 'Manda a mesma mensagem ou propaganda sem relação com o anúncio.' },
  { valor: 'outro', rotulo: 'Outro motivo', dica: 'Conte o que aconteceu no campo abaixo.' },
];
const MAX_DESCRICAO = 500;

/**
 * Botão de denunciar no topo da conversa + a janela com os motivos.
 * Cada pessoa denuncia uma vez por conversa; depois o botão só mostra que a denúncia foi enviada.
 * Quem foi denunciado não é avisado.
 */
export default function DenunciarUsuario({ conversa, onDenunciado }) {
  const [aberta, setAberta] = useState(false);
  const [feita, setFeita] = useState(null); // a denúncia já enviada nesta conversa, se houver
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fecharRef = useRef(null);
  const primeiroNome = conversa.nome.split(' ')[0];

  // ao abrir a conversa, descobre se a pessoa já denunciou
  useEffect(() => {
    let ativo = true;
    buscarDenuncia(conversa.id)
      .then(({ denuncia }) => { if (ativo) setFeita(denuncia); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [conversa.id]);

  const fechar = useCallback(() => setAberta(false), []);
  useGaveta(aberta, fechar, fecharRef);

  const precisaDescrever = motivo === 'outro';
  const podeEnviar = Boolean(motivo) && (!precisaDescrever || descricao.trim().length > 0) && !enviando;

  async function enviar(e) {
    e.preventDefault();
    if (!podeEnviar) return;
    setEnviando(true);
    setErro('');
    try {
      const { denuncia } = await denunciarConversa(conversa.id, { motivo, descricao: descricao.trim() || undefined });
      setFeita(denuncia);
      setAberta(false);
      onDenunciado?.();
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`conv-acao conv-denunciar${feita ? ' feita' : ''}`}
        aria-label={feita ? `Você já denunciou ${primeiroNome}` : `Denunciar ${primeiroNome}`}
        aria-haspopup="dialog"
        title={feita ? 'Denúncia enviada' : 'Denunciar usuário'}
        onClick={() => setAberta(true)}
      >
        <Icone nome="bandeira" tamanho={22} cor={feita ? '#9AA39B' : '#B42318'} />
      </button>

      {aberta && createPortal(
        <div className="telas-marketplace">
          <div className="denuncia-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
            <form className="denuncia-janela" role="dialog" aria-modal="true" aria-labelledby="denuncia-titulo" onSubmit={enviar}>
              <div className="denuncia-topo">
                <h2 id="denuncia-titulo">{feita ? 'Denúncia enviada' : `Denunciar ${primeiroNome}`}</h2>
                <button type="button" className="denuncia-fechar" aria-label="Fechar" onClick={fechar} ref={fecharRef}>
                  <Icone nome="fechar" tamanho={20} cor="#16281C" />
                </button>
              </div>

              {feita ? (
                <div className="denuncia-corpo">
                  <p className="denuncia-texto">
                    Você já denunciou {primeiroNome} nesta conversa
                    {MOTIVOS.find((m) => m.valor === feita.motivo) ? ` (${MOTIVOS.find((m) => m.valor === feita.motivo).rotulo.toLowerCase()})` : ''}.
                    A denúncia está guardada para análise e {primeiroNome} não foi avisado.
                  </p>
                  <p className="denuncia-texto">Se você estiver em perigo, ligue 190. Não continue a negociação se não se sentir seguro.</p>
                  <div className="denuncia-botoes">
                    <button type="button" className="denuncia-btn principal" onClick={fechar}>Entendi</button>
                  </div>
                </div>
              ) : (
                <div className="denuncia-corpo">
                  <p className="denuncia-texto">O que aconteceu? {primeiroNome} não fica sabendo que foi você.</p>

                  <fieldset className="denuncia-motivos">
                    <legend className="oculto">Motivo da denúncia</legend>
                    {MOTIVOS.map((m) => (
                      <label key={m.valor} className={`denuncia-motivo${motivo === m.valor ? ' on' : ''}`}>
                        <input type="radio" name="motivo" value={m.valor} checked={motivo === m.valor} onChange={() => { setMotivo(m.valor); setErro(''); }} />
                        <span>
                          <b>{m.rotulo}</b>
                          <i>{m.dica}</i>
                        </span>
                      </label>
                    ))}
                  </fieldset>

                  <label className="denuncia-campo">
                    <span>{precisaDescrever ? 'Conte o que aconteceu' : 'Quer contar mais? (opcional)'}</span>
                    <textarea
                      rows={3}
                      maxLength={MAX_DESCRICAO}
                      value={descricao}
                      required={precisaDescrever}
                      placeholder="Ex.: pediu Pix antes de mostrar o produto."
                      onChange={(e) => setDescricao(e.target.value)}
                    />
                    <small>{descricao.length}/{MAX_DESCRICAO}</small>
                  </label>

                  {erro && <p className="denuncia-erro" role="alert">{erro}</p>}

                  <div className="denuncia-botoes">
                    <button type="button" className="denuncia-btn" onClick={fechar}>Cancelar</button>
                    <button type="submit" className="denuncia-btn perigo" disabled={!podeEnviar}>{enviando ? 'Enviando…' : 'Enviar denúncia'}</button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
