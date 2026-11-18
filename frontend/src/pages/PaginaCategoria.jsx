import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import BarraChips from '../components/BarraChips.jsx';
import PainelFiltros from '../components/PainelFiltros.jsx';
import CardAnuncio from '../components/CardAnuncioMarketplace.jsx';
import Paginacao from '../components/Paginacao.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import { buscarCategoria } from '../services/categorias.js';
import {
  DISTANCIA, PAGINAS_CATEGORIA, filtrosIniciais, filtrosLimpos, listarAnuncios,
} from '../services/anuncios.js';
import { formatarQuantidade } from '../services/formatar.js';
import useMediaQuery, { TABLET } from '../hooks/useMediaQuery.js';

const alternarNaLista = (lista, item) =>
  lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item];

/**
 * Tela de categoria (estrutura idêntica nas 8 categorias):
 * cabeçalho · abas · trilha + título · chips/ordenar · filtros + grade · paginação · rodapé.
 */
export default function PaginaCategoria({ slug }) {
  const categoria = buscarCategoria(slug);
  const pagina = PAGINAS_CATEGORIA[slug];
  const grupoChips = pagina.gruposFiltro.find((g) => g.ligadoAosChips).id;
  const idPainel = `filtros-${slug}`;

  const ehGaveta = useMediaQuery(TABLET);
  const [filtros, setFiltros] = useState(() => filtrosIniciais(slug));
  const [ordem, setOrdem] = useState('recentes');
  const [numPagina, setNumPagina] = useState(1);
  const [painelAberto, setPainelAberto] = useState(false);
  const [favoritos, setFavoritos] = useState(() => new Set());

  useEffect(() => {
    document.title = `DesapegaUai — ${categoria.nome}`;
  }, [categoria.nome]);

  // Saiu do tablet/celular com a gaveta aberta → fecha
  if (!ehGaveta && painelAberto) setPainelAberto(false);

  // Filtros aplicados de fato (a busca só roda ao clicar nos chips, ordenar, paginar ou "Aplicar filtros")
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtros);
  const resultado = useMemo(
    () => listarAnuncios(slug, { pagina: numPagina, ordem, filtros: filtrosAplicados }),
    [slug, numPagina, ordem, filtrosAplicados],
  );

  const mudarFiltros = useCallback((parcial) => setFiltros((f) => ({ ...f, ...parcial })), []);

  const alternarOpcao = useCallback((grupo, opcao) => {
    setFiltros((f) => ({ ...f, opcoes: { ...f.opcoes, [grupo]: alternarNaLista(f.opcoes[grupo], opcao) } }));
  }, []);

  // Chip = atalho do 1º grupo de filtros: aplica na hora
  function alternarChip(sub) {
    const novos = { ...filtros, opcoes: { ...filtros.opcoes, [grupoChips]: alternarNaLista(filtros.opcoes[grupoChips], sub) } };
    setFiltros(novos);
    setFiltrosAplicados(novos);
    setNumPagina(1);
  }

  function aplicar() {
    setFiltrosAplicados(filtros);
    setNumPagina(1);
    setPainelAberto(false);
  }

  function limpar() {
    const zerados = filtrosLimpos(slug);
    setFiltros(zerados);
    setFiltrosAplicados(zerados);
    setNumPagina(1);
  }

  function mudarPagina(n) {
    setNumPagina(n);
    document.getElementById('topo-grade')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const fecharPainel = useCallback(() => setPainelAberto(false), []);

  const alternarFavorito = useCallback((id) => {
    // TODO: visitante → Login (03-arquitetura · Permissões). Logado → salvar na API.
    setFavoritos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }, []);

  // Número no botão "Filtros" (tablet/celular): conta o que não aparece nos chips
  const qtdFiltros = (filtros.precoMin ? 1 : 0) + (filtros.precoMax ? 1 : 0)
    + Object.entries(filtros.opcoes).reduce((t, [g, l]) => (g === grupoChips ? t : t + l.length), 0)
    + (filtros.distancia !== DISTANCIA.padrao ? 1 : 0);

  return (
    <LayoutMarketplace>
      <nav aria-label="Você está em">
        <ol className="trilha">
          <li><Link to="/">Início</Link></li>
          <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>
          <li><span className="at" aria-current="page">{categoria.nome}</span></li>
        </ol>
      </nav>

      <div className="titulo-pagina">
        <h1 className="t-titulo-1">{categoria.nome}</h1>
        <span className="cont">{formatarQuantidade(resultado.total)} em Viçosa e região</span>
      </div>

      <BarraChips
        subcategorias={pagina.subcategorias}
        ativas={filtros.opcoes[grupoChips]}
        onAlternar={alternarChip}
        ordem={ordem}
        onOrdenar={(o) => { setOrdem(o); setNumPagina(1); }}
        idPainel={idPainel}
        painelAberto={painelAberto}
        qtdFiltros={qtdFiltros}
        onAbrirFiltros={() => setPainelAberto(true)}
      />

      <div className="corpo" id="topo-grade">
        <PainelFiltros
          id={idPainel}
          pagina={pagina}
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
          <div className="grade">
            {resultado.anuncios.map((anuncio) => (
              <CardAnuncio
                key={anuncio.id}
                anuncio={anuncio}
                favorito={favoritos.has(anuncio.id)}
                onFavoritar={alternarFavorito}
              />
            ))}
          </div>
          <Paginacao pagina={numPagina} totalPaginas={resultado.totalPaginas} onMudar={mudarPagina} />
        </div>
      </div>
    </LayoutMarketplace>
  );
}
