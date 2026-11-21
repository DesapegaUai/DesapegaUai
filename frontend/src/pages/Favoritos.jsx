import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import CardAnuncio from '../components/CardAnuncioMarketplace.jsx';
import Paginacao from '../components/Paginacao.jsx';
import SeletorOrdem from '../components/SeletorOrdem.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import Toast from '../components/Toast.jsx';
import { CATEGORIAS } from '../services/categorias.js';
import { formatarQuantidade } from '../services/formatar.js';
import { desfavoritar, favoritar, listarFavoritos, obterCategorias } from '../services/mercadoApi.js';
import '../styles/marketplace-favoritos.css';

const ORDENACOES = [
  { valor: 'recentes', rotulo: 'Salvos recentemente' },
  { valor: 'menor_preco', rotulo: 'Menor preço' },
  { valor: 'maior_preco', rotulo: 'Maior preço' },
];
const POR_PAGINA = 12;

/** Favoritos da conta (da API): filtro por categoria, ordenação, paginação e remover com "desfazer". */
export default function Favoritos() {
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState('todas');
  const [ordem, setOrdem] = useState('recentes');
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [toast, setToast] = useState(null);
  const [removido, setRemovido] = useState(null);

  useEffect(() => {
    document.title = 'DesapegaUai — Favoritos';
    obterCategorias().then(setCategorias).catch(() => {});
  }, []);

  const categoriaId = categorias.find((c) => c.slug === categoria)?.id;
  const carregar = useCallback(() => {
    listarFavoritos({ categoria_id: categoria === 'todas' ? undefined : categoriaId, ordenar: ordem, pagina, por_pagina: POR_PAGINA })
      .then((resultado) => { setDados(resultado); setErro(null); })
      .catch((falha) => setErro(falha.message));
  }, [categoria, categoriaId, ordem, pagina]);

  useEffect(() => {
    if (categoria !== 'todas' && !categoriaId) return;
    carregar();
  }, [carregar, categoria, categoriaId]);

  async function remover(anuncio) {
    try {
      await desfavoritar(anuncio.id);
      setRemovido(anuncio);
      carregar();
    } catch (falha) {
      setToast({ tipo: 'erro', titulo: 'Não foi possível remover', texto: falha.message, chave: Date.now() });
    }
  }

  async function desfazer() {
    const anuncio = removido;
    setRemovido(null);
    try {
      await favoritar(anuncio.id);
      carregar();
    } catch (falha) {
      setToast({ tipo: 'erro', titulo: 'Não foi possível desfazer', texto: falha.message, chave: Date.now() });
    }
  }

  const trocar = (setter) => (valor) => { setter(valor); setPagina(1); };

  return (
    <LayoutMarketplace>
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      <nav aria-label="Você está em">
        <ol className="trilha">
          <li><Link to="/">Início</Link></li>
          <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>
          <li><span className="at" aria-current="page">Favoritos</span></li>
        </ol>
      </nav>

      <div className="titulo-pagina fav-cabeca">
        <h1 className="t-titulo-1 fav-titulo">Favoritos</h1>
        {dados && dados.total > 0 && <span className="titulo-selo">{formatarQuantidade(dados.total)} {dados.total === 1 ? 'salvo' : 'salvos'}</span>}
      </div>

      <div className="barra-chips">
        <div className="chips">
          <button type="button" className={`chip${categoria === 'todas' ? ' on' : ''}`} aria-pressed={categoria === 'todas'} onClick={() => trocar(setCategoria)('todas')}>
            <span>Todos</span>
          </button>
          {CATEGORIAS.map((c) => (
            <button type="button" key={c.slug} className={`chip${categoria === c.slug ? ' on' : ''}`} aria-pressed={categoria === c.slug} onClick={() => trocar(setCategoria)(c.slug)}>
              <span>{c.nome}</span>
            </button>
          ))}
        </div>
        <SeletorOrdem opcoes={ORDENACOES} valor={ordem} onMudar={trocar(setOrdem)} />
      </div>

      <div className="col-grade" id="topo-grade">
        <h2 className="oculto">Anúncios salvos</h2>
        {erro && <div className="vazio" role="alert"><b>Não foi possível carregar os favoritos.</b><p>{erro}</p></div>}
        {!erro && dados && (dados.itens.length ? (
          <div className="grade g4">
            {dados.itens.map((anuncio) => <CardAnuncio key={anuncio.id} anuncio={anuncio} favorito onFavoritar={remover} />)}
          </div>
        ) : (
          <div className="vazio">
            <Icone nome="favorito" tamanho={36} cor="#4CA02B" />
            <b>{categoria === 'todas' ? 'Você ainda não salvou nenhum anúncio' : 'Nenhum favorito nesta categoria'}</b>
            <p>Toque no coração de um anúncio para guardar aqui.</p>
            <Link to="/busca">Ver anúncios perto de você</Link>
          </div>
        ))}
        {dados && dados.total_paginas > 1 && <Paginacao pagina={pagina} totalPaginas={dados.total_paginas} onMudar={setPagina} />}
      </div>

      {removido && (
        <div className="aviso-flutuante" role="status">
          <span>Removido dos favoritos.</span>
          <button type="button" onClick={desfazer}>Desfazer</button>
        </div>
      )}
    </LayoutMarketplace>
  );
}
