import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import CardAnuncio from '../components/CardAnuncioMarketplace.jsx';
import Paginacao from '../components/Paginacao.jsx';
import SeletorOrdem from '../components/SeletorOrdem.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import Toast from '../components/Toast.jsx';
import { CATEGORIAS } from '../services/categorias.js';
import {
  FAVORITOS, FAVORITOS_POR_PAGINA, LISTAS, ORDENACOES_FAVORITOS,
} from '../services/favoritos.js';
import { formatarQuantidade } from '../services/formatar.js';
import '../styles/marketplace-favoritos.css';

const ORDENAR = {
  recentes: () => 0, // a lista já vem na ordem em que foi salva
  'menor-preco': (a, b) => a.preco - b.preco,
  'maior-preco': (a, b) => b.preco - a.preco,
};

/**
 * Favoritos (protótipo 09-favoritos):
 * trilha · título · resumo · chips de categoria + ordenar · "Minhas listas" + grade 4 colunas · paginação.
 */
export default function Favoritos() {
  const [salvos, setSalvos] = useState(() => new Set(FAVORITOS.map((f) => f.id)));
  const [lista, setLista] = useState('todos');
  const [categoria, setCategoria] = useState('todas');
  const [ordem, setOrdem] = useState('recentes');
  const [pagina, setPagina] = useState(1);
  const [toast, setToast] = useState(null);
  const [removido, setRemovido] = useState(null); // { item } para o "Desfazer"
  const timerRef = useRef(null);

  useEffect(() => { document.title = 'DesapegaUai — Favoritos'; }, []);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const meusFavoritos = useMemo(() => FAVORITOS.filter((f) => salvos.has(f.id)), [salvos]);
  const listaAtual = LISTAS.find((l) => l.id === lista);

  // Chips: "Todos" + categorias que têm ao menos 1 favorito
  const chips = useMemo(
    () => CATEGORIAS.filter((c) => meusFavoritos.some((f) => f.categoria === c.slug)),
    [meusFavoritos],
  );

  const filtrados = useMemo(
    () => meusFavoritos
      .filter(listaAtual.filtro)
      .filter((f) => categoria === 'todas' || f.categoria === categoria)
      .sort(ORDENAR[ordem]),
    [meusFavoritos, listaAtual, categoria, ordem],
  );

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / FAVORITOS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = filtrados.slice((paginaAtual - 1) * FAVORITOS_POR_PAGINA, paginaAtual * FAVORITOS_POR_PAGINA);

  function trocar(setter) {
    return (valor) => { setter(valor); setPagina(1); };
  }

  function remover(id) {
    // TODO: chamar a API para remover dos favoritos
    const item = FAVORITOS.find((f) => f.id === id);
    setSalvos((atual) => { const novo = new Set(atual); novo.delete(id); return novo; });
    setRemovido({ item });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRemovido(null), 6000);
  }

  function desfazer() {
    if (!removido) return;
    setSalvos((atual) => new Set(atual).add(removido.item.id));
    setRemovido(null);
    clearTimeout(timerRef.current);
  }

  function mudarPagina(n) {
    setPagina(n);
    document.getElementById('topo-grade')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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

      <h1 className="t-titulo-1 fav-titulo">Favoritos</h1>
      <div className="fav-resumo">{formatarQuantidade(meusFavoritos.length)} {meusFavoritos.length === 1 ? 'salvo' : 'salvos'}</div>
      <p className="fav-sub">Acompanhe os itens que você gostou e volte quando quiser.</p>

      <div className="barra-chips">
        <div className="chips">
          <button
            type="button"
            className={`chip${categoria === 'todas' ? ' on' : ''}`}
            aria-pressed={categoria === 'todas'}
            onClick={() => trocar(setCategoria)('todas')}
          >
            <span>Todos</span>
          </button>
          {chips.map((c) => (
            <button
              key={c.slug}
              type="button"
              className={`chip${categoria === c.slug ? ' on' : ''}`}
              aria-pressed={categoria === c.slug}
              onClick={() => trocar(setCategoria)(c.slug)}
            >
              <span>{c.nome}</span>
            </button>
          ))}
        </div>
        <SeletorOrdem opcoes={ORDENACOES_FAVORITOS} valor={ordem} onMudar={trocar(setOrdem)} />
      </div>

      <div className="corpo com-listas" id="topo-grade">
        <aside className="listas" aria-labelledby="titulo-listas">
          <h2 id="titulo-listas">Minhas listas</h2>
          <div className="listas-itens">
            {LISTAS.map((l) => {
              const on = l.id === lista;
              return (
                <button
                  key={l.id}
                  type="button"
                  className={`lista${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => trocar(setLista)(l.id)}
                >
                  <Icone nome={l.icone} tamanho={20} cor={on ? '#3E8B22' : '#4CA02B'} />
                  <span className="n">{l.nome}</span>
                  <span className="q">{meusFavoritos.filter(l.filtro).length}</span>
                </button>
              );
            })}
          </div>
          <div className="div" />
          <button
            type="button"
            className="nova-lista"
            onClick={() => setToast({ tipo: 'info', titulo: 'Listas personalizadas em breve', texto: 'Por enquanto, todos os favoritos ficam em Todos favoritos.', chave: Date.now() })}
          >
            <Icone nome="mais" tamanho={19} cor="#3E8B22" />
            Criar nova lista
          </button>
        </aside>

        <div className="col-grade">
          <h2 className="oculto">{listaAtual.nome}</h2>
          {daPagina.length > 0 ? (
            <div className="grade g4">
              {daPagina.map((f) => (
                <CardAnuncio key={f.id} anuncio={f} favorito onFavoritar={remover} />
              ))}
            </div>
          ) : (
            <div className="vazio">
              <Icone nome="favorito" tamanho={36} cor="#4CA02B" />
              <b>Nada por aqui ainda</b>
              <span>Toque no coração dos anúncios para guardar o que você gostou.</span>
              <Link to="/categoria/casa">Explorar categorias</Link>
            </div>
          )}
          <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} onMudar={mudarPagina} />
        </div>
      </div>

      <div aria-live="polite">
        {removido && (
          <div className="aviso-flutuante" role="status">
            <span>“{removido.item.titulo}” saiu dos favoritos</span>
            <button type="button" onClick={desfazer}>Desfazer</button>
          </div>
        )}
      </div>
    </LayoutMarketplace>
  );
}
