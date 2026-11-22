import { useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import Icone from './IconeMarketplace.jsx';
import ContextoNotificacoes from './NotificacoesAnunciosContext.js';
import { urlDaApi } from '../services/api.js';
import '../styles/marketplace-notificacoes.css';

const RAIOS_DOS_AVISOS = [
  { valor: '', rotulo: 'Toda a Zona da Mata' },
  { valor: '5', rotulo: 'Até 5 km de mim' },
  { valor: '10', rotulo: 'Até 10 km de mim' },
  { valor: '25', rotulo: 'Até 25 km de mim' },
  { valor: '50', rotulo: 'Até 50 km de mim' },
];

function quando(data) {
  const minutos = Math.round((Date.now() - new Date(data).getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  if (minutos < 24 * 60) return `há ${Math.round(minutos / 60)} h`;
  return new Date(data).toLocaleDateString('pt-BR');
}

/** Sininho do cabeçalho: abre a caixa de avisos (lista, ativar avisos e distância). */
export default function CaixaNotificacoes() {
  const n = useContext(ContextoNotificacoes);
  const [aberta, setAberta] = useState(false);
  const caixaRef = useRef(null);
  const botaoRef = useRef(null);

  useEffect(() => {
    if (!aberta) return undefined;
    const fora = (e) => {
      if (!caixaRef.current?.contains(e.target) && !botaoRef.current?.contains(e.target)) setAberta(false);
    };
    const tecla = (e) => {
      if (e.key === 'Escape') { setAberta(false); botaoRef.current?.focus(); }
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberta]);

  if (!n) return null;
  // a caixinha só mostra os avisos que a pessoa ainda não abriu: entrou num aviso, ele some daqui
  const pendentes = n.itens.filter((aviso) => !aviso.lida);
  const rotulo = n.naoLidas ? `Notificações: ${n.naoLidas} não lidas` : 'Notificações';

  return (
    <div className="notif">
      <button type="button" ref={botaoRef} className="cab-icone notif-sino" aria-label={rotulo} aria-expanded={aberta} aria-haspopup="dialog" onClick={() => setAberta((a) => !a)}>
        {/* a key muda a cada aviso que chega, então a animação de balançar recomeça */}
        <span key={n.toque} className={n.toque > 0 ? 'notif-sino-ic tocando' : 'notif-sino-ic'}>
          <Icone nome="sino" tamanho={24} cor="#3E8B22" espessura={1.7} />
        </span>
        {n.naoLidas > 0 && <span key={`qtd-${n.toque}`} className={n.toque > 0 ? 'notif-qtd chegou' : 'notif-qtd'} aria-hidden="true">{n.naoLidas > 9 ? '9+' : n.naoLidas}</span>}
      </button>

      {aberta && (
        <div className="notif-caixa" role="dialog" aria-label="Notificações" ref={caixaRef}>
          <div className="notif-topo">
            <strong>Notificações</strong>
            {n.naoLidas > 0 && <button type="button" className="notif-link" onClick={n.marcarLidas}>Limpar tudo</button>}
          </div>

          {!n.logado ? (
            <p className="notif-texto"><Link to="/entrar" onClick={() => setAberta(false)}>Entre na sua conta</Link> para receber avisos de anúncios novos, mensagens e avaliações.</p>
          ) : (
            <div className="notif-ativar">
              <div className="notif-ativar-linha">
                <span>
                  <b>Avisar anúncios novos</b>
                  <i>{n.ativadas ? 'Você recebe um aviso quando alguém publica.' : 'Receba um aviso assim que alguém publicar.'}</i>
                </span>
                <button type="button" role="switch" aria-checked={n.ativadas} className={`notif-chave${n.ativadas ? ' on' : ''}`} disabled={n.ocupado} onClick={() => (n.ativadas ? n.desativar() : n.ativar())}>
                  <span className="oculto">{n.ativadas ? 'Desativar avisos' : 'Ativar avisos'}</span>
                </button>
              </div>
              {n.ativadas && n.cidade && (
                <p className="notif-dica">Só anúncios de {n.bairro ? `${n.bairro.nome}, ` : ''}{n.cidade.nome}. Para mudar, abra Notificações no seu perfil.</p>
              )}
              {n.ativadas && !n.cidade && (
                <label className="notif-raio">
                  <span>De onde</span>
                  <select value={n.raioKm ?? ''} onChange={(e) => n.mudarRaio(e.target.value ? Number(e.target.value) : null)}>
                    {RAIOS_DOS_AVISOS.map((r) => <option key={r.valor} value={r.valor}>{r.rotulo}</option>)}
                  </select>
                </label>
              )}
              <div className="notif-ativar-linha notif-ativar-outra">
                <span>
                  <b>Avisar mensagens novas</b>
                  <i>{n.mensagensAtivadas ? 'Aparece um aviso quando alguém te escreve.' : 'Você não recebe aviso quando alguém te escreve.'}</i>
                </span>
                <button type="button" role="switch" aria-checked={n.mensagensAtivadas} className={`notif-chave${n.mensagensAtivadas ? ' on' : ''}`} disabled={n.ocupado} onClick={() => n.avisarMensagens(!n.mensagensAtivadas)}>
                  <span className="oculto">{n.mensagensAtivadas ? 'Desativar avisos de mensagens' : 'Ativar avisos de mensagens'}</span>
                </button>
              </div>
              {n.ativadas && n.motivoSemPush && <p className="notif-dica">{n.motivoSemPush}</p>}
              {n.ativadas && !n.motivoSemPush && n.push && !n.push.configurado && <p className="notif-dica">Os avisos aparecem quando o site estiver aberto.</p>}
            </div>
          )}

          {n.logado && (
            <ul className="notif-lista">
              {pendentes.length === 0 && <li className="notif-vazio">Nenhum aviso por enquanto.</li>}
              {pendentes.map((aviso) => (
                <li key={aviso.id} className={aviso.lida ? undefined : 'nova'}>
                  <Link to={aviso.anuncio_id ? `/anuncio/${aviso.anuncio_id}` : '/perfil'} onClick={() => { n.marcarLida(aviso.id); setAberta(false); }}>
                    {aviso.foto
                      ? <img className="notif-foto" src={urlDaApi(aviso.foto)} alt="" loading="lazy" />
                      : <Icone nome={{ nova_avaliacao: 'estrela', procura_atendida: 'busca' }[aviso.tipo] ?? 'etiqueta'} tamanho={18} cor="#3E8B22" />}
                    <span>
                      <b>{aviso.titulo}</b>
                      <i>{aviso.texto}</i>
                      <small>{quando(aviso.criada_em)}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
