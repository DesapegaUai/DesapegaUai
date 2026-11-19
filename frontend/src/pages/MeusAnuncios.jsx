import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import AcoesAnuncio from '../components/AcoesAnuncio.jsx';
import LayoutPainel from '../components/LayoutPainel.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import Toast from '../components/Toast.jsx';
import { formatarData, formatarPreco, formatarQuantidade } from '../services/formatar.js';
import { ROTULO_STATUS, camposFaltando, useMeusAnuncios } from '../services/meusAnuncios.js';
import '../styles/marketplace-meus-anuncios.css';

const ABAS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'ativos', rotulo: 'Ativos', status: 'ativo' },
  { id: 'rascunhos', rotulo: 'Rascunhos', status: 'rascunho' },
  { id: 'vendidos', rotulo: 'Vendidos', status: 'vendido' },
];

const VAZIOS = {
  todos: { titulo: 'Você ainda não tem anúncios', texto: 'Publique o primeiro e comece a desapegar.' },
  ativos: { titulo: 'Nenhum anúncio ativo', texto: 'Os anúncios publicados aparecem aqui.' },
  rascunhos: { titulo: 'Nenhum rascunho salvo', texto: 'Use “Salvar rascunho” para terminar um anúncio depois.' },
  vendidos: { titulo: 'Nenhum anúncio vendido', texto: 'Os anúncios marcados como vendidos ficam guardados aqui.' },
};

function Item({ anuncio, onAviso }) {
  const rascunho = anuncio.status === 'rascunho';
  const faltando = rascunho ? camposFaltando(anuncio) : [];
  const titulo = anuncio.titulo || 'Rascunho sem título';
  const destino = rascunho ? `/anuncios/${anuncio.id}/editar` : `/anuncio/${anuncio.id}`;

  return (
    <li className={`ma-item ${anuncio.status}`}>
      <Link className="ma-foto" to={destino} tabIndex={-1} aria-hidden="true">
        {anuncio.fotos[0]
          ? <img src={anuncio.fotos[0]} alt="" loading="lazy" />
          : <Icone nome="imagem" tamanho={34} cor="#9AA39B" espessura={1.4} />}
      </Link>
      <div className="ma-info">
        <div className="ma-topo">
          <span className={`ma-tag ${anuncio.status}`}>{ROTULO_STATUS[anuncio.status]}</span>
          <AcoesAnuncio anuncio={anuncio} onAviso={onAviso} />
        </div>
        <Link className="ma-titulo" to={destino}>{titulo}</Link>
        <p className="ma-preco">{anuncio.preco ? formatarPreco(anuncio.preco) : 'Preço a definir'}</p>
        {rascunho ? (
          <>
            <p className="ma-falta">
              {faltando.length ? `Falta preencher: ${faltando.join(', ')}.` : 'Tudo pronto para publicar.'}
            </p>
            <Link className="ma-continuar" to={destino}>
              <Icone nome="lapis" tamanho={18} cor="#fff" espessura={1.8} />Continuar rascunho
            </Link>
          </>
        ) : (
          <div className="ma-numeros">
            <span aria-label={`${anuncio.visualizacoes} visualizações`}><Icone nome="olho" tamanho={16} cor="#8C918B" />{anuncio.visualizacoes}</span>
            <span aria-label={`${anuncio.favoritos} favoritos`}><Icone nome="favorito" tamanho={16} cor="#8C918B" />{anuncio.favoritos}</span>
            <span className="ma-data">Atualizado em {formatarData(anuncio.atualizadoEm)}</span>
          </div>
        )}
      </div>
    </li>
  );
}

/** Meus anúncios: publicados, rascunhos e vendidos. */
export default function MeusAnuncios() {
  const anuncios = useMeusAnuncios();
  const location = useLocation();
  const [parametros, setParametros] = useSearchParams();
  const [toast, setToast] = useState(() => location.state?.aviso ?? null);

  useEffect(() => { document.title = 'DesapegaUai — Meus anúncios'; }, []);

  const abaAtual = ABAS.find((a) => a.id === parametros.get('aba')) ?? ABAS[0];
  const contar = (aba) => (aba.status ? anuncios.filter((a) => a.status === aba.status).length : anuncios.length);
  const lista = abaAtual.status ? anuncios.filter((a) => a.status === abaAtual.status) : anuncios;
  const avisar = (aviso) => setToast({ ...aviso, chave: Date.now() });
  const vazio = VAZIOS[abaAtual.id];

  return (
    <LayoutPainel classeMain="ma-main">
      <Toast aviso={toast} onFechar={() => setToast(null)} />

      <div className="ma-cabeca">
        <div>
          <h1>Meus anúncios</h1>
          <p>{formatarQuantidade(anuncios.length)} na sua conta</p>
        </div>
        <Link className="ma-novo" to="/anunciar">
          <Icone nome="mais" tamanho={20} cor="#fff" espessura={2} />Publicar anúncio
        </Link>
      </div>

      <nav className="ma-abas" aria-label="Filtrar anúncios">
        {ABAS.map((aba) => (
          <button
            type="button"
            key={aba.id}
            className={aba.id === abaAtual.id ? 'on' : undefined}
            aria-pressed={aba.id === abaAtual.id}
            onClick={() => setParametros(aba.id === 'todos' ? {} : { aba: aba.id }, { replace: true })}
          >
            {aba.rotulo}<span>{contar(aba)}</span>
          </button>
        ))}
      </nav>

      {lista.length ? (
        <ul className="ma-lista">
          {lista.map((a) => <Item key={a.id} anuncio={a} onAviso={avisar} />)}
        </ul>
      ) : (
        <div className="ma-vazio">
          <Icone nome="etiqueta" tamanho={40} cor="#4CA02B" />
          <h2>{vazio.titulo}</h2>
          <p>{vazio.texto}</p>
          <Link to="/anunciar">Publicar anúncio</Link>
        </div>
      )}
    </LayoutPainel>
  );
}
