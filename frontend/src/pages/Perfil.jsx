import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router';
import LayoutPainel from '../components/LayoutPainel.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import Toast from '../components/Toast.jsx';
import useSair from '../hooks/useSair.js';
import { listarConversas, listarMeusAnuncios } from '../services/mercadoApi.js';
import { estaVisivel } from '../services/meusAnuncios.js';
import { ouvir, quandoReconectar } from '../services/tempoReal.js';
import {
  LINKS_CONTA, NUMEROS, atualizarFotoPerfil, carregarPerfil, excluirConta, removerFotoPerfil, usePerfil,
} from '../services/perfil.js';
import { Estrelas } from '../components/Estrelas.jsx';
import {
  carregarMinhasAvaliacoes, reputacao, resumoDe, textoDaMedia, useAvaliacoes, rotuloDaQualidade,
} from '../services/avaliacoes.js';
import '../styles/marketplace-acoes.css';
import '../styles/marketplace-avaliacao.css';
import PreferenciasAvisos from '../components/PreferenciasAvisos.jsx';

/**
 * Meu perfil (protótipo 11-perfil, layout "painel"):
 * [perfil, números, Conta, Meus anúncios] + [Resumo, Ações rápidas, Segurança].
 * Celular: layout enxuto (revisão 26/10) + menu inferior.
 */
export default function Perfil() {
  const { hash, state } = useLocation();
  const perfil = usePerfil();
  const [anuncios, setAnuncios] = useState(null); // null = ainda carregando
  const [totalConversas, setTotalConversas] = useState(null);
  const carregarAnuncios = useCallback(() => listarMeusAnuncios().then(setAnuncios).catch(() => {}), []);
  useEffect(() => { carregarAnuncios(); }, [carregarAnuncios]);
  const sair = useSair();
  const [toast, setToast] = useState(() => state?.aviso ?? null);
  const [carregandoAvaliacoes, setCarregandoAvaliacoes] = useState(true);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [fotoMenuAberto, setFotoMenuAberto] = useState(false);
  const [preferenciasAbertas, setPreferenciasAbertas] = useState(false);
  const fecharPreferencias = useCallback(() => setPreferenciasAbertas(false), []);
  const [privacidadeAberta, setPrivacidadeAberta] = useState(false);
  const [excluindoConta, setExcluindoConta] = useState(false);
  const [removendoFoto, setRemovendoFoto] = useState(false);
  const fotoRef = useRef(null);
  const primeiroAcaoFotoRef = useRef(null);

  const ativos = (anuncios ?? []).filter(estaVisivel); // disponíveis e reservados
  const meusIds = useRef(new Set());
  useEffect(() => { meusIds.current = new Set((anuncios ?? []).map((a) => a.id)); }, [anuncios]);
  const notas = resumoDe(useAvaliacoes(), perfil.id);
  const selo = reputacao(notas);
  const avisar = (aviso) => setToast({ ...aviso, chave: Date.now() });
  // números do painel (null = ainda carregando, mostra um traço)
  const numeros = {
    'Anúncios ativos': anuncios ? ativos.length : null,
    Favoritos: perfil.total_favoritos,
    Conversas: totalConversas,
    'Avaliação': notas.qtd ? textoDaMedia(notas.media) : null,
  };

  useEffect(() => { document.title = 'DesapegaUai — Meu perfil'; }, []);
  useEffect(() => {
    let ativo = true;
    carregarPerfil().catch((erro) => {
      if (ativo) setToast({ tipo: 'erro', titulo: 'Não foi possível carregar o perfil', texto: erro.message, chave: Date.now() });
    });
    return () => { ativo = false; };
  }, []);

  // Último acesso e números do painel em tempo real (conexão única do site).
  // O servidor só avisa que algo mudou; os números vêm sempre da API.
  useEffect(() => {
    if (!perfil.id) return undefined;
    const atualizarPerfil = () => carregarPerfil().catch(() => {});
    // conversas que aparecem na minha lista (as que eu excluí não contam)
    const atualizarConversas = () => listarConversas(perfil.id).then((r) => setTotalConversas(r.itens.length)).catch(() => {});
    // vários avisos seguidos (ex.: mensagens chegando) viram um pedido só
    const esperas = new Map();
    const logo = (funcao) => () => {
      clearTimeout(esperas.get(funcao));
      esperas.set(funcao, setTimeout(funcao, 400));
    };
    const seForMeu = (funcao) => ({ id }) => { if (meusIds.current.has(id)) funcao(); };
    const tudo = () => { atualizarPerfil(); carregarAnuncios(); atualizarConversas(); };

    atualizarConversas();
    const parares = [
      ouvir('ultimo_acesso_atualizado', atualizarPerfil),
      ouvir('perfil_contadores_atualizados', logo(atualizarPerfil)), // favoritei ou desfavoritei
      ouvir('conversa_criada', logo(atualizarConversas)),
      ouvir('conversa_excluida', logo(atualizarConversas)),
      ouvir('nova_mensagem', logo(atualizarConversas)), // mensagem nova traz de volta a conversa excluída
      // anúncios: publiquei, vendi, reativei ou excluí (em outra aba ou aparelho também)
      ouvir('anuncio_publicado', logo(carregarAnuncios)),
      ouvir('anuncio_atualizado', seForMeu(logo(carregarAnuncios))),
      ouvir('anuncio_removido', seForMeu(logo(carregarAnuncios))),
      quandoReconectar(tudo),
    ];
    return () => {
      parares.forEach((parar) => parar());
      esperas.forEach(clearTimeout);
    };
  }, [perfil.id, carregarAnuncios]);

  useEffect(() => {
    let ativo = true;
    carregarMinhasAvaliacoes()
      .catch((erro) => {
        if (ativo) setToast({ tipo: 'erro', titulo: 'Não foi possível carregar as avaliações', texto: erro.message, chave: Date.now() });
      })
      .finally(() => {
        if (ativo) setCarregandoAvaliacoes(false);
      });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!fotoMenuAberto) return undefined;
    primeiroAcaoFotoRef.current?.focus();
    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') setFotoMenuAberto(false);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [fotoMenuAberto]);

  // /perfil#avaliacoes → rola até o bloco
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  async function trocarFoto(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) {
      avisar({ tipo: 'erro', titulo: 'Formato de foto inválido', texto: 'Escolha uma imagem JPG, PNG ou WebP.' });
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      avisar({ tipo: 'erro', titulo: 'Foto muito grande', texto: 'A foto de perfil pode ter no máximo 5 MB.' });
      return;
    }

    setEnviandoFoto(true);
    try {
      await atualizarFotoPerfil(arquivo);
      setFotoMenuAberto(false);
      avisar({ tipo: 'sucesso', titulo: 'Foto de perfil atualizada' });
    } catch (erro) {
      avisar({ tipo: 'erro', titulo: 'Não foi possível atualizar a foto', texto: erro.message });
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function removerFoto() {
    if (!perfil.foto_url || removendoFoto) return;
    setRemovendoFoto(true);
    try {
      await removerFotoPerfil();
      setFotoMenuAberto(false);
      avisar({ tipo: 'sucesso', titulo: 'Foto de perfil removida' });
    } catch (erro) {
      avisar({ tipo: 'erro', titulo: 'Não foi possível remover a foto', texto: erro.message });
    } finally {
      setRemovendoFoto(false);
    }
  }

  // Excluir a conta: a API apaga os dados e as fotos; depois o site volta para a página inicial sem login
  async function excluirMinhaConta() {
    if (excluindoConta) return;
    if (!window.confirm('Excluir a sua conta agora? Seus anúncios, fotos, conversas e avaliações serão apagados. Não dá para desfazer.')) return;
    setExcluindoConta(true);
    try {
      await excluirConta();
      window.location.assign('/');
    } catch (erro) {
      setExcluindoConta(false);
      setPrivacidadeAberta(false);
      avisar({ tipo: 'erro', titulo: 'Não foi possível excluir a conta', texto: erro.message });
    }
  }

  function abrirOpcoesFoto() {
    if (!enviandoFoto && !removendoFoto) setFotoMenuAberto(true);
  }

  return (
    <LayoutPainel foto={perfil.foto_url}>
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      {preferenciasAbertas && <PreferenciasAvisos onFechar={fecharPreferencias} />}
      {privacidadeAberta && createPortal(
        <div className="telas-marketplace">
          <div className="acoes-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget && !excluindoConta) setPrivacidadeAberta(false); }}>
            <div className="acoes-dialogo" role="dialog" aria-modal="true" aria-labelledby="privacidade-titulo" aria-describedby="privacidade-texto">
              <h2 id="privacidade-titulo">Privacidade e seus dados</h2>
              <p id="privacidade-texto">
                Seu telefone e seu e-mail não aparecem para outros usuários, e o ponto dos seus anúncios no mapa é aproximado.
                Você pode excluir a sua conta quando quiser: os anúncios, as fotos, as conversas e as avaliações saem do
                DesapegaUai e <b>não dá para desfazer</b>.
              </p>
              <div className="acoes-botoes">
                <button type="button" className="acoes-btn" disabled={excluindoConta} onClick={() => setPrivacidadeAberta(false)}>Fechar</button>
                <button type="button" className="acoes-btn perigo" disabled={excluindoConta} onClick={excluirMinhaConta}>
                  {excluindoConta ? 'Excluindo…' : 'Excluir minha conta'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {/* ---------- Coluna esquerda ---------- */}
      <div className="colL">
        <section className="hero" aria-label="Seu perfil">
          <span className="ring" /><span className="ring2" />
          <div className="avwrap">
            <button
              type="button"
              className="av av-trigger"
              aria-label="Opções da foto do perfil"
              aria-haspopup="dialog"
              aria-expanded={fotoMenuAberto}
              disabled={enviandoFoto || removendoFoto}
              onClick={() => setFotoMenuAberto((aberto) => !aberto)}
            >
              {perfil.foto_url ? <img src={perfil.foto_url} alt="" /> : perfil.iniciais}
            </button>
            <button type="button" className="avbtn" aria-label="Opções da foto do perfil" disabled={enviandoFoto || removendoFoto} onClick={abrirOpcoesFoto}>
              <Icone nome="camera" tamanho={21} cor="#fff" espessura={1.8} />
            </button>
            <input ref={fotoRef} type="file" accept="image/jpeg,image/png,image/webp" className="oculto" tabIndex={-1} aria-hidden="true" disabled={enviandoFoto} onChange={trocarFoto} />
          </div>
          <div className="hero-txt">
            <h1 className="hname">{perfil.nome}</h1>
            <div className="huser">{perfil.usuario}</div>
            <div className="hmeta cel">
              <span>Membro desde {perfil.membroDesde}</span>
              <span className="selo-rep">{selo}</span>
            </div>
            <p className={`hbio${perfil.bio ? '' : ' vazia'}`}>
              {perfil.bio || 'Adicione uma bio (opcional) — conte um pouco sobre você.'}
            </p>
                <Link className="edit" to="/perfil/editar">
              <Icone nome="lapis" tamanho={19} cor="#fff" espessura={1.8} />
              Editar perfil
            </Link>
          </div>
        </section>
        {fotoMenuAberto && (
          <div className="foto-acoes-fundo" onClick={(evento) => {
            if (evento.target === evento.currentTarget) setFotoMenuAberto(false);
          }}>
            <section className="foto-acoes" role="dialog" aria-modal="true" aria-labelledby="foto-acoes-titulo">
              <button type="button" className="foto-acoes-fechar" aria-label="Fechar opções da foto" onClick={() => setFotoMenuAberto(false)}>
                <Icone nome="fechar" tamanho={18} cor="#526052" />
              </button>
              <div className="foto-acoes-cab">
                <span className="foto-acoes-avatar">
                  {perfil.foto_url ? <img src={perfil.foto_url} alt="" /> : perfil.iniciais}
                </span>
                <span>
                  <h2 id="foto-acoes-titulo">Foto do perfil</h2>
                  <p>Personalize sua conta com uma imagem.</p>
                </span>
              </div>
              <div className="foto-acoes-lista">
                <button
                  ref={primeiroAcaoFotoRef}
                  type="button"
                  className="foto-acao"
                  disabled={enviandoFoto || removendoFoto}
                  onClick={() => fotoRef.current?.click()}
                >
                  <Icone nome="camera" tamanho={19} cor="#3E8B22" />
                  <span>{enviandoFoto ? 'Enviando imagem...' : 'Adicionar imagem'}</span>
                </button>
                <button type="button" className="foto-acao remover" disabled={!perfil.foto_url || enviandoFoto || removendoFoto} onClick={removerFoto}>
                  <Icone nome="fechar" tamanho={18} cor="#A96A65" />
                  <span>{removendoFoto ? 'Removendo imagem...' : 'Remover imagem'}</span>
                </button>
              </div>
            </section>
          </div>
        )}

        <section className="bloco kpis" aria-label="Seus números">
          {NUMEROS.map((n) => (
            <Link className="kpi" key={n.rotulo} to={n.para}>
              <Icone nome={n.icone} tamanho={26} cor="#4CA02B" espessura={1.75} />
              <b>{numeros[n.rotulo] ?? '–'}</b>
              <i>{n.rotulo === 'Avaliação' && notas.qtd ? `Avaliação (${notas.qtd})` : n.rotulo}</i>
            </Link>
          ))}
        </section>

        <h2 className="grp cel">Conta</h2>
        <nav className="bloco links" aria-label="Conta">
          {LINKS_CONTA.map((l) => {
            const conteudo = (
              <>
                <span className="ib"><Icone nome={l.icone} tamanho={22} cor="#3E8B22" espessura={1.7} /></span>
                <span className="tx"><b>{l.titulo}</b><i>{l.descricao}</i></span>
                <Icone nome="seta-direita" tamanho={18} cor="#9AA39B" espessura={1.8} />
              </>
            );
            if (l.titulo === 'Notificações') {
              return (
                <button type="button" className="lk" key={l.titulo} aria-haspopup="dialog" onClick={() => setPreferenciasAbertas(true)}>
                  {conteudo}
                </button>
              );
            }
            if (l.titulo === 'Privacidade') {
              return (
                <button type="button" className="lk" key={l.titulo} aria-haspopup="dialog" onClick={() => setPrivacidadeAberta(true)}>
                  {conteudo}
                </button>
              );
            }
            if (l.titulo === 'Verificação de conta') {
              const aviso = perfil.vinculo_academico
                ? { tipo: 'sucesso', titulo: 'Vínculo acadêmico verificado', texto: 'Você entrou com o e-mail da UFV ou da Univiçosa. O selo aparece no seu perfil e nos seus anúncios.' }
                : { tipo: 'info', titulo: 'Como ganhar o selo', texto: 'Entre no DesapegaUai com o seu e-mail @ufv.br ou @univicosa.com.br. O selo aparece sozinho, sem enviar documento.' };
              return (
                <button type="button" className="lk" key={l.titulo} onClick={() => avisar(aviso)}>
                  {conteudo}
                </button>
              );
            }
            return l.para ? (
              <Link className="lk" to={l.para} key={l.titulo}>{conteudo}</Link>
            ) : (
              <button type="button" className="lk" key={l.titulo} onClick={() => avisar({ tipo: 'info', titulo: `${l.titulo}: em breve`, texto: 'Essa parte ainda não entra nesta versão do DesapegaUai.' })}>
                {conteudo}
              </button>
            );
          })}
        </nav>

        <h2 className="grp grp-ajuda cel">Ajuda</h2>
        <nav className="bloco links ajuda cel" aria-label="Ajuda">
          <Link className="lk" to="/ajuda/perguntas-frequentes">
            <span className="ib"><Icone nome="ajuda" tamanho={22} cor="#3E8B22" espessura={1.7} /></span>
            <span className="tx"><b>Ajuda e suporte</b></span>
          </Link>
          <Link className="lk" to="/ajuda/dicas-de-seguranca">
            <span className="ib"><Icone nome="verificado" tamanho={22} cor="#3E8B22" espessura={1.7} /></span>
            <span className="tx"><b>Dicas de segurança</b></span>
          </Link>
          <button type="button" className="lk sair" onClick={sair}>
            <span className="ib"><Icone nome="sair" tamanho={22} cor="#C0392B" espessura={1.7} /></span>
            <span className="tx"><b>Sair</b></span>
          </button>
        </nav>

        <section className="bloco sec" id="avaliacoes" aria-labelledby="titulo-avaliacoes">
          <div className="sech"><h2 id="titulo-avaliacoes">Avaliações recebidas</h2></div>
          <ul className="lista-aval">
            {carregandoAvaliacoes && <li className="lista-aval-vazia">Carregando avaliações…</li>}
            {!carregandoAvaliacoes && notas.qtd === 0 && (
              <li className="lista-aval-vazia">Você ainda não recebeu avaliações.</li>
            )}
            {notas.lista.slice(0, 3).map((a) => (
              <li key={a.id}>
                <div className="rec-cab">
                  {a.autorId ? <Link className="link-perfil" to={`/usuario/${a.autorId}`} tabIndex={-1} aria-hidden="true"><span className="rec-av" aria-hidden="true">{a.autorFoto ? <img src={a.autorFoto} alt="" referrerPolicy="no-referrer" /> : a.autor.split(' ').slice(0, 2).map((p) => p[0]).join('')}</span></Link> : <span className="rec-av" aria-hidden="true">{a.autorFoto ? <img src={a.autorFoto} alt="" referrerPolicy="no-referrer" /> : a.autor.split(' ').slice(0, 2).map((p) => p[0]).join('')}</span>}
                  <span className="rec-nm"><b>{a.autorId ? <Link className="link-perfil" to={`/usuario/${a.autorId}`} title={`Ver o perfil de ${a.autor}`}>{a.autor}</Link> : a.autor}</b><small>{a.anuncio} · {a.quando}</small></span>
                  <Estrelas nota={a.nota} tamanho={14} /><span className="oculto">Nota {a.nota} de 5</span>
                </div>
                {a.qualidades.length > 0 && (
                  <ul className="aval-marcadas">{a.qualidades.map((v) => <li key={v}>{rotuloDaQualidade(v)}</li>)}</ul>
                )}
                {a.comentario && <p>“{a.comentario}”</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ---------- Coluna direita ---------- */}
      <div className="colR">
        <section className="bloco sec" aria-labelledby="titulo-resumo">
          <div className="sech"><h2 id="titulo-resumo">Resumo da conta</h2></div>
          <div style={{ marginTop: 8 }}>
            <div className="rrow">
              <span className="l"><Icone nome="calendario" tamanho={20} cor="#4CA02B" espessura={1.7} />Membro desde</span>
              <span className="v">{perfil.membroDesdeExtenso}</span>
            </div>
            <div className="rrow">
              <span className="l"><Icone nome="relogio" tamanho={20} cor="#4CA02B" espessura={1.7} />Último acesso</span>
              <span className="v">{perfil.ultimoAcesso}</span>
            </div>
            <div className="rrow">
              <span className="l"><Icone nome="verificado" tamanho={20} cor="#4CA02B" espessura={1.7} />Reputação</span>
              <span className="v"><span className="selo-rep">{selo}</span></span>
            </div>
            <div className="rrow">
              <span className="l"><Icone nome="check" tamanho={20} cor="#4CA02B" espessura={1.7} />Compromisso</span>
              <span className="v">{perfil.compromisso?.respostas ? `${perfil.compromisso.taxa}% (${perfil.compromisso.compareceu} de ${perfil.compromisso.respostas})` : 'Sem respostas'}</span>
            </div>
            <div className="rrow">
              <span className="l"><Icone nome="escudo-simples" tamanho={20} cor="#4CA02B" espessura={1.7} />Vínculo acadêmico</span>
              <span className="v">{perfil.vinculo_academico ? <span className="selo-rep">Verificado</span> : 'Não verificado'}</span>
            </div>
          </div>
        </section>

        <section className="bloco safe" aria-labelledby="titulo-seguranca">
          <div className="hd">
            <Icone nome="verificado" tamanho={24} cor="#3E8B22" espessura={1.7} />
            <h2 id="titulo-seguranca">Negocie com segurança</h2>
          </div>
          <div className="sf">
            <Icone nome="local" tamanho={20} cor="#4CA02B" espessura={1.7} />
            <p>Encontre-se em locais públicos e movimentados.</p>
          </div>
          <div className="sf">
            <Icone nome="olho" tamanho={20} cor="#4CA02B" espessura={1.7} />
            <p>Confira o estado do produto antes de finalizar.</p>
          </div>
          <div className="sf">
            <Icone nome="mensagens" tamanho={20} cor="#4CA02B" espessura={1.7} />
            <p>Use o chat da plataforma para conversar e combinar detalhes.</p>
          </div>
          <Link className="saiba" to="/ajuda/dicas-de-seguranca">
            Saiba mais sobre segurança
            <Icone nome="seta-link" tamanho={18} cor="#3E8B22" espessura={1.8} />
          </Link>
        </section>
      </div>
    </LayoutPainel>
  );
}
