import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import BarraChips from '../components/BarraChips.jsx';
import BarraDeRaio from '../components/BarraDeRaio.jsx';
import PainelFiltros from '../components/PainelFiltros.jsx';
import CardAnuncio from '../components/CardAnuncioMarketplace.jsx';
import Paginacao from '../components/Paginacao.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import Toast from '../components/Toast.jsx';
import useFavoritar from '../hooks/useFavoritar.js';
import useFeedProximo from '../hooks/useFeedProximo.js';
import useMediaQuery, { TABLET } from '../hooks/useMediaQuery.js';
import { CONDICOES, POR_PAGINA, filtrosParaApi, filtrosVazios } from '../services/anuncios.js';
import { buscarCategoria } from '../services/categorias.js';
import { definirRaio } from '../services/localizacao.js';
import { obterCategorias } from '../services/mercadoApi.js';

const alternarNaLista = (lista, item) => (lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item]);

/**
 * Tela de categoria (igual nas 8 categorias): anúncios da API perto da sua referência, dentro do
 * raio, com subcategoria, condição, preço e ordenação. Atualiza sozinha quando sai anúncio novo.
 */
export default function PaginaCategoria({ slug }) {
  const categoria = buscarCategoria(slug);
  const idPainel = `filtros-${slug}`;
  const ehGaveta = useMediaQuery(TABLET);
  const [dadosCategoria, setDadosCategoria] = useState(null);
  const [filtros, setFiltros] = useState(filtrosVazios);
  const [aplicados, setAplicados] = useState(filtrosVazios);
  const [ordem, setOrdem] = useState('proximos');
  const [pagina, setPagina] = useState(1);
  const [painelAberto, setPainelAberto] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    document.title = `DesapegaUai — ${categoria.nome}`;
    obterCategorias().then((lista) => setDadosCategoria(lista.find((c) => c.slug === slug) ?? null)).catch(() => {});
  }, [categoria.nome, slug]);

  const feed = useFeedProximo(dadosCategoria
    ? { categoria_id: dadosCategoria.id, ...filtrosParaApi(aplicados), ordenar: ordem, pagina, por_pagina: POR_PAGINA }
    : null);
  const favoritarAnuncio = useFavoritar({
    aoMudar: feed.marcarFavorito,
    aoErrar: (erro) => setToast({ tipo: 'erro', titulo: 'Não foi possível salvar o favorito', texto: erro.message, chave: Date.now() }),
  });

  if (!ehGaveta && painelAberto) setPainelAberto(false);

  const mudarFiltros = useCallback((parcial) => setFiltros((f) => ({ ...f, ...parcial })), []);
  const alternarOpcao = useCallback((grupo, valor) => {
    setFiltros((f) => ({ ...f, opcoes: { ...f.opcoes, [grupo]: alternarNaLista(f.opcoes[grupo], valor) } }));
  }, []);

  function alternarChip(subId) {
    const novos = { ...filtros, opcoes: { ...filtros.opcoes, subcategoria: alternarNaLista(filtros.opcoes.subcategoria, subId) } };
    setFiltros(novos);
    setAplicados(novos);
    setPagina(1);
  }

  function aplicar() {
    setAplicados(filtros);
    setPagina(1);
    setPainelAberto(false);
  }

  function limpar() {
    setFiltros(filtrosVazios());
    setAplicados(filtrosVazios());
    setPagina(1);
  }

  function mudarPagina(n) {
    setPagina(n);
    document.getElementById('topo-grade')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const fecharPainel = useCallback(() => setPainelAberto(false), []);
  const subcategorias = dadosCategoria?.subcategorias ?? [];
  const grupos = [
    { id: 'subcategoria', titulo: dadosCategoria?.rotulo_filtro ?? 'Tipo', opcoes: subcategorias.map((s) => ({ valor: s.id, rotulo: s.nome })) },
    ...(slug === 'servicos' ? [] : [{ id: 'condicao', titulo: 'Condição', opcoes: CONDICOES }]),
  ];
  const qtdFiltros = (filtros.precoMin ? 1 : 0) + (filtros.precoMax ? 1 : 0) + filtros.opcoes.condicao.length;
  const dados = feed.dados;

  return (
    <LayoutMarketplace>
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      <nav aria-label="Você está em">
        <ol className="trilha">
          <li><Link to="/">Início</Link></li>
          <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>
          <li><span className="at" aria-current="page">{categoria.nome}</span></li>
        </ol>
      </nav>

      <div className="titulo-pagina">
        <h1 className="t-titulo-1">{categoria.nome}</h1>
        <Link className="titulo-acao" to={`/mapa?categoria=${slug}`}><Icone nome="local" tamanho={17} cor="currentColor" espessura={1.8} />Ver no mapa</Link>
      </div>

      <BarraDeRaio total={dados?.total} carregando={feed.carregando} semConexao={feed.semConexao} />

      <BarraChips
        subcategorias={subcategorias}
        ativas={filtros.opcoes.subcategoria}
        onAlternar={alternarChip}
        ordem={ordem}
        onOrdenar={(o) => { setOrdem(o); setPagina(1); }}
        idPainel={idPainel}
        painelAberto={painelAberto}
        qtdFiltros={qtdFiltros}
        onAbrirFiltros={() => setPainelAberto(true)}
      />

      <div className="corpo" id="topo-grade">
        <PainelFiltros
          id={idPainel}
          grupos={grupos}
          filtros={filtros}
          onMudar={mudarFiltros}
          onAlternarOpcao={alternarOpcao}
          onLimpar={limpar}
          onAplicar={aplicar}
          ehGaveta={ehGaveta}
          aberto={painelAberto}
          onFechar={fecharPainel}
        />

        <div className="col-grade">
          <h2 className="oculto">Anúncios de {categoria.nome}</h2>
          {feed.erro && !dados && (
            <div className="cat-vazio" role="alert">
              <b>Não foi possível carregar os anúncios.</b>
              <p>{feed.erro.message}</p>
              <button type="button" onClick={feed.recarregar}>Tentar de novo</button>
            </div>
          )}
          {!dados && !feed.erro && <p className="cat-vazio" role="status">Carregando anúncios…</p>}
          {dados && dados.itens.length === 0 && (
            <div className="cat-vazio" role="status">
              <Icone nome="busca" tamanho={36} cor="#4CA02B" />
              <b>{dados.mensagem ?? `Nenhum anúncio de ${categoria.nome} por perto`}</b>
              {dados.ampliar
                ? <button type="button" className="ampliar-raio" onClick={() => definirRaio(dados.ampliar.raio_km)}>Ampliar para {dados.ampliar.raio_km} km</button>
                : <button type="button" onClick={limpar}>Limpar filtros</button>}
            </div>
          )}
          {dados && dados.itens.length > 0 && (
            <div className="grade">
              {dados.itens.map((anuncio) => (
                <CardAnuncio key={anuncio.id} anuncio={anuncio} favorito={anuncio.favoritado} onFavoritar={favoritarAnuncio} />
              ))}
            </div>
          )}
          {dados && <Paginacao pagina={pagina} totalPaginas={Math.max(1, dados.total_paginas)} onMudar={mudarPagina} />}
        </div>
      </div>
    </LayoutMarketplace>
  );
}
