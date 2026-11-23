import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import CardAnuncio from '../components/CardAnuncioMarketplace.jsx'
import Icone from '../components/IconeMarketplace.jsx'
import LayoutMarketplace from '../components/LayoutMarketplace.jsx'
import Paginacao from '../components/Paginacao.jsx'
import SeletorOrdem from '../components/SeletorOrdem.jsx'
import Toast from '../components/Toast.jsx'
import useFavoritar from '../hooks/useFavoritar.js'
import { ORDENACOES, POR_PAGINA } from '../services/anuncios.js'
import { CATEGORIAS, caminhoCategoria } from '../services/categorias.js'
import { useLocalizacao } from '../services/localizacao.js'
import { listarTodos } from '../services/mercadoApi.js'
import { ouvir } from '../services/tempoReal.js'
import '../styles/marketplace-busca.css'

/**
 * Todos os anúncios publicados, de qualquer cidade e a qualquer distância (atalho "Anúncios" do menu).
 * Começa pelos mais recentes; a distância até a pessoa aparece em cada cartão.
 */
export default function TodosAnuncios() {
  const local = useLocalizacao()
  const [ordem, setOrdem] = useState('recentes')
  const [pagina, setPagina] = useState(1)
  const [versao, setVersao] = useState(0)
  const [resultado, setResultado] = useState(null) // { chave, dados, erro }
  const [toast, setToast] = useState(null)

  // a origem só serve para mostrar a distância e para "Mais próximos": não filtra nada
  const origem = local.modo === 'gps' && local.posicao
    ? { latitude: local.posicao.latitude, longitude: local.posicao.longitude }
    : { cidade_id: local.cidade?.id }
  const chave = JSON.stringify({ ordem, pagina, ...origem })

  useEffect(() => {
    document.title = 'DesapegaUai — Todos os anúncios'
  }, [])

  useEffect(() => {
    const controle = new AbortController()
    const { ordem: ordenar, pagina: numero, ...deOnde } = JSON.parse(chave)
    listarTodos({ ordenar, pagina: numero, porPagina: POR_PAGINA, origem: deOnde }, { sinal: controle.signal })
      .then((dados) => setResultado({ chave, dados, erro: null }))
      .catch((erro) => { if (erro.name !== 'AbortError') setResultado((atual) => ({ chave, dados: atual?.dados ?? null, erro })) })
    return () => controle.abort()
  }, [chave, versao])

  // anúncio publicado, editado ou removido por qualquer pessoa: a lista se atualiza sozinha
  useEffect(() => {
    let espera = null
    const atualizar = () => { clearTimeout(espera); espera = setTimeout(() => setVersao((v) => v + 1), 1500) }
    const parar = [ouvir('anuncio_publicado', atualizar), ouvir('anuncio_atualizado', atualizar), ouvir('anuncio_removido', atualizar)]
    return () => { clearTimeout(espera); parar.forEach((p) => p()) }
  }, [])

  const favoritar = useFavoritar({
    aoMudar: (id, favoritado) => setResultado((atual) => atual && ({
      ...atual,
      dados: { ...atual.dados, itens: atual.dados.itens.map((a) => (a.id === id ? { ...a, favoritado } : a)) },
    })),
    aoErrar: (erro) => setToast({ tipo: 'erro', titulo: 'Não foi possível salvar o favorito', texto: erro.message, chave: Date.now() }),
  })

  const dados = resultado?.dados
  const carregando = resultado?.chave !== chave
  const total = dados?.total

  return (
    <LayoutMarketplace>
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      <nav aria-label="Você está em">
        <ol className="trilha">
          <li><Link to="/">Início</Link></li>
          <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>
          <li><span className="at" aria-current="page">Todos os anúncios</span></li>
        </ol>
      </nav>

      <div className="bus-cabeca">
        <div>
          <div className="titulo-pagina">
            <h1 className="t-titulo-1">Todos os anúncios</h1>
            {typeof total === 'number' && <span className="titulo-selo destaque">{total === 1 ? '1 anúncio' : `${total} anúncios`}</span>}
          </div>
          <p className="todos-sub">Tudo o que foi publicado em Viçosa e região, sem limite de distância.</p>
        </div>
        <SeletorOrdem opcoes={ORDENACOES} valor={ordem} onMudar={(o) => { setOrdem(o); setPagina(1) }} />
      </div>

      {!dados && !resultado?.erro && <p className="bus-vazio" role="status">Carregando anúncios…</p>}
      {resultado?.erro && !dados && (
        <div className="bus-vazio" role="alert">
          <b>Não foi possível carregar os anúncios.</b>
          <p>{resultado.erro.message}</p>
          <button type="button" className="ampliar-raio" onClick={() => setVersao((v) => v + 1)}>Tentar de novo</button>
        </div>
      )}
      {dados && (dados.itens.length ? (
        <div className={`bus-grade${carregando ? ' atualizando' : ''}`} aria-busy={carregando}>
          {dados.itens.map((anuncio) => (
            <CardAnuncio key={anuncio.id} anuncio={anuncio} favorito={anuncio.favoritado} onFavoritar={favoritar} />
          ))}
        </div>
      ) : (
        <div className="bus-vazio">
          <Icone nome="etiqueta" tamanho={42} cor="#4CA02B" />
          <h2>Nenhum anúncio publicado ainda</h2>
          <p>Seja a primeira pessoa a anunciar, ou veja as categorias.</p>
          <Link className="ampliar-raio" to="/anunciar">Anunciar</Link>
          <ul>{CATEGORIAS.map((categoria) => <li key={categoria.slug}><Link to={caminhoCategoria(categoria.slug)}>{categoria.nome}</Link></li>)}</ul>
        </div>
      ))}
      {dados && dados.total_paginas > 1 && <Paginacao pagina={pagina} totalPaginas={dados.total_paginas} onMudar={setPagina} />}
    </LayoutMarketplace>
  )
}
