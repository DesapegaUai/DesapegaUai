import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import BarraDeRaio from '../components/BarraDeRaio.jsx';
import CardAnuncio from '../components/CardAnuncioMarketplace.jsx';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import MapaAnuncios from '../components/MapaAnuncios.jsx';
import Toast from '../components/Toast.jsx';
import useFeedProximo from '../hooks/useFeedProximo.js';
import { CATEGORIAS } from '../services/categorias.js';
import { enderecoDoPonto } from '../services/locais.js';
import { definirRaio, usarLocalManual } from '../services/localizacao.js';
import { marcadoresDoMapa, obterCategorias } from '../services/mercadoApi.js';

/** Mapa dos anúncios perto da sua referência. Clique no mapa para buscar a partir de outro lugar. */
export default function Mapa() {
  const [parametros, setParametros] = useSearchParams();
  const slug = parametros.get('categoria') ?? '';
  const termo = (parametros.get('q') ?? '').trim();
  const [categoriaId, setCategoriaId] = useState(null);
  const [marcadores, setMarcadores] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [toast, setToast] = useState(null);
  const pedido = useRef(null);
  const caixa = useRef(null);

  useEffect(() => {
    document.title = 'DesapegaUai — Mapa de anúncios';
    if (!slug) return;
    obterCategorias().then((lista) => setCategoriaId(lista.find((c) => c.slug === slug)?.id ?? null)).catch(() => {});
  }, [slug]);

  const filtros = { busca: termo || undefined, categoria_id: slug ? categoriaId ?? undefined : undefined };
  const pronto = !slug || categoriaId;
  const feed = useFeedProximo(pronto ? { ...filtros, ordenar: 'proximos', por_pagina: 12 } : null);
  const origem = feed.dados?.origem;

  const atualizarMarcadores = useCallback(async (bbox) => {
    caixa.current = bbox;
    pedido.current?.abort();
    const controle = new AbortController();
    pedido.current = controle;
    try {
      const r = await marcadoresDoMapa({ bbox, busca: termo || undefined, categoria_id: slug ? categoriaId ?? undefined : undefined, limite: 500 }, { sinal: controle.signal });
      setMarcadores(r.marcadores);
      setAviso(r.total > r.exibidos ? `Mostrando ${r.exibidos} de ${r.total} anúncios nesta área. Aproxime o mapa para ver todos.` : null);
    } catch (erro) {
      if (erro.name !== 'AbortError') setAviso(erro.message);
    }
  }, [termo, slug, categoriaId]);

  // filtros mudaram ou chegou anúncio novo: redesenha a área atual
  const totalDoFeed = feed.dados?.total;
  useEffect(() => {
    if (caixa.current && pronto) atualizarMarcadores(caixa.current);
  }, [atualizarMarcadores, pronto, totalDoFeed]);

  async function escolherLugar(ponto) {
    try {
      const endereco = await enderecoDoPonto(ponto.latitude, ponto.longitude);
      await usarLocalManual({ id: endereco.cidade.id, nome: endereco.cidade.nome }, endereco.bairro ? { id: endereco.bairro.id, nome: endereco.bairro.nome } : null);
      setToast({ tipo: 'sucesso', titulo: 'Buscando a partir daqui', texto: [endereco.bairro?.nome, endereco.cidade.nome].filter(Boolean).join(', '), chave: Date.now() });
    } catch (erro) {
      setToast({ tipo: 'erro', titulo: 'Não foi possível usar esse lugar', texto: erro.message, chave: Date.now() });
    }
  }

  return (
    <LayoutMarketplace comAbas={false} comFab={false}>
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      <div className="mapa-pagina">
        <div className="titulo-pagina">
          <h1 className="t-titulo-1">Mapa de anúncios</h1>
          <label className="cont">
            <span className="oculto">Categoria</span>
            <select value={slug} onChange={(e) => setParametros((p) => { const n = new URLSearchParams(p); if (e.target.value) n.set('categoria', e.target.value); else n.delete('categoria'); return n; })}>
              <option value="">Todas as categorias</option>
              {CATEGORIAS.map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}
            </select>
          </label>
        </div>

        <BarraDeRaio total={feed.dados?.total} carregando={feed.carregando} semConexao={feed.semConexao} />

        <MapaAnuncios
          centro={origem ? { latitude: origem.latitude, longitude: origem.longitude } : null}
          raioKm={feed.local.raioKm}
          usuario={feed.local.modo === 'gps' ? feed.local.posicao : null}
          marcadores={marcadores}
          onMover={atualizarMarcadores}
          onEscolherPonto={escolherLugar}
          altura={480}
          rotulo="Mapa dos anúncios. Clique em um lugar para buscar a partir dele."
        />
        <p className="mapa-aviso">
          <Icone nome="escudo-simples" tamanho={18} cor="#3E8B22" />
          <span>Os pontos dos anúncios são aproximados, para proteger quem vende. Clique em um lugar do mapa para buscar a partir dele.</span>
        </p>
        {aviso && <p className="mapa-aviso alerta" role="status"><Icone nome="ajuda" tamanho={18} cor="#9A3412" /><span>{aviso}</span></p>}

        <h2 className="t-titulo-3">Mais perto de {origem?.bairro?.nome ?? origem?.cidade?.nome ?? 'você'}</h2>
        {feed.dados?.itens.length ? (
          <div className="mapa-lista">
            {feed.dados.itens.map((anuncio) => <CardAnuncio key={anuncio.id} anuncio={anuncio} />)}
          </div>
        ) : (
          <div className="mapa-dica">
            <p>{feed.dados?.mensagem ?? 'Carregando…'}</p>
            {feed.dados?.ampliar && <button type="button" className="ampliar-raio" onClick={() => definirRaio(feed.dados.ampliar.raio_km)}>Ampliar para {feed.dados.ampliar.raio_km} km</button>}
          </div>
        )}
      </div>
    </LayoutMarketplace>
  );
}
