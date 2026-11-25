import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import AcoesAnuncio from '../components/AcoesAnuncio.jsx';
import useAvisoDaNavegacao from '../hooks/useAvisoDaNavegacao.js';
import LayoutPainel from '../components/LayoutPainel.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import SemFoto from '../components/SemFoto.jsx';
import Toast from '../components/Toast.jsx';
import { formatarData, formatarPreco, formatarQuantidade } from '../services/formatar.js';
import { listarMeusAnuncios } from '../services/mercadoApi.js';
import { ROTULO_STATUS, nomesDosCampos } from '../services/meusAnuncios.js';
import '../styles/marketplace-meus-anuncios.css';

const ABAS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'ativos', rotulo: 'Disponíveis', status: 'ativo' },
  { id: 'reservados', rotulo: 'Reservados', status: 'reservado' },
  { id: 'rascunhos', rotulo: 'Rascunhos', status: 'rascunho' },
  { id: 'vendidos', rotulo: 'Vendidos', status: 'vendido' },
];

const VAZIOS = {
  todos: { titulo: 'Você ainda não tem anúncios', texto: 'Publique o primeiro e comece a desapegar.' },
  ativos: { titulo: 'Nenhum anúncio disponível', texto: 'Os anúncios publicados aparecem aqui.' },
  reservados: { titulo: 'Nenhum anúncio reservado', texto: 'Use “Marcar como reservado” quando combinar a venda com alguém.' },
  rascunhos: { titulo: 'Nenhum rascunho salvo', texto: 'Use “Salvar rascunho” para terminar um anúncio depois.' },
  vendidos: { titulo: 'Nenhum anúncio vendido', texto: 'Os anúncios marcados como vendidos ficam guardados aqui.' },
};

function Item({ anuncio, onAviso, onMudou }) {
  const rascunho = anuncio.status === 'rascunho';
  const faltando = rascunho ? nomesDosCampos(anuncio.campos_faltando) : [];
  const titulo = anuncio.titulo || 'Rascunho sem título';
  const destino = rascunho ? `/anuncios/${anuncio.id}/editar` : `/anuncio/${anuncio.id}`;

  return (
    <li className={`ma-item ${anuncio.status}`}>
      <Link className="ma-foto" to={destino} tabIndex={-1} aria-hidden="true">
        {anuncio.foto ? <img src={anuncio.foto} alt="" loading="lazy" /> : <SemFoto categoria={anuncio.categoria} tamanho={34} />}
      </Link>
      <div className="ma-info">
        <div className="ma-topo">
          <span className={`ma-tag ${anuncio.status}`}>{ROTULO_STATUS[anuncio.status]}</span>
          <AcoesAnuncio anuncio={anuncio} onAviso={onAviso} onMudou={onMudou} />
        </div>
        <Link className="ma-titulo" to={destino}>{titulo}</Link>
        <p className="ma-preco">{anuncio.preco ? formatarPreco(anuncio.preco) : 'Preço a definir'}</p>
        {anuncio.status === 'em_analise' && (
          <p className="ma-analise" role="note">
            <Icone nome="alerta" tamanho={16} cor="#B42318" espessura={2} />
            Saiu da busca porque recebeu denúncias. A equipe do DesapegaUai está revisando e avisa você quando terminar.
          </p>
        )}
        {rascunho ? (
          <>
            <p className="ma-falta">{faltando.length ? `Falta preencher: ${faltando.join(', ')}.` : 'Tudo pronto para publicar.'}</p>
            <Link className="ma-continuar" to={destino}>
              <Icone nome="lapis" tamanho={18} cor="#fff" espessura={1.8} />Continuar rascunho
            </Link>
          </>
        ) : (
          <div className="ma-numeros">
            <span aria-label={`${anuncio.visualizacoes} visualizações`}><Icone nome="olho" tamanho={16} cor="#8C918B" />{anuncio.visualizacoes}</span>
            <span aria-label={`${anuncio.total_favoritos} favoritos`}><Icone nome="favorito" tamanho={16} cor="#8C918B" />{anuncio.total_favoritos}</span>
            <span className="ma-data">Atualizado em {formatarData(anuncio.atualizado_em)}</span>
          </div>
        )}
      </div>
    </li>
  );
}

/** Meus anúncios: publicados, rascunhos e vendidos (da API). */
export default function MeusAnuncios() {
  const [parametros, setParametros] = useSearchParams();
  const [anuncios, setAnuncios] = useState(null);
  const [erro, setErro] = useState(null);
  const [toast, setToast] = useAvisoDaNavegacao();

  const carregar = useCallback(() => {
    listarMeusAnuncios().then((lista) => { setAnuncios(lista); setErro(null); }).catch((falha) => setErro(falha.message));
  }, []);

  useEffect(() => {
    document.title = 'DesapegaUai — Meus anúncios';
    carregar();
  }, [carregar]);

  const lista0 = anuncios ?? [];
  const abaAtual = ABAS.find((a) => a.id === parametros.get('aba')) ?? ABAS[0];
  const contar = (aba) => (aba.status ? lista0.filter((a) => a.status === aba.status).length : lista0.length);
  const lista = abaAtual.status ? lista0.filter((a) => a.status === abaAtual.status) : lista0;
  const avisar = (aviso) => setToast({ ...aviso, chave: Date.now() });
  const vazio = VAZIOS[abaAtual.id];

  return (
    <LayoutPainel classeMain="ma-main">
      <Toast aviso={toast} onFechar={() => setToast(null)} />

      <div className="ma-cabeca">
        <div className="ma-titulo">
          <h1>Meus anúncios</h1>
          {anuncios && anuncios.length > 0 && <span className="titulo-selo">{formatarQuantidade(anuncios.length)}</span>}
        </div>
      </div>

      <nav className="ma-abas" aria-label="Filtrar anúncios">
        {ABAS.map((aba) => (
          <button type="button" key={aba.id} className={aba.id === abaAtual.id ? 'on' : undefined} aria-pressed={aba.id === abaAtual.id}
            onClick={() => setParametros(aba.id === 'todos' ? {} : { aba: aba.id }, { replace: true })}>
            {aba.rotulo}<span>{contar(aba)}</span>
          </button>
        ))}
      </nav>

      {erro && <div className="ma-vazio" role="alert"><h2>Não foi possível carregar seus anúncios</h2><p>{erro}</p><button type="button" onClick={carregar}>Tentar de novo</button></div>}
      {!erro && anuncios && (lista.length ? (
        <ul className="ma-lista">
          {lista.map((a) => <Item key={a.id} anuncio={a} onAviso={avisar} onMudou={carregar} />)}
        </ul>
      ) : (
        <div className="ma-vazio">
          <Icone nome="etiqueta" tamanho={40} cor="#4CA02B" />
          <h2>{vazio.titulo}</h2>
          <p>{vazio.texto}</p>
          <Link to="/anunciar">Publicar anúncio</Link>
        </div>
      ))}
    </LayoutPainel>
  );
}
