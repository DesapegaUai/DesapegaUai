import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import CardAnuncio from '../components/CardAnuncioMarketplace.jsx';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import MapaAnuncios from '../components/MapaAnuncios.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import { Estrelas } from '../components/Estrelas.jsx';
import SeloVinculo from '../components/SeloVinculo.jsx';
import SemFoto from '../components/SemFoto.jsx';
import Toast from '../components/Toast.jsx';
import useFavoritar from '../hooks/useFavoritar.js';
import { carregarAvaliacoesUsuario, resumoDe, textoDaMedia, useAvaliacoes } from '../services/avaliacoes.js';
import { caminhoCategoria, buscarCategoria } from '../services/categorias.js';
import { formatarPreco } from '../services/formatar.js';
import { origemDaBusca, useLocalizacao } from '../services/localizacao.js';
import { abrirConversa, buscarProximos, verAnuncio } from '../services/mercadoApi.js';
import { ENTREGAS, TRANSPORTES } from '../services/meusAnuncios.js';
import { useSessao } from '../services/sessao.js';
import { ouvir } from '../services/tempoReal.js';
import '../styles/marketplace-detalhes.css';
import '../styles/marketplace-perfil-publico.css';

const SEGURANCA = [
  { icone: 'local', texto: 'Encontre-se em locais públicos e movimentados.' },
  { icone: 'olho', texto: 'Confira o produto antes de fechar o negócio.' },
  { icone: 'escudo-simples', texto: 'Nunca pague adiantado.' },
];

function Galeria({ titulo, fotos, categoria }) {
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
        ) : <SemFoto categoria={categoria} tamanho={64} />}
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

function Conteudo({ anuncio: inicial }) {
  const navegar = useNavigate();
  const rota = useLocation();
  const { usuario } = useSessao();
  const local = useLocalizacao();
  const [anuncio, setAnuncio] = useState(inicial);
  const [toast, setToast] = useState(null);
  const [parecidos, setParecidos] = useState([]);
  const [avaliacoesDe, setAvaliacoesDe] = useState(null);
  const vendido = anuncio.status === 'vendido';
  const reservado = anuncio.status === 'reservado';
  const vendedorId = Number(anuncio.vendedor.id);
  const notas = resumoDe(useAvaliacoes(), vendedorId);
  const ultima = notas.lista.find((a) => a.comentario);
  const lugar = anuncio.localizacao_anuncio;
  const avisar = (tipo, titulo, texto) => setToast({ tipo, titulo, texto, chave: Date.now() });
  const favoritarAnuncio = useFavoritar({
    aoMudar: (id, favoritado) => setAnuncio((a) => ({ ...a, favoritado })),
    aoErrar: (erro) => avisar('erro', 'Não foi possível salvar o favorito', erro.message),
  });

  useEffect(() => {
    let ativo = true;
    carregarAvaliacoesUsuario(vendedorId)
      .catch((erro) => { if (ativo) avisar('erro', 'Não foi possível carregar as avaliações', erro.message); })
      .finally(() => { if (ativo) setAvaliacoesDe(vendedorId); });
    return () => { ativo = false; };
  }, [vendedorId]);

  useEffect(() => {
    let ativo = true;
    // hiperlocal: primeiro os da mesma cidade do anúncio; cidade vizinha só entra se faltar, e com a etiqueta
    buscarProximos({ ...origemDaBusca(local), raio_km: 50, categoria_id: anuncio.categoria_id, por_pagina: 24 })
      .then((r) => {
        if (!ativo) return;
        const outros = r.itens.filter((a) => a.id !== anuncio.id);
        const daCidade = outros.filter((a) => a.cidade === anuncio.cidade);
        const vizinhos = outros.filter((a) => a.cidade !== anuncio.cidade).map((a) => ({ ...a, vizinho: true }));
        setParecidos([...daCidade, ...vizinhos].slice(0, 3));
      })
      .catch(() => {});
    return () => { ativo = false; };
  }, [anuncio.id, anuncio.categoria_id, anuncio.cidade, local]);

  // vendido ou excluído enquanto a página está aberta
  useEffect(() => ouvir('anuncio_removido', ({ id, motivo }) => {
    if (id !== anuncio.id) return;
    if (motivo === 'vendido') setAnuncio((a) => ({ ...a, status: 'vendido' }));
    else avisar('info', 'Este anúncio foi excluído pelo vendedor');
  }), [anuncio.id]);

  // reservado ou liberado pelo vendedor enquanto a página está aberta
  useEffect(() => ouvir('anuncio_atualizado', ({ id, status }) => {
    if (id === anuncio.id && status) setAnuncio((a) => ({ ...a, status }));
  }), [anuncio.id]);

  async function conversar() {
    if (!usuario) {
      navegar('/entrar', { state: { voltar: rota.pathname } });
      return;
    }
    try {
      const resultado = await abrirConversa(anuncio.id);
      navegar(`/conversas/${resultado.conversa.id}`);
    } catch (erro) {
      avisar('erro', 'Não foi possível abrir a conversa', erro.message);
    }
  }

  const categoria = buscarCategoria(anuncio.categoria)?.nome ?? anuncio.categoria_nome ?? 'Anúncios';
  const dados = [
    anuncio.condicaoTexto && { rotulo: 'Condição', valor: anuncio.condicaoTexto },
    { rotulo: 'Categoria', valor: anuncio.categoria ? categoria : '—' },
    // bairro e cidade já aparecem ao lado do preço e no mapa: aqui não se repetem
    anuncio.localizacao && { rotulo: 'Ponto de referência', valor: anuncio.localizacao },
    { rotulo: 'Entrega', valor: ENTREGAS[anuncio.entrega]?.titulo ?? '' },
    TRANSPORTES[anuncio.transporte] && { rotulo: 'Como levar', valor: TRANSPORTES[anuncio.transporte].titulo },
  ].filter(Boolean);

  return (
    <>
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      <nav aria-label="Você está em">
        <ol className="trilha det-trilha">
          <li><Link to="/">Início</Link></li>
          <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>
          {anuncio.categoria && <li><Link to={caminhoCategoria(anuncio.categoria)}>{categoria}</Link></li>}
          {anuncio.categoria && <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>}
          <li><span className="at" aria-current="page">{anuncio.titulo}</span></li>
        </ol>
      </nav>

      <div className="det-corpo">
        <div className="det-principal">
          <Galeria key={anuncio.id} titulo={anuncio.titulo} fotos={anuncio.fotos} categoria={anuncio.categoria} />

          <section className="det-bloco" aria-labelledby="det-descricao">
            <h2 id="det-descricao">Descrição</h2>
            <p className="det-texto">{anuncio.descricao || 'O vendedor não adicionou uma descrição.'}</p>
          </section>

          <section className="det-bloco" aria-labelledby="det-dados">
            <h2 id="det-dados">Detalhes</h2>
            <dl className="det-dados">
              {dados.map((d) => <div key={d.rotulo}><dt>{d.rotulo}</dt><dd>{d.valor}</dd></div>)}
            </dl>
          </section>

          {lugar && (
            <section className="det-bloco" aria-labelledby="det-mapa">
              <h2 id="det-mapa">Onde está</h2>
              <MapaAnuncios
                area={{ latitude: lugar.latitude, longitude: lugar.longitude, raioM: lugar.raio_aproximacao_m ?? 400, rotulo: `${lugar.bairro.nome}, ${lugar.cidade.nome}` }}
                ponto={anuncio.meu && lugar.exata ? lugar.exata : null}
                zoom={15}
                altura={260}
                rotulo={`Região aproximada do anúncio em ${lugar.bairro.nome}, ${lugar.cidade.nome}`}
              />
              <p className="det-privado">
                <Icone nome="cadeado" tamanho={18} cor="#3E8B22" />
                {anuncio.meu
                  ? `Só você vê o ponto exato${lugar.rua ? `, o endereço (${lugar.rua})` : ''}${lugar.cep ? ` e o CEP (${lugar.cep.replace(/(\d{5})(\d{3})/, '$1-$2')})` : ''}. Os outros veem a região aproximada.`
                  : 'A região é aproximada para proteger o endereço de quem vende. Combine o local de encontro pelo chat.'}
              </p>
            </section>
          )}
        </div>

        <aside className="det-lado" aria-label="Resumo do anúncio">
          <section className="det-bloco det-resumo">
            {vendido && <span className="det-vendido">Vendido</span>}
            {reservado && <span className="det-vendido reservado">Reservado</span>}
            <h1>{anuncio.titulo}</h1>
            <p className="det-preco">{formatarPreco(anuncio.preco)}</p>
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
                <button type="button" className={`det-btn${anuncio.favoritado ? ' salvo' : ''}`} aria-pressed={anuncio.favoritado} onClick={() => favoritarAnuncio(anuncio)}>
                  <Icone nome="favorito" tamanho={21} cor="#3E8B22" preenchimento={anuncio.favoritado ? '#3E8B22' : 'none'} />
                  {anuncio.favoritado ? 'Salvo nos favoritos' : 'Favoritar'}
                </button>
              </>
            )}
          </section>

          <section className="det-bloco det-vendedor" aria-labelledby="det-vendedor">
            <h2 id="det-vendedor">Vendedor</h2>
            <div>
              <Link className="link-perfil" to={`/usuario/${vendedorId}`} aria-label={`Ver o perfil de ${anuncio.vendedor.nome}`}>
                {anuncio.vendedor.foto_url
                  ? <img className="det-avatar" src={anuncio.vendedor.foto_url} alt="" referrerPolicy="no-referrer" />
                  : <span className="det-avatar" aria-hidden="true">{anuncio.vendedor.iniciais}</span>}
              </Link>
              <span>
                <Link className="link-perfil" to={`/usuario/${vendedorId}`} title="Ver perfil"><b>{anuncio.vendedor.nome}</b></Link><i>No DesapegaUai desde {anuncio.vendedor.desde}</i>
                {anuncio.vendedor.vinculo_academico && <SeloVinculo />}
                <span className="det-reputacao">
                  {notas.qtd ? (
                    <><Estrelas nota={notas.media} /><b>{textoDaMedia(notas.media)}</b><span>· {notas.qtd} {notas.qtd === 1 ? 'avaliação' : 'avaliações'}</span>
                      <span className="oculto">Nota média {textoDaMedia(notas.media)} de 5</span></>
                  ) : avaliacoesDe !== vendedorId ? 'Carregando avaliações…' : 'Ainda sem avaliações'}
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
            <ul>{SEGURANCA.map((s) => <li key={s.texto}><Icone nome={s.icone} tamanho={20} cor="#4CA02B" />{s.texto}</li>)}</ul>
          </section>
        </aside>
      </div>

      {parecidos.length > 0 && (
        <section className="det-parecidos" aria-labelledby="det-parecidos">
          <h2 id="det-parecidos">Mais perto em {categoria}</h2>
          <div className="det-grade">
            {parecidos.map((a) => <CardAnuncio key={a.id} anuncio={a} selo={a.vizinho ? 'Cidade vizinha' : null} />)}
          </div>
        </section>
      )}
    </>
  );
}

/** Detalhes do anúncio: fotos, preço, descrição, vendedor, região aproximada e conversar. */
export default function DetalhesAnuncio() {
  const { id } = useParams();
  const [resultado, setResultado] = useState(null);
  const valido = /^\d+$/.test(String(id));

  useEffect(() => {
    if (!valido) return undefined;
    let ativo = true;
    verAnuncio(id)
      .then((anuncio) => { if (ativo) setResultado({ id, anuncio, erro: null }); })
      .catch((erro) => { if (ativo) setResultado({ id, anuncio: null, erro: erro.message }); });
    return () => { ativo = false; };
  }, [id, valido]);

  const atual = resultado?.id === id ? resultado : null;
  const carregando = valido && !atual;
  const anuncio = atual?.anuncio;

  useEffect(() => {
    document.title = `DesapegaUai — ${anuncio?.titulo ?? (carregando ? 'Carregando' : 'Anúncio não encontrado')}`;
  }, [anuncio?.titulo, carregando]);

  return (
    <LayoutMarketplace comFab={false}>
      {anuncio ? <Conteudo key={anuncio.id} anuncio={anuncio} /> : (
        <div className="det-vazio">
          <Icone nome="etiqueta" tamanho={40} cor="#4CA02B" />
          <h1>{carregando ? 'Carregando anúncio…' : 'Anúncio não encontrado'}</h1>
          <p>{carregando ? 'Aguarde enquanto buscamos os detalhes.' : (atual?.erro && !/não encontrado/i.test(atual.erro) ? atual.erro : 'Ele pode ter sido vendido ou excluído.')}</p>
          <Link to="/busca">Ver anúncios perto de você</Link>
        </div>
      )}
    </LayoutMarketplace>
  );
}
