import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import CaixaMensagem from '../components/CaixaMensagem.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import { CONVERSAS } from '../services/conversas.js';
import { formatarPreco, formatarTamanho, horaAgora } from '../services/formatar.js';
import '../styles/marketplace-conversas.css';

const FILTROS = [
  { id: 'todas', rotulo: 'Todas', teste: () => true },
  { id: 'nao-lidas', rotulo: 'Não lidas', teste: (c) => c.naoLidas > 0 },
  { id: 'vendendo', rotulo: 'Vendendo', teste: (c) => c.vendendo },
];

function previa(conversa) {
  const ultima = conversa.mensagens.at(-1);
  if (!ultima) return '';
  const corpo = ultima.texto || (ultima.anexos?.length ? `📎 ${ultima.anexos.length > 1 ? `${ultima.anexos.length} anexos` : ultima.anexos[0].nome}` : '');
  return ultima.autor === 'eu' ? `Você: ${corpo}` : corpo;
}

function quando(conversa) {
  const ultima = conversa.mensagens.at(-1);
  if (!ultima) return '';
  return ultima.dia === 'Hoje' ? ultima.hora : ultima.dia;
}

function Anexo({ anexo }) {
  if (anexo.tipo.startsWith('image/')) {
    return (
      <a className="bolha-img" href={anexo.url} target="_blank" rel="noreferrer">
        <img src={anexo.url} alt={anexo.nome} />
      </a>
    );
  }
  return (
    <a className="bolha-arquivo" href={anexo.url} download={anexo.nome}>
      <Icone nome="documento" tamanho={24} />
      <span>
        <span className="nome">{anexo.nome}</span>
        <span className="tam">{formatarTamanho(anexo.tamanho)} · baixar</span>
      </span>
    </a>
  );
}

/**
 * Conversas (protótipos 10-conversas e 10b-conversa-aberta).
 * Rotas: /conversas (lista; no computador já mostra a 1ª conversa) · /conversas/:id
 */
export default function Conversas() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [conversas, setConversas] = useState(CONVERSAS);
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const msgsRef = useRef(null);
  const urlsRef = useRef([]);

  const selecionada = conversas.find((c) => c.id === id) ?? conversas[0];
  const naoLidas = conversas.reduce((t, c) => t + c.naoLidas, 0);

  useEffect(() => { document.title = 'DesapegaUai — Conversas'; }, []);
  // Libera os arquivos anexados ao sair da tela
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Abriu uma conversa pelo endereço → marca como lida
  if (conversas.some((c) => c.id === id && c.naoLidas)) {
    setConversas((lista) => lista.map((c) => (c.id === id ? { ...c, naoLidas: 0 } : c)));
  }

  // Endereço de uma conversa que não existe → volta para a lista
  useEffect(() => {
    if (id && !CONVERSAS.some((c) => c.id === id)) navegar('/conversas', { replace: true });
  }, [id, navegar]);

  // Rola para a última mensagem
  useLayoutEffect(() => {
    const caixa = msgsRef.current;
    if (caixa) caixa.scrollTop = caixa.scrollHeight;
  }, [selecionada?.id, selecionada?.mensagens.length]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const teste = FILTROS.find((f) => f.id === filtro).teste;
    return conversas.filter((c) => teste(c)
      && (!termo || c.nome.toLowerCase().includes(termo) || c.anuncio.titulo.toLowerCase().includes(termo)));
  }, [conversas, filtro, busca]);

  function enviar({ texto, anexos }) {
    // TODO: enviar para a API/WebSocket (texto + anexos[].arquivo)
    const nova = {
      id: Date.now(),
      autor: 'eu',
      dia: 'Hoje',
      hora: horaAgora(),
      texto,
      anexos: anexos.map(({ nome, tamanho, tipo, url }) => ({ nome, tamanho, tipo, url })),
    };
    urlsRef.current.push(...anexos.map((a) => a.url));
    setConversas((lista) => lista.map((c) => (c.id === selecionada.id ? { ...c, mensagens: [...c.mensagens, nova] } : c)));
  }

  return (
    <LayoutMarketplace comAbas={false} comFab={!id} classeConteudo="pag-conversas">
      <div className="titulo-pagina">
        <h1 className="t-titulo-1">Conversas</h1>
        <span className="cont">{naoLidas} {naoLidas === 1 ? 'não lida' : 'não lidas'} · {conversas.length} no total</span>
      </div>

      <div className={`conv-corpo${id ? ' aberta' : ''}`}>
        {/* ---------- Lista ---------- */}
        <section className="lista-conv" aria-label="Lista de conversas">
          <div className="lista-topo">
            <div className="busca-conv">
              <Icone nome="busca" tamanho={19} cor="#4CA02B" espessura={1.7} />
              <label htmlFor="busca-conversa" className="oculto">Buscar conversa</label>
              <input
                id="busca-conversa"
                type="search"
                placeholder="Buscar conversa"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="chips-conv" role="group" aria-label="Filtrar conversas">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`chip-s${filtro === f.id ? ' on' : ''}`}
                  aria-pressed={filtro === f.id}
                  onClick={() => setFiltro(f.id)}
                >
                  {f.rotulo}
                </button>
              ))}
            </div>
          </div>

          <div className="itens-conv">
            {visiveis.length === 0 && <p className="lista-vazia">Nenhuma conversa encontrada.</p>}
            {visiveis.map((c) => {
              const on = c.id === selecionada.id;
              return (
                <Link
                  key={c.id}
                  to={`/conversas/${c.id}`}
                  className={`item-conv${on ? ' on' : ''}${c.naoLidas ? ' nao-lida' : ''}`}
                  aria-current={on ? 'true' : undefined}
                >
                  <span className="avatar" aria-hidden="true">
                    {c.iniciais}
                    {c.online && <span className="on-dot" />}
                  </span>
                  <span className="item-txt">
                    <span className="item-l1">
                      <span className="item-nome">{c.nome}</span>
                      <span className="item-hora">{quando(c)}</span>
                    </span>
                    <span className="item-anuncio">{c.anuncio.titulo}</span>
                    <span className="item-l3">
                      <span className="item-msg">{previa(c)}</span>
                      {c.naoLidas > 0 && (
                        <span className="item-qtd" aria-label={`${c.naoLidas} não lidas`}>{c.naoLidas}</span>
                      )}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ---------- Conversa aberta ---------- */}
        <section className="conversa" aria-label={`Conversa com ${selecionada.nome}`}>
          <div className="conv-topo">
            <Link className="conv-voltar" to="/conversas" aria-label="Voltar para a lista">
              <Icone nome="seta-esquerda" tamanho={20} cor="#3E8B22" />
            </Link>
            <span className="avatar g" aria-hidden="true">{selecionada.iniciais}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="conv-nome">{selecionada.nome}</h2>
              <div className="conv-status">
                {selecionada.online && <span className="pt-verde" />}
                <span>{selecionada.online ? 'Online agora' : 'Offline'}</span>
              </div>
            </div>
            {/* TODO: ações ainda sem tela no protótipo */}
            <div className="conv-acoes">
              <button type="button" className="conv-acao" aria-label={`Ligar para ${selecionada.nome}`}>
                <Icone nome="telefone" tamanho={22} cor="#3E8B22" />
              </button>
              <button type="button" className="conv-acao" aria-label="Segurança e denúncia">
                <Icone nome="escudo-simples" tamanho={22} cor="#3E8B22" />
              </button>
              <button type="button" className="conv-acao" aria-label="Mais opções">
                <Icone nome="mais-vertical" tamanho={22} cor="#6B726C" />
              </button>
            </div>
          </div>

          <div className="conv-anuncio">
            <span className="mini"><Icone nome="etiqueta" tamanho={24} cor="#4CA02B" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t">{selecionada.anuncio.titulo}</div>
              <div className="p">{formatarPreco(selecionada.anuncio.preco)}</div>
            </div>
            <Link className="btn-ver" to={`/anuncio/${selecionada.anuncio.id}`}>Ver anúncio</Link>
          </div>

          <div className="msgs" ref={msgsRef} role="log" aria-live="polite" aria-label="Mensagens" tabIndex={0}>
            {selecionada.mensagens.map((m, i) => (
              <Fragment key={m.id}>
                {m.dia !== selecionada.mensagens[i - 1]?.dia && <div className="dia"><span>{m.dia}</span></div>}
                <div className={`linha-msg${m.autor === 'eu' ? ' eu' : ''}`}>
                  <div className="bolha">
                    {m.anexos?.length > 0 && (
                      <div className="bolha-anexos">
                        {m.anexos.map((a) => <Anexo key={a.url} anexo={a} />)}
                      </div>
                    )}
                    {m.texto && <p>{m.texto}</p>}
                    <div className="meta">
                      <span>{m.hora}</span>
                      {m.autor === 'eu' && (
                        <Icone nome="lida" tamanho={16} cor="rgba(255,255,255,.82)" />
                      )}
                    </div>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>

          <CaixaMensagem key={selecionada.id} nomeContato={selecionada.nome} onEnviar={enviar} />
        </section>
      </div>
    </LayoutMarketplace>
  );
}
