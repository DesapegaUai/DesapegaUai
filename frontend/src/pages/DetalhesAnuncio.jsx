import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import CardAnuncio from '../components/CardAnuncioMarketplace.jsx';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import { anunciosParecidos, buscarAnuncio, nomeDaCategoria, textoDaEntrega } from '../services/catalogo.js';
import { caminhoCategoria } from '../services/categorias.js';
import { abrirConversaDoAnuncio } from '../services/conversas.js';
import { formatarPreco } from '../services/formatar.js';
import { Estrelas } from '../components/Estrelas.jsx';
import { resumoDe, textoDaMedia, useAvaliacoes } from '../services/avaliacoes.js';
import '../styles/marketplace-detalhes.css';

const SEGURANCA = [
  { icone: 'local', texto: 'Encontre-se em locais públicos e movimentados.' },
  { icone: 'olho', texto: 'Confira o produto antes de fechar o negócio.' },
  { icone: 'escudo-simples', texto: 'Nunca pague adiantado.' },
];

function Galeria({ titulo, fotos }) {
  const [atual, setAtual] = useState(0);
  const foto = fotos[atual];

  return (
    <div className="det-galeria">
      <div className="det-foto">
        {foto ? (
          <>
            <img className="det-foto-fundo" src={foto} alt="" aria-hidden="true" />
            <img className="det-foto-img" src={foto} alt={`${titulo}, foto ${atual + 1} de ${fotos.length}`} />
          </>
        ) : <span role="img" aria-label="Anúncio sem foto"><Icone nome="imagem" tamanho={64} cor="#9AA39B" espessura={1.3} /></span>}
      </div>
      {fotos.length > 1 && (
        <div className="det-miniaturas">
          {fotos.map((f, i) => (
            <button type="button" key={f} className={i === atual ? 'on' : undefined} onClick={() => setAtual(i)} aria-label={`Ver foto ${i + 1}`} aria-pressed={i === atual}>
              <img src={f} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Conteudo({ anuncio }) {
  const navegar = useNavigate();
  const [favorito, setFavorito] = useState(false);
  const [favoritos, setFavoritos] = useState(() => new Set());
  const categoria = nomeDaCategoria(anuncio.categoria);
  const vendido = anuncio.status === 'vendido';
  const parecidos = anunciosParecidos(anuncio);
  const notas = resumoDe(useAvaliacoes(), anuncio.meu ? 'eu' : anuncio.vendedor.nome);
  const ultima = notas.lista.find((a) => a.comentario);

  const dados = [
    anuncio.condicao && { rotulo: 'Condição', valor: anuncio.condicao },
    { rotulo: 'Categoria', valor: categoria },
    { rotulo: 'Bairro', valor: anuncio.bairro || 'A combinar' },
    { rotulo: 'Cidade', valor: anuncio.cidade },
    { rotulo: 'Entrega', valor: textoDaEntrega(anuncio.entrega) },
  ].filter(Boolean);

  function conversar() {
    navegar(`/conversas/${abrirConversaDoAnuncio(anuncio)}`);
  }

  function alternarParecido(id) {
    setFavoritos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  return (
    <>
      <nav aria-label="Você está em">
        <ol className="trilha det-trilha">
          <li><Link to="/">Início</Link></li>
          <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>
          <li><Link to={caminhoCategoria(anuncio.categoria)}>{categoria}</Link></li>
          <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>
          <li><span className="at" aria-current="page">{anuncio.titulo}</span></li>
        </ol>
      </nav>

      <div className="det-corpo">
        <div className="det-principal">
          <Galeria key={anuncio.id} titulo={anuncio.titulo} fotos={anuncio.fotos} />

          <section className="det-bloco" aria-labelledby="det-descricao">
            <h2 id="det-descricao">Descrição</h2>
            <p className="det-texto">{anuncio.descricao || 'O vendedor não adicionou uma descrição.'}</p>
          </section>

          <section className="det-bloco" aria-labelledby="det-dados">
            <h2 id="det-dados">Detalhes</h2>
            <dl className="det-dados">
              {dados.map((d) => (
                <div key={d.rotulo}><dt>{d.rotulo}</dt><dd>{d.valor}</dd></div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="det-lado" aria-label="Resumo do anúncio">
          <section className="det-bloco det-resumo">
            {vendido && <span className="det-vendido">Vendido</span>}
            <h1>{anuncio.titulo}</h1>
            <p className="det-preco">{formatarPreco(anuncio.preco, anuncio.unidade)}</p>
            <p className="det-local"><Icone nome="local" tamanho={19} cor="#4CA02B" />{anuncio.bairro ? `${anuncio.bairro}, ` : ''}{anuncio.cidade}</p>

            {anuncio.meu ? (
              <>
                <p className="det-seu">Este anúncio é seu.</p>
                {!vendido && (
                  <Link className="det-btn solido" to={`/anuncios/${anuncio.id}/editar`}>
                    <Icone nome="lapis" tamanho={20} cor="#fff" espessura={1.8} />Editar anúncio
                  </Link>
                )}
                <Link className="det-btn" to="/meus-anuncios">Ver meus anúncios</Link>
              </>
            ) : (
              <>
                <button type="button" className="det-btn solido" onClick={conversar} disabled={vendido}>
                  <Icone nome="mensagens" tamanho={21} cor="#fff" />{vendido ? 'Anúncio vendido' : 'Conversar'}
                </button>
                <button type="button" className={`det-btn${favorito ? ' salvo' : ''}`} aria-pressed={favorito} onClick={() => setFavorito((f) => !f)}>
                  <Icone nome="favorito" tamanho={21} cor="#3E8B22" preenchimento={favorito ? '#3E8B22' : 'none'} />
                  {favorito ? 'Salvo nos favoritos' : 'Favoritar'}
                </button>
              </>
            )}
          </section>

          <section className="det-bloco det-vendedor" aria-labelledby="det-vendedor">
            <h2 id="det-vendedor">Vendedor</h2>
            <div>
              <span className="det-avatar" aria-hidden="true">{anuncio.vendedor.iniciais}</span>
              <span>
                <b>{anuncio.vendedor.nome}</b><i>No DesapegaUai desde {anuncio.vendedor.desde}</i>
                <span className="det-reputacao">
                  {notas.qtd ? (
                    <><Estrelas nota={notas.media} /><b>{textoDaMedia(notas.media)}</b><span>· {notas.qtd} {notas.qtd === 1 ? 'avaliação' : 'avaliações'}</span>
                      <span className="oculto">Nota média {textoDaMedia(notas.media)} de 5</span></>
                  ) : 'Ainda sem avaliações'}
                </span>
              </span>
            </div>
            {ultima && (
              <figure className="det-ultima">
                <p>“{ultima.comentario}”</p>
                <small><Estrelas nota={ultima.nota} tamanho={13} />{ultima.autor} · {ultima.quando}</small>
              </figure>
            )}
            <p className="det-privado">
              <Icone nome="cadeado" tamanho={18} cor="#3E8B22" />
              O telefone e o e-mail do vendedor não aparecem no anúncio. O contato é feito somente pelo chat.
            </p>
          </section>

          <section className="det-bloco det-seguranca" aria-labelledby="det-seguranca">
            <h2 id="det-seguranca">Negocie com segurança</h2>
            <ul>
              {SEGURANCA.map((s) => <li key={s.texto}><Icone nome={s.icone} tamanho={20} cor="#4CA02B" />{s.texto}</li>)}
            </ul>
          </section>
        </aside>
      </div>

      {parecidos.length > 0 && (
        <section className="det-parecidos" aria-labelledby="det-parecidos">
          <h2 id="det-parecidos">Mais em {categoria}</h2>
          <div className="det-grade">
            {parecidos.map((a) => (
              <CardAnuncio key={a.id} anuncio={a} favorito={favoritos.has(a.id)} onFavoritar={alternarParecido} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Detalhes do anúncio: fotos, preço, descrição, vendedor e botão de conversar. */
export default function DetalhesAnuncio() {
  const { id } = useParams();
  const anuncio = buscarAnuncio(id);
  const titulo = anuncio?.titulo;

  useEffect(() => {
    document.title = `DesapegaUai — ${titulo ?? 'Anúncio não encontrado'}`;
  }, [titulo]);

  return (
    <LayoutMarketplace comFab={false}>
      {anuncio ? <Conteudo key={anuncio.id} anuncio={anuncio} /> : (
        <div className="det-vazio">
          <Icone nome="etiqueta" tamanho={40} cor="#4CA02B" />
          <h1>Anúncio não encontrado</h1>
          <p>Ele pode ter sido vendido ou excluído.</p>
          <Link to="/categoria/casa">Explorar categorias</Link>
        </div>
      )}
    </LayoutMarketplace>
  );
}
