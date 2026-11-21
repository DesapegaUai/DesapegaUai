import { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icone from './IconeMarketplace.jsx';
import ContextoNotificacoes from './NotificacoesAnunciosContext.js';
import useGaveta from '../hooks/useGaveta.js';
import { bairrosDaCidade, listarCidades, nomeDoBairro } from '../services/locais.js';
import '../styles/marketplace-notificacoes.css';
import '../styles/marketplace-preferencias-avisos.css';

const RAIOS = [
  { valor: '', rotulo: 'Toda a Zona da Mata' },
  { valor: '5', rotulo: 'Até 5 km de mim' },
  { valor: '10', rotulo: 'Até 10 km de mim' },
  { valor: '25', rotulo: 'Até 25 km de mim' },
  { valor: '50', rotulo: 'Até 50 km de mim' },
];

/**
 * Preferências de avisos (abre pelo cartão "Notificações" do perfil).
 * - liga e desliga os avisos de anúncios novos e de mensagens;
 * - escolhe de onde vêm os avisos de anúncio: por distância ou só de uma cidade (e bairro).
 * Cada mudança é salva na hora; não tem botão de salvar.
 */
export default function PreferenciasAvisos({ onFechar }) {
  const n = useContext(ContextoNotificacoes);
  const fecharRef = useRef(null);
  const [cidades, setCidades] = useState([]);
  const [bairros, setBairros] = useState([]);
  // o que está marcado em "De onde": começa pelo que está salvo
  const [modo, setModo] = useState(n?.cidade ? 'localidade' : 'distancia');
  const cidadeId = n?.cidade?.id ?? null;

  useGaveta(true, onFechar, fecharRef);

  useEffect(() => { listarCidades().then(setCidades).catch(() => {}); }, []);
  useEffect(() => {
    let ativo = true;
    if (cidadeId) bairrosDaCidade(cidadeId).then((lista) => { if (ativo) setBairros(lista); }).catch(() => { if (ativo) setBairros([]); });
    return () => { ativo = false; };
  }, [cidadeId]);

  if (!n) return null;

  function escolherModo(novo) {
    setModo(novo);
    if (novo === 'distancia' && n.cidade) n.mudarLocalidade(null); // volta a valer a distância
  }

  return createPortal(
    <div className="telas-marketplace">
      <div className="pref-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
        <div className="pref-janela" role="dialog" aria-modal="true" aria-labelledby="pref-titulo">
          <div className="pref-topo">
            <h2 id="pref-titulo">Notificações</h2>
            <button type="button" className="pref-fechar" aria-label="Fechar" onClick={onFechar} ref={fecharRef}>
              <Icone nome="fechar" tamanho={20} cor="#16281C" />
            </button>
          </div>

          <div className="pref-corpo">
            <div className="pref-linha">
              <span>
                <b>Avisar anúncios novos</b>
                <i>Um aviso quando alguém publica um anúncio no lugar que você escolher.</i>
              </span>
              <button type="button" role="switch" aria-checked={n.ativadas} className={`notif-chave${n.ativadas ? ' on' : ''}`} disabled={n.ocupado} onClick={() => (n.ativadas ? n.desativar() : n.ativar())}>
                <span className="oculto">{n.ativadas ? 'Desativar avisos de anúncios' : 'Ativar avisos de anúncios'}</span>
              </button>
            </div>

            {n.ativadas && (
              <fieldset className="pref-onde">
                <legend>De onde quero receber</legend>

                <label className={`pref-opcao${modo === 'distancia' ? ' on' : ''}`}>
                  <input type="radio" name="pref-onde" checked={modo === 'distancia'} onChange={() => escolherModo('distancia')} />
                  <span><b>Por distância</b><i>A partir da sua localização ou da cidade que você usa na busca.</i></span>
                </label>
                {modo === 'distancia' && (
                  <label className="pref-campo">
                    <span>Até onde</span>
                    <select value={n.raioKm ?? ''} onChange={(e) => n.mudarRaio(e.target.value ? Number(e.target.value) : null)}>
                      {RAIOS.map((r) => <option key={r.valor} value={r.valor}>{r.rotulo}</option>)}
                    </select>
                  </label>
                )}

                <label className={`pref-opcao${modo === 'localidade' ? ' on' : ''}`}>
                  <input type="radio" name="pref-onde" checked={modo === 'localidade'} onChange={() => escolherModo('localidade')} />
                  <span><b>Só de uma cidade ou bairro</b><i>Você só é avisado dos anúncios publicados nesse lugar.</i></span>
                </label>
                {modo === 'localidade' && (
                  <>
                    <label className="pref-campo">
                      <span>Cidade</span>
                      <select value={cidadeId ?? ''} onChange={(e) => { if (e.target.value) n.mudarLocalidade(Number(e.target.value)); }}>
                        <option value="" disabled>Escolha a cidade</option>
                        {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </label>
                    {cidadeId && bairros.length > 0 && (
                      <label className="pref-campo">
                        <span>Bairro <i>(opcional)</i></span>
                        <select value={n.bairro?.id ?? ''} onChange={(e) => n.mudarLocalidade(cidadeId, e.target.value ? Number(e.target.value) : null)}>
                          <option value="">A cidade toda</option>
                          {bairros.map((b) => <option key={b.id} value={b.id}>{nomeDoBairro(b)}</option>)}
                        </select>
                      </label>
                    )}
                    <p className="pref-resumo" role="status">
                      {n.cidade
                        ? `Você vai receber só os anúncios de ${n.bairro ? `${n.bairro.nome}, ` : ''}${n.cidade.nome}.`
                        : 'Escolha a cidade para começar a receber.'}
                    </p>
                  </>
                )}
              </fieldset>
            )}

            <div className="pref-linha">
              <span>
                <b>Avisar mensagens novas</b>
                <i>Um aviso quando alguém te escreve no chat.</i>
              </span>
              <button type="button" role="switch" aria-checked={n.mensagensAtivadas} className={`notif-chave${n.mensagensAtivadas ? ' on' : ''}`} disabled={n.ocupado} onClick={() => n.avisarMensagens(!n.mensagensAtivadas)}>
                <span className="oculto">{n.mensagensAtivadas ? 'Desativar avisos de mensagens' : 'Ativar avisos de mensagens'}</span>
              </button>
            </div>

            <p className="pref-nota">As mudanças são salvas na hora. Ao desligar os avisos de anúncios, os que já tinham chegado saem da sua caixa de notificações.</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
