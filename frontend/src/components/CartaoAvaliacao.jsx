import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import Icone from './IconeMarketplace.jsx';
import { EscolherNota, Estrelas } from './Estrelas.jsx';
import { QUALIDADES, ROTULOS_NOTA, avaliar, daConversa, rotuloDaQualidade, useAvaliacoes } from '../services/avaliacoes.js';

const MAX_COMENTARIO = 300;

/**
 * Aparece na conversa depois que o vendedor marca o anúncio como vendido.
 * Só quem estava comprando vê. Uma avaliação por conversa.
 * A pessoa dá de 1 a 5 estrelas, marca os pontos fortes (respondeu rápido, pontual…) e pode comentar.
 */
export default function CartaoAvaliacao({ conversa, onAvaliado }) {
  const lista = useAvaliacoes();
  const feita = daConversa(lista, conversa.id);
  const [nota, setNota] = useState(0);
  const [qualidades, setQualidades] = useState([]);
  const [comentario, setComentario] = useState('');
  const [depois, setDepois] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const primeiroNome = conversa.nome.split(' ')[0];
  const formRef = useRef(null);

  // A conversa rola até o fim; aqui ela volta um pouco para as estrelas ficarem à vista
  useEffect(() => {
    const cartao = formRef.current;
    const caixa = cartao?.closest('.msgs');
    if (caixa) caixa.scrollTop += cartao.getBoundingClientRect().top - caixa.getBoundingClientRect().top - 16;
  }, []);

  if (feita) {
    return (
      <div className="aval-cartao feita">
        <div className="aval-topo">
          <span className="aval-icone ok"><Icone nome="check" tamanho={22} cor="#fff" espessura={2.2} /></span>
          <div>
            <h3>Você avaliou {primeiroNome}</h3>
            <p className="aval-nota-linha"><Estrelas nota={feita.nota} tamanho={18} /> <b>{ROTULOS_NOTA[feita.nota]}</b></p>
          </div>
        </div>
        {feita.qualidades.length > 0 && (
          <ul className="aval-marcadas" aria-label="Pontos fortes que você marcou">
            {feita.qualidades.map((q) => <li key={q}>{rotuloDaQualidade(q)}</li>)}
          </ul>
        )}
        {feita.comentario && <p className="aval-coment">“{feita.comentario}”</p>}
        <p className="aval-aviso">Sua avaliação já aparece no anúncio e no perfil de {primeiroNome}.</p>
        <Link className="aval-link" to={`/anuncio/${conversa.anuncio.id}`}>Ver como ficou no anúncio <Icone nome="seta-direita" tamanho={16} cor="currentColor" espessura={2} /></Link>
      </div>
    );
  }

  if (depois) {
    return (
      <div className="aval-depois">
        <span>Você pode avaliar {primeiroNome} quando quiser.</span>
        <button type="button" onClick={() => setDepois(false)}>Avaliar agora</button>
      </div>
    );
  }

  async function enviar(e) {
    e.preventDefault();
    if (!nota || enviando) return;

    setEnviando(true);
    setErro('');
    try {
      await avaliar({ conversa: conversa.id, nota, qualidades, comentario });
      onAvaliado?.(nota);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form ref={formRef} className="aval-cartao" onSubmit={enviar} aria-labelledby={`aval-titulo-${conversa.id}`}>
      <div className="aval-topo">
        <span className="aval-icone"><Icone nome="estrela" tamanho={22} cor="none" preenchimento="#3E8B22" espessura={0} /></span>
        <div>
          <h3 id={`aval-titulo-${conversa.id}`}>Como foi negociar com {primeiroNome}?</h3>
          <p>“{conversa.anuncio.titulo}” foi vendido. Sua nota ajuda outras pessoas a comprar com segurança.</p>
        </div>
      </div>

      <EscolherNota valor={nota} onMudar={setNota} nome={`nota-${conversa.id}`} />

      <fieldset className="aval-qualidades">
        <legend>O que foi bom? <i>(opcional)</i></legend>
        <div>
          {QUALIDADES.map((q) => {
            const marcada = qualidades.includes(q.valor);
            return (
              <label key={q.valor} className={`aval-qualidade${marcada ? ' on' : ''}`}>
                <input
                  type="checkbox"
                  checked={marcada}
                  onChange={() => setQualidades((atuais) => (marcada ? atuais.filter((v) => v !== q.valor) : [...atuais, q.valor]))}
                />
                {q.rotulo}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="aval-campo">
        <span>Conte como foi <i>(opcional)</i></span>
        <textarea
          rows={3}
          maxLength={MAX_COMENTARIO}
          placeholder="Ex.: produto igual às fotos, combinou certinho a entrega…"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
        <small>{comentario.length}/{MAX_COMENTARIO}</small>
      </label>

      <div className="aval-botoes">
        <button type="button" className="aval-btn" disabled={enviando} onClick={() => setDepois(true)}>Agora não</button>
        <button type="submit" className="aval-btn solido" disabled={!nota || enviando}>
          {enviando ? 'Enviando…' : 'Enviar avaliação'}
        </button>
      </div>
      {erro && <p className="aval-erro" role="alert">{erro}</p>}
      <p className="aval-aviso">A avaliação é pública e aparece com o seu nome. Não dá para avaliar duas vezes a mesma negociação.</p>
    </form>
  );
}
