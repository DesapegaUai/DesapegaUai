import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import BarraDeRaio from '../components/BarraDeRaio.jsx'
import CardAnuncio from '../components/CardAnuncioMarketplace.jsx'
import LayoutMarketplace from '../components/LayoutMarketplace.jsx'
import OutrasCidades from '../components/OutrasCidades.jsx'
import Paginacao from '../components/Paginacao.jsx'
import SeletorOrdem from '../components/SeletorOrdem.jsx'
import Icone from '../components/IconeMarketplace.jsx'
import Toast from '../components/Toast.jsx'
import useFavoritar from '../hooks/useFavoritar.js'
import useFeedProximo from '../hooks/useFeedProximo.js'
import { ORDENACOES, POR_PAGINA } from '../services/anuncios.js'
import { CATEGORIAS, caminhoCategoria } from '../services/categorias.js'
import { definirRaio } from '../services/localizacao.js'
import '../styles/marketplace-busca.css'

/** Busca por palavra-chave perto da sua referência, dentro do raio (a API filtra e ordena). */
export default function Busca() {
  const [parametros] = useSearchParams()
  const termo = (parametros.get('q') ?? '').trim()
  const [ordem, setOrdem] = useState('proximos')
  const [pagina, setPagina] = useState(1)
  const [toast, setToast] = useState(null)
  const feed = useFeedProximo({ busca: termo || undefined, ordenar: ordem, pagina, por_pagina: POR_PAGINA })
  const favoritarAnuncio = useFavoritar({
    aoMudar: feed.marcarFavorito,
    aoErrar: (erro) => setToast({ tipo: 'erro', titulo: 'Não foi possível salvar o favorito', texto: erro.message, chave: Date.now() }),
  })
  const dados = feed.dados

  useEffect(() => {
    document.title = termo ? `DesapegaUai — Busca por ${termo}` : 'DesapegaUai — Anúncios perto de você'
  }, [termo])

  const [termoAnterior, setTermoAnterior] = useState(termo)
  if (termo !== termoAnterior) {
    setTermoAnterior(termo)
    setPagina(1)
  }

  return (
    <LayoutMarketplace>
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      <nav aria-label="Você está em">
        <ol className="trilha">
          <li><Link to="/">Início</Link></li>
          <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>
          <li><span className="at" aria-current="page">Busca</span></li>
        </ol>
      </nav>

      <div className="bus-cabeca">
        <div className="titulo-pagina">
          <h1 className="t-titulo-1">{termo ? <>Resultados para “{termo}”</> : 'Anúncios perto de você'}</h1>
          <Link className="titulo-acao" to={`/mapa${termo ? `?q=${encodeURIComponent(termo)}` : ''}`}><Icone nome="local" tamanho={17} cor="currentColor" espessura={1.8} />Ver no mapa</Link>
        </div>
        <SeletorOrdem opcoes={ORDENACOES} valor={ordem} onMudar={(o) => { setOrdem(o); setPagina(1) }} />
      </div>

      <BarraDeRaio total={dados?.total} carregando={feed.carregando} semConexao={feed.semConexao} />

      {!dados && !feed.erro && <p className="bus-vazio" role="status">Carregando anúncios…</p>}
      {feed.erro && !dados && (
        <div className="bus-vazio" role="alert">
          <b>Não foi possível carregar os anúncios.</b>
          <p>{feed.erro.message}</p>
          <button type="button" className="ampliar-raio" onClick={feed.recarregar}>Tentar de novo</button>
        </div>
      )}
      {dados && (dados.itens.length ? (
        <div className="bus-grade">
          {dados.itens.map((anuncio) => (
            <CardAnuncio key={anuncio.id} anuncio={anuncio} favorito={anuncio.favoritado} onFavoritar={favoritarAnuncio} />
          ))}
        </div>
      ) : (
        <div className="bus-vazio">
          <Icone nome="busca" tamanho={42} cor="#4CA02B" />
          <h2>{dados.mensagem ?? 'Nenhum anúncio encontrado'}</h2>
          {dados.ampliar && <button type="button" className="ampliar-raio" onClick={() => definirRaio(dados.ampliar.raio_km)}>Ampliar para {dados.ampliar.raio_km} km</button>}
          <p>{termo ? 'Confira a escrita ou explore as categorias.' : 'Explore as categorias.'}</p>
          <ul>{CATEGORIAS.map((categoria) => <li key={categoria.slug}><Link to={caminhoCategoria(categoria.slug)}>{categoria.nome}</Link></li>)}</ul>
        </div>
      ))}
      {dados && dados.total_paginas > 1 && <Paginacao pagina={pagina} totalPaginas={dados.total_paginas} onMudar={setPagina} />}
      {/* depois da última página de perto, os anúncios da busca que estão mais longe */}
      {dados && pagina >= Math.max(1, dados.total_paginas) && (
        <OutrasCidades
          filtros={{ busca: termo || undefined }}
          idsDePerto={dados.itens.map((anuncio) => anuncio.id)}
          classeGrade="bus-grade"
          onErroFavorito={(erro) => setToast({ tipo: 'erro', titulo: 'Não foi possível salvar o favorito', texto: erro.message, chave: Date.now() })}
        />
      )}
    </LayoutMarketplace>
  )
}
