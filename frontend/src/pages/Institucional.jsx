import { useEffect } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import { PAGINAS_INSTITUCIONAIS, buscarPaginaInstitucional } from '../services/institucional.js';
import '../styles/marketplace-institucional.css';

function Secao({ secao }) {
  return (
    <section className="ins-secao">
      {secao.titulo && <h2>{secao.titulo}</h2>}
      {secao.paragrafos?.map((p) => <p key={p}>{p}</p>)}
      {secao.lista && <ul className="ins-lista">{secao.lista.map((item) => <li key={item}>{item}</li>)}</ul>}
      {secao.passos && <ol className="ins-passos">{secao.passos.map((item) => <li key={item}>{item}</li>)}</ol>}
      {secao.tabela && (
        <div className="ins-tabela">
          <table>
            <thead><tr>{secao.tabela.cabecalho.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>
              {secao.tabela.linhas.map(([campo, ...resto]) => (
                <tr key={campo}><th scope="row">{campo}</th>{resto.map((v) => <td key={v}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {secao.perguntas && (
        <div className="ins-perguntas">
          {secao.perguntas.map(([pergunta, resposta]) => (
            <details key={pergunta}>
              <summary>{pergunta}<Icone nome="seta-baixo" tamanho={20} cor="#3E8B22" /></summary>
              <p>{resposta}</p>
            </details>
          ))}
        </div>
      )}
      {secao.cartoes && (
        <div className="ins-cartoes">
          {secao.cartoes.map(([icone, titulo, texto]) => (
            <div className="ins-cartao" key={titulo}>
              <span className="ins-icone"><Icone nome={icone} tamanho={22} cor="#3E8B22" /></span>
              <b>{titulo}</b>
              <p>{texto}</p>
            </div>
          ))}
        </div>
      )}
      {secao.link && (
        <Link className="ins-link" to={secao.link.para}>
          {secao.link.texto}<Icone nome="seta-direita" tamanho={18} cor="#3E8B22" />
        </Link>
      )}
      {secao.externo && (
        <a className="ins-link" href={secao.externo.href} target="_blank" rel="noreferrer">
          <Icone nome="instagram" tamanho={20} cor="#3E8B22" />{secao.externo.texto}
        </a>
      )}
    </section>
  );
}

/** Ajuda e páginas institucionais: /ajuda/como-funciona, /ajuda/termos-de-uso... */
export default function Institucional() {
  const { pagina } = useParams();
  const atual = buscarPaginaInstitucional(pagina);

  useEffect(() => {
    if (atual) document.title = `DesapegaUai — ${atual.titulo}`;
  }, [atual]);

  if (!atual) return <Navigate to="/ajuda/como-funciona" replace />;

  return (
    <LayoutMarketplace comAbas={false} comFab={false}>
      <nav aria-label="Você está em">
        <ol className="trilha">
          <li><Link to="/">Início</Link></li>
          <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>
          <li><Link to="/ajuda/como-funciona">Ajuda</Link></li>
          <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>
          <li><span className="at" aria-current="page">{atual.titulo}</span></li>
        </ol>
      </nav>

      <div className="ins-corpo">
        <nav className="ins-menu" aria-label="Páginas de ajuda">
          {PAGINAS_INSTITUCIONAIS.map((p) => (
            <NavLink key={p.slug} to={`/ajuda/${p.slug}`} className={({ isActive }) => (isActive ? 'on' : undefined)}>
              {p.titulo}
            </NavLink>
          ))}
        </nav>

        <article className="ins-conteudo">
          <h1 className="t-titulo-1">{atual.titulo}</h1>
          <p className="ins-resumo">{atual.resumo}</p>
          {atual.aviso && <p className="ins-aviso">{atual.aviso}</p>}
          {atual.secoes.map((s, i) => <Secao key={s.titulo ?? i} secao={s} />)}
        </article>
      </div>
    </LayoutMarketplace>
  );
}
