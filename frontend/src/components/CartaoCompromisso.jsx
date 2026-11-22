import { useEffect, useState } from 'react';
import Icone from './IconeMarketplace.jsx';
import { buscarComparecimento, responderComparecimento } from '../services/mercadoApi.js';

/**
 * Depois da venda, cada lado da conversa diz se o outro apareceu no combinado.
 * A resposta entra na taxa de compromisso do perfil da outra pessoa; quem respondeu não aparece.
 * Depois de responder, a caixa some da conversa.
 */
export default function CartaoCompromisso({ conversa, onRespondido }) {
  const [estado, setEstado] = useState({ carregando: true, resposta: null, erro: null });
  const [enviando, setEnviando] = useState(false);
  const primeiroNome = conversa.nome.split(' ')[0];

  useEffect(() => {
    let ativo = true;
    buscarComparecimento(conversa.id)
      .then((r) => { if (ativo) setEstado({ carregando: false, resposta: r.comparecimento, erro: null }); })
      .catch(() => { if (ativo) setEstado({ carregando: false, resposta: null, erro: null }); });
    return () => { ativo = false; };
  }, [conversa.id]);

  async function responder(compareceu) {
    setEnviando(true);
    try {
      const { comparecimento } = await responderComparecimento(conversa.id, compareceu);
      setEstado({ carregando: false, resposta: comparecimento, erro: null });
      onRespondido?.(compareceu);
    } catch (falha) {
      setEstado((e) => ({ ...e, erro: falha.message }));
    } finally {
      setEnviando(false);
    }
  }

  if (estado.carregando) return null;

  // depois de responder, a caixa some da conversa (o aviso "Resposta registrada" confirma)
  if (estado.resposta) return null;

  return (
    <div className="aval-cartao" role="group" aria-label={`${primeiroNome} compareceu ao combinado?`}>
      <div className="aval-topo">
        <span className="aval-icone"><Icone nome="relogio" tamanho={22} cor="#3E8B22" espessura={1.9} /></span>
        <div>
          <h3>{primeiroNome} compareceu ao combinado?</h3>
          <p>Sua resposta ajuda quem negocia no DesapegaUai a saber quem cumpre o que combina.</p>
        </div>
      </div>
      <div className="aval-botoes">
        <button type="button" className="aval-btn" disabled={enviando} onClick={() => responder(false)}>Não apareceu</button>
        <button type="button" className="aval-btn solido" disabled={enviando} onClick={() => responder(true)}>Sim, compareceu</button>
      </div>
      {estado.erro && <p className="aval-erro" role="alert">{estado.erro}</p>}
      <p className="aval-aviso">Só dá para responder uma vez por negociação.</p>
    </div>
  );
}
