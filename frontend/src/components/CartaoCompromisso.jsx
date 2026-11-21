import { useEffect, useState } from 'react';
import Icone from './IconeMarketplace.jsx';
import { buscarComparecimento, responderComparecimento } from '../services/mercadoApi.js';

/**
 * Depois da venda, cada lado da conversa diz se o outro apareceu no combinado.
 * A resposta entra na taxa de compromisso do perfil da outra pessoa; quem respondeu não aparece.
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

  if (estado.resposta) {
    return (
      <div className="aval-cartao feita">
        <div className="aval-topo">
          <span className="aval-icone ok"><Icone nome="check" tamanho={22} cor="#fff" espessura={2.2} /></span>
          <div>
            <h3>Compromisso registrado</h3>
            <p>Você informou que {primeiroNome} {estado.resposta.compareceu ? 'compareceu ao combinado' : 'não apareceu no combinado'}.</p>
          </div>
        </div>
        <p className="aval-aviso">A resposta entra na taxa de compromisso do perfil de {primeiroNome}, sem mostrar quem respondeu.</p>
      </div>
    );
  }

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
