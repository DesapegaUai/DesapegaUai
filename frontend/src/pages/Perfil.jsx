import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import AcoesAnuncio from '../components/AcoesAnuncio.jsx';
import LayoutPainel from '../components/LayoutPainel.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import Toast from '../components/Toast.jsx';
import useSair from '../hooks/useSair.js';
import { formatarPreco } from '../services/formatar.js';
import { ROTULO_STATUS, useMeusAnuncios } from '../services/meusAnuncios.js';
import { ACOES_RAPIDAS, LINKS_CONTA, NUMEROS, usePerfil } from '../services/perfil.js';
import { Estrelas } from '../components/Estrelas.jsx';
import { reputacao, resumoDe, textoDaMedia, useAvaliacoes } from '../services/avaliacoes.js';

function Avatar({ foto, classe, iniciais }) {
  return (
    <span className={classe}>
      {foto ? <img src={foto} alt="" /> : iniciais}
    </span>
  );
}

/**
 * Meu perfil (protótipo 11-perfil, layout "painel"):
 * [perfil, números, Conta, Meus anúncios] + [Resumo, Ações rápidas, Segurança].
 * Celular: layout enxuto (revisão 26/10) + menu inferior.
 */
export default function Perfil() {
  const { hash, state } = useLocation();
  const perfil = usePerfil();
  const anuncios = useMeusAnuncios();
  const sair = useSair();
  const [foto, setFoto] = useState(null);
  const [toast, setToast] = useState(() => state?.aviso ?? null);
  const fotoRef = useRef(null);

  const ativos = anuncios.filter((a) => a.status === 'ativo');
  const notas = resumoDe(useAvaliacoes(), 'eu');
  const selo = reputacao(notas);
  const numeros = NUMEROS.map((n) => {
    if (n.rotulo === 'Anúncios ativos') return { ...n, valor: ativos.length };
    if (n.icone === 'estrela') return { ...n, valor: notas.qtd ? textoDaMedia(notas.media) : '—', rotulo: `Avaliação (${notas.qtd})` };
    return n;
  });
  const avisar = (aviso) => setToast({ ...aviso, chave: Date.now() });

  useEffect(() => { document.title = 'DesapegaUai — Meu perfil'; }, []);
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto); }, [foto]);

  // /perfil#meus-anuncios → rola até o bloco
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  function trocarFoto(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo || !arquivo.type.startsWith('image/')) return;
    setFoto(URL.createObjectURL(arquivo));
  }

  return (
    <LayoutPainel foto={foto}>
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      {/* ---------- Coluna esquerda ---------- */}
      <div className="colL">
        <section className="hero" aria-label="Seu perfil">
          <span className="ring" /><span className="ring2" />
          <div className="avwrap">
            <Avatar foto={foto} classe="av" iniciais={perfil.iniciais} />
            <button type="button" className="avbtn" aria-label="Trocar foto do perfil" onClick={() => fotoRef.current?.click()}>
              <Icone nome="camera" tamanho={21} cor="#fff" espessura={1.8} />
            </button>
            <input ref={fotoRef} type="file" accept="image/*" className="oculto" tabIndex={-1} aria-hidden="true" onChange={trocarFoto} />
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

        <section className="bloco kpis" aria-label="Seus números">
          {numeros.map((n) => (
            <div className="kpi" key={n.rotulo}>
              <Icone nome={n.icone} tamanho={26} cor="#4CA02B" espessura={1.75} />
              <b>{n.valor}</b>
              <i>{n.rotulo}</i>
            </div>
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

        <section className="bloco sec" id="meus-anuncios" aria-labelledby="titulo-meus-anuncios">
          <div className="sech">
            <h2 id="titulo-meus-anuncios">Meus anúncios</h2>
            <Link to="/meus-anuncios">Ver todos<span className="cel"> ({ativos.length})</span></Link>
          </div>
          <ul className="ads">
            {ativos.slice(0, 3).map((a) => (
              <li className="ad" key={a.id}>
                <span className="th">
                  {a.fotos[0]
                    ? <img src={a.fotos[0]} alt={a.titulo} loading="lazy" />
                    : <Icone nome="imagem" tamanho={28} cor="#9AA39B" espessura={1.4} />}
                </span>
                <span className="in">
                  <Link className="tt" to={`/anuncio/${a.id}`}>{a.titulo}</Link>
                  <div className="pr">{formatarPreco(a.preco)}</div>
                  <div className="st">
                    <span aria-label={`${a.visualizacoes} visualizações`}>
                      <Icone nome="olho" tamanho={15} cor="#9AA39B" espessura={1.6} />{a.visualizacoes}
                    </span>
                    <span aria-label={`${a.favoritos} favoritos`}>
                      <Icone nome="favorito" tamanho={15} cor="#9AA39B" espessura={1.6} />{a.favoritos}
                    </span>
                  </div>
                  <span className="tagA">{ROTULO_STATUS[a.status]}</span>
                </span>
                <AcoesAnuncio anuncio={a} classeBotao="ad-mais" onAviso={avisar} />
              </li>
            ))}
          </ul>
        </section>

        <section className="bloco sec" aria-labelledby="titulo-avaliacoes">
          <div className="sech"><h2 id="titulo-avaliacoes">Avaliações recebidas</h2></div>
          <ul className="lista-aval">
            {notas.lista.slice(0, 3).map((a) => (
              <li key={a.id}>
                <div className="rec-cab">
                  <span className="rec-av" aria-hidden="true">{a.autor.split(' ').slice(0, 2).map((p) => p[0]).join('')}</span>
                  <span className="rec-nm"><b>{a.autor}</b><small>{a.anuncio} · {a.quando}</small></span>
                  <Estrelas nota={a.nota} tamanho={14} /><span className="oculto">Nota {a.nota} de 5</span>
                </div>
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
              <span className="l"><Icone nome="estrela" tamanho={20} cor="#4CA02B" espessura={1.7} />Avaliação média</span>
              <span className="v">
                <Estrelas nota={notas.media} />
                <span>
                  {textoDaMedia(notas.media)} ({notas.qtd})
                  <span className="oculto"> avaliações, nota de 0 a 5</span>
                </span>
              </span>
            </div>
            <div className="rrow">
              <span className="l"><Icone nome="verificado" tamanho={20} cor="#4CA02B" espessura={1.7} />Reputação</span>
              <span className="v"><span className="selo-rep">{selo}</span></span>
            </div>
          </div>
        </section>

        <section className="bloco sec" aria-labelledby="titulo-acoes">
          <div className="sech"><h2 id="titulo-acoes">Ações rápidas</h2></div>
          <div style={{ marginTop: 8 }}>
            {ACOES_RAPIDAS.map((a) => (
              <Link className="qa" to={a.para} key={a.rotulo}>
                <Icone nome={a.icone} tamanho={21} cor="#3E8B22" espessura={1.7} />
                <span className="l">{a.rotulo}</span>
                {a.contador
                  ? <span className="cnt" aria-label={`${a.contador} não lidas`}>{a.contador}</span>
                  : <Icone nome="seta-direita" tamanho={18} cor="#9AA39B" espessura={1.8} />}
              </Link>
            ))}
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
