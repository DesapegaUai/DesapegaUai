import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import MenuLateral from '../components/MenuLateral.jsx';
import Rodape from '../components/RodapeMarketplace.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import { NAO_LIDAS_TOTAL } from '../services/conversas.js';
import {
  ACOES_RAPIDAS, LINKS_CONTA, MEUS_ANUNCIOS, NUMEROS, USUARIO,
} from '../services/perfil.js';
import { formatarPreco } from '../services/formatar.js';
import '../styles/marketplace-perfil.css';

const logoPrincipal = '/img/logo-principal.svg';

const ABAS_INFERIORES = [
  { rotulo: 'Início', icone: 'inicio', para: '/', fim: true },
  { rotulo: 'Categorias', icone: 'grade', para: '/categoria/casa' },
  { rotulo: 'Favoritos', icone: 'favorito', para: '/favoritos' },
  { rotulo: 'Mensagens', icone: 'mensagens', para: '/conversas', selo: NAO_LIDAS_TOTAL },
  { rotulo: 'Perfil', icone: 'perfil', para: '/perfil' },
];

function Avatar({ foto, classe }) {
  return (
    <span className={classe}>
      {foto ? <img src={foto} alt="" /> : USUARIO.iniciais}
    </span>
  );
}

/**
 * Meu perfil (protótipo 11-perfil, layout "painel"):
 * topo · menu lateral · [perfil, números, Conta, Meus anúncios] + [Resumo, Ações rápidas, Segurança] · rodapé.
 * Celular: layout enxuto (revisão 26/10) + menu inferior.
 */
export default function Perfil() {
  const navegar = useNavigate();
  const { hash } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [termo, setTermo] = useState('');
  const [foto, setFoto] = useState(null);
  const fotoRef = useRef(null);
  const buscaRef = useRef(null);
  const fecharMenu = useCallback(() => setMenuAberto(false), []);

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
    // TODO: enviar a foto para a API
    setFoto(URL.createObjectURL(arquivo));
  }

  function buscar(e) {
    e.preventDefault();
    const q = termo.trim();
    if (q) navegar(`/busca?q=${encodeURIComponent(q)}`);
  }

  function alternarBusca() {
    const abrir = !buscaAberta;
    setBuscaAberta(abrir);
    if (abrir) setTimeout(() => buscaRef.current?.focus(), 0);
  }

  const sair = () => { /* TODO: logout na API e voltar para o Login */ };

  return (
    <div className="painel">
      {/* ---------- Topo ---------- */}
      <header className={`painel-topo${buscaAberta ? ' buscando' : ''}`}>
        <button type="button" className="burger" aria-label="Abrir menu" aria-expanded={menuAberto} onClick={() => setMenuAberto(true)}>
          <Icone nome="menu" tamanho={22} cor="#3E8B22" espessura={1.7} />
        </button>
        <Link to="/" className="brand" aria-label="DesapegaUai — página inicial">
          <img src={logoPrincipal} alt="DesapegaUai" width="187" height="40" />
        </Link>
        <button
          type="button"
          className="lupa"
          aria-label={buscaAberta ? 'Fechar busca' : 'Buscar'}
          aria-expanded={buscaAberta}
          onClick={alternarBusca}
        >
          <Icone nome={buscaAberta ? 'fechar' : 'busca'} tamanho={22} cor="#3E8B22" espessura={1.7} />
        </button>
        <form className="search" role="search" onSubmit={buscar}>
          <Icone nome="busca" tamanho={20} cor="#8C918B" espessura={1.7} />
          <label htmlFor="busca-painel" className="oculto">Buscar</label>
          <input
            id="busca-painel"
            ref={buscaRef}
            type="search"
            placeholder="Buscar anúncios, categorias ou produtos..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoComplete="off"
          />
        </form>
        <div className="tacts">
          <Link className="pub" to="/anunciar" aria-label="Publicar anúncio">
            <Icone nome="mais" tamanho={20} cor="#fff" espessura={2} />
            <span className="rot">Publicar anúncio</span>
          </Link>
          {/* TODO: a tela de notificações ainda não foi desenhada */}
          <button type="button" className="ic-topo" aria-label="Notificações (há novidades)">
            <Icone nome="sino" tamanho={24} cor="#3E8B22" espessura={1.7} />
            <i />
          </button>
          <Link className="ic-topo" to="/conversas" aria-label="Mensagens">
            <Icone nome="mensagens" tamanho={24} cor="#3E8B22" espessura={1.7} />
          </Link>
          <Link className="me" to="/perfil" aria-label="Meu perfil">
            <Avatar foto={foto} classe="ph" />
            <Icone nome="seta-baixo" tamanho={18} cor="#6B726C" espessura={1.7} />
          </Link>
        </div>
      </header>

      <MenuLateral modo="gaveta" aberto={menuAberto} onFechar={fecharMenu} onSair={sair} />

      <div className="painel-corpo">
        <MenuLateral modo="fixo" onSair={sair} />

        <main className="painel-main">
          {/* ---------- Coluna esquerda ---------- */}
          <div className="colL">
            <section className="hero" aria-label="Seu perfil">
              <span className="ring" /><span className="ring2" />
              <div className="avwrap">
                <Avatar foto={foto} classe="av" />
                <button type="button" className="avbtn" aria-label="Trocar foto do perfil" onClick={() => fotoRef.current?.click()}>
                  <Icone nome="camera" tamanho={21} cor="#fff" espessura={1.8} />
                </button>
                <input ref={fotoRef} type="file" accept="image/*" className="oculto" tabIndex={-1} aria-hidden="true" onChange={trocarFoto} />
              </div>
              <div className="hero-txt">
                <h1 className="hname">{USUARIO.nome}</h1>
                <div className="huser">{USUARIO.usuario}</div>
                <div className="hmeta cel">
                  <span>Membro desde {USUARIO.membroDesde}</span>
                  <span className="selo-rep">{USUARIO.reputacao}</span>
                </div>
                <p className={`hbio${USUARIO.bio ? '' : ' vazia'}`}>
                  {USUARIO.bio || 'Adicione uma bio (opcional) — conte um pouco sobre você.'}
                </p>
                {/* TODO: tela "Editar perfil" ainda não desenhada */}
                <button type="button" className="edit">
                  <Icone nome="lapis" tamanho={19} cor="#fff" espessura={1.8} />
                  Editar perfil
                </button>
              </div>
            </section>

            <section className="bloco kpis" aria-label="Seus números">
              {NUMEROS.map((n) => (
                <div className="kpi" key={n.rotulo}>
                  <Icone nome={n.icone} tamanho={26} cor="#4CA02B" espessura={1.75} />
                  <b>{n.valor}</b>
                  <i>{n.rotulo}</i>
                </div>
              ))}
            </section>

            <h2 className="grp cel">Conta</h2>
            <nav className="bloco links" aria-label="Conta">
              {LINKS_CONTA.map((l) => (
                <a className="lk" href="#" key={l.titulo}>
                  <span className="ib"><Icone nome={l.icone} tamanho={22} cor="#3E8B22" espessura={1.7} /></span>
                  <span className="tx"><b>{l.titulo}</b><i>{l.descricao}</i></span>
                  <Icone nome="seta-direita" tamanho={18} cor="#9AA39B" espessura={1.8} />
                </a>
              ))}
            </nav>

            <h2 className="grp grp-ajuda cel">Ajuda</h2>
            <nav className="bloco links ajuda cel" aria-label="Ajuda">
              <a className="lk" href="#">
                <span className="ib"><Icone nome="ajuda" tamanho={22} cor="#3E8B22" espessura={1.7} /></span>
                <span className="tx"><b>Ajuda e suporte</b></span>
              </a>
              <a className="lk" href="#">
                <span className="ib"><Icone nome="verificado" tamanho={22} cor="#3E8B22" espessura={1.7} /></span>
                <span className="tx"><b>Dicas de segurança</b></span>
              </a>
              <button type="button" className="lk sair" onClick={sair}>
                <span className="ib"><Icone nome="sair" tamanho={22} cor="#C0392B" espessura={1.7} /></span>
                <span className="tx"><b>Sair</b></span>
              </button>
            </nav>

            <section className="bloco sec" id="meus-anuncios" aria-labelledby="titulo-meus-anuncios">
              <div className="sech">
                <h2 id="titulo-meus-anuncios">Meus anúncios</h2>
                <a href="#">Ver todos<span className="cel"> ({USUARIO.anunciosAtivos})</span></a>
              </div>
              <ul className="ads">
                {MEUS_ANUNCIOS.map((a) => (
                  <li className="ad" key={a.id}>
                    <span className="th">
                      {a.foto
                        ? <img src={a.foto} alt={a.titulo} loading="lazy" />
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
                      <span className="tagA">{a.status}</span>
                    </span>
                    {/* TODO: menu do anúncio (editar, pausar, excluir) */}
                    <button type="button" className="ad-mais" aria-label={`Mais opções de ${a.titulo}`}>
                      <Icone nome="mais-horizontal" tamanho={18} cor="#9AA39B" espessura={1.9} />
                    </button>
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
                  <span className="v">{USUARIO.membroDesdeExtenso}</span>
                </div>
                <div className="rrow">
                  <span className="l"><Icone nome="relogio" tamanho={20} cor="#4CA02B" espessura={1.7} />Último acesso</span>
                  <span className="v">{USUARIO.ultimoAcesso}</span>
                </div>
                <div className="rrow">
                  <span className="l"><Icone nome="estrela" tamanho={20} cor="#4CA02B" espessura={1.7} />Avaliação média</span>
                  <span className="v">
                    <span className="estrelas" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Icone key={n} nome="estrela" tamanho={16} cor="none" preenchimento="#4CA02B" espessura={0} />
                      ))}
                    </span>
                    <span>
                      {USUARIO.avaliacao.toLocaleString('pt-BR')} ({USUARIO.qtdAvaliacoes})
                      <span className="oculto"> avaliações, nota de 0 a 5</span>
                    </span>
                  </span>
                </div>
                <div className="rrow">
                  <span className="l"><Icone nome="verificado" tamanho={20} cor="#4CA02B" espessura={1.7} />Reputação</span>
                  <span className="v"><span className="selo-rep">{USUARIO.reputacao}</span></span>
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
              <a className="saiba" href="#">
                Saiba mais sobre segurança
                <Icone nome="seta-link" tamanho={18} cor="#3E8B22" espessura={1.8} />
              </a>
            </section>
          </div>
        </main>
      </div>

      <Rodape />

      {/* ---------- Menu inferior (celular) ---------- */}
      <nav className="tabbar" aria-label="Navegação principal">
        {ABAS_INFERIORES.map((t) => (
          <NavLink key={t.rotulo} to={t.para} end={t.fim} className={({ isActive }) => `tb${isActive ? ' on' : ''}`}>
            {({ isActive }) => (
              <>
                <Icone nome={t.icone} tamanho={23} cor={isActive ? '#3E8B22' : '#8C918B'} espessura={1.7} />
                <span>{t.rotulo}</span>
                {t.selo > 0 && <i className="tb-selo" aria-label={`${t.selo} não lidas`}>{t.selo}</i>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
