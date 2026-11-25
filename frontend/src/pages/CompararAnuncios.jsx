import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import AnelDaNota from '../components/AnelDaNota.jsx'
import BrilhoIA from '../components/BrilhoIA.jsx'
import Icone from '../components/IconeMarketplace.jsx'
import LayoutMarketplace from '../components/LayoutMarketplace.jsx'
import SeloVinculo from '../components/SeloVinculo.jsx'
import SemFoto from '../components/SemFoto.jsx'
import Toast from '../components/Toast.jsx'
import useAoMudarAnuncios from '../hooks/useAoMudarAnuncios.js'
import { NOME_DA_CONDICAO, corDaNota, textoDaDistancia, textoDaFaixa, textoDaNota, vereditoDaNota } from '../services/comparador.js'
import { formatarPreco } from '../services/formatar.js'
import { origemDaBusca, useLocalizacao } from '../services/localizacao.js'
import { abrirConversa, compararAnuncios } from '../services/mercadoApi.js'
import { useSessao } from '../services/sessao.js'
import '../styles/marketplace-busca.css'
import '../styles/marketplace-comparador.css'

const MAXIMO = 4

/**
 * Comparar de 2 a 4 anúncios lado a lado (/comparar?ids=3,7,9). A IA do DesapegaUai lê os anúncios e dá a
 * nota de custo-benefício de 0 a 10, sempre com o motivo. Ao vivo: preço novo entra na hora, e o anúncio
 * vendido ou excluído sai da comparação com um aviso.
 */
export default function CompararAnuncios() {
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const { usuario } = useSessao()
  const local = useLocalizacao()
  const ids = useMemo(() => [...new Set((parametros.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAXIMO), [parametros])
  const chave = ids.length >= 2 ? JSON.stringify({ ids, ...origemDaBusca(local) }) : null
  const [estado, setEstado] = useState({ chave: null, dados: null, erro: null })
  const [toast, setToast] = useState(null)
  const pedido = useRef(null)

  const carregar = useCallback(async (chaveDaConsulta) => {
    if (!chaveDaConsulta) return
    pedido.current?.abort()
    const controle = new AbortController()
    pedido.current = controle
    const { ids: escolhidos, ...referencia } = JSON.parse(chaveDaConsulta)
    try {
      const dados = await compararAnuncios(escolhidos, referencia, { sinal: controle.signal })
      setEstado({ chave: chaveDaConsulta, dados, erro: null })
    } catch (erro) {
      if (erro.name === 'AbortError') return
      // 404: menos de 2 ainda à venda (a comparação some); outro erro: continua mostrando a última
      setEstado((atual) => ({ chave: chaveDaConsulta, dados: erro.status === 404 || atual.chave !== chaveDaConsulta ? null : atual.dados, erro }))
    }
  }, [])

  useEffect(() => {
    carregar(chave)
    return () => pedido.current?.abort()
  }, [chave, carregar])
  useAoMudarAnuncios(() => carregar(chave), { ativo: Boolean(chave) })

  const dados = estado.chave === chave ? estado.dados : null
  const erro = estado.chave === chave ? estado.erro : null
  const titulo = dados?.tipo ? `Comparar ${dados.tipo.plural}` : 'Comparar anúncios'

  useEffect(() => {
    document.title = `DesapegaUai — ${titulo}`
  }, [titulo])

  async function conversar(anuncio) {
    if (!usuario) {
      navegar('/entrar')
      return
    }
    try {
      const resultado = await abrirConversa(anuncio.id)
      navegar(`/conversas/${resultado.conversa.id}`)
    } catch (falha) {
      setToast({ tipo: 'erro', titulo: 'Não foi possível abrir a conversa', texto: falha.message, chave: Date.now() })
    }
  }

  const anuncios = dados?.anuncios ?? []
  const celula = (anuncio, conteudo, extra = '') => (
    <div key={anuncio.id} className={`cmp-celula${anuncio.melhor ? ' cmp-vence' : ''}${extra}`}>{conteudo}</div>
  )
  const linha = (icone, rotulo, conteudo, extra = '') => (
    <>
      <div className="cmp-rotulo">{icone && <Icone nome={icone} tamanho={17} cor="#8C918B" />}<span>{rotulo}</span></div>
      {anuncios.map((anuncio) => celula(anuncio, conteudo(anuncio), extra))}
    </>
  )

  return (
    <LayoutMarketplace>
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      <nav aria-label="Você está em">
        <ol className="trilha">
          <li><Link to="/">Início</Link></li>
          <li aria-hidden="true"><Icone nome="seta-direita" tamanho={16} cor="#4CA02B" /></li>
          <li><span className="at" aria-current="page">Comparar</span></li>
        </ol>
      </nav>

      <div className="titulo-pagina">
        <h1 className="t-titulo-1">{titulo}</h1>
        {anuncios.length > 0 && <span className="titulo-selo">{anuncios.length} anúncios</span>}
      </div>
      <p className="cmp-sub">
        <BrilhoIA />
        A IA do DesapegaUai leu os anúncios e montou a comparação. Confira as fotos e converse com o vendedor antes de comprar.
        {anuncios.length > 0 && <span className="cmp-aovivo" title="Atualiza sozinha quando um anúncio muda"><i aria-hidden="true" />Ao vivo</span>}
      </p>

      {ids.length < 2 && (
        <div className="bus-vazio">
          <h2>Escolha pelo menos 2 anúncios para comparar.</h2>
          <p>Busque um produto: quando houver anúncios parecidos, a comparação aparece no topo da busca.</p>
          <Link to="/busca">Buscar anúncios</Link>
        </div>
      )}
      {chave && !dados && !erro && <p className="bus-vazio" role="status">Comparando os anúncios…</p>}
      {chave && erro && !dados && (
        <div className="bus-vazio" role="alert">
          <h2>{erro.status === 404 ? 'Estes anúncios não estão mais à venda.' : 'Não foi possível comparar agora.'}</h2>
          <p>{erro.message}</p>
          <Link to="/busca">Buscar outros anúncios</Link>
        </div>
      )}
      {dados?.fora?.length > 0 && (
        <p className="cmp-saiu" role="status">
          <Icone nome="alerta" tamanho={18} cor="#B8860B" espessura={2} />
          {dados.fora.length === 1 ? '1 anúncio saiu da comparação porque não está mais à venda.' : `${dados.fora.length} anúncios saíram da comparação porque não estão mais à venda.`}
        </p>
      )}

      {anuncios.length >= 2 && (
        <div className="cmp-rolagem">
          <div className="cmp-tabela" style={{ '--colunas': anuncios.length }}>
            <div className="cmp-rotulo cmp-rotulo-topo" aria-hidden="true" />
            {anuncios.map((anuncio) => celula(anuncio, (
              <>
                {anuncio.melhor && <span className="cmp-fita"><Icone nome="medalha" tamanho={15} cor="#fff" espessura={1.9} />Melhor custo-benefício</span>}
                <Link to={`/anuncio/${anuncio.id}`} className="cmp-foto" tabIndex={-1} aria-hidden="true">
                  {anuncio.foto ? <img src={anuncio.foto} alt="" loading="lazy" /> : <SemFoto categoria={anuncio.categoria} tamanho={56} />}
                </Link>
                <Link className="cmp-titulo" to={`/anuncio/${anuncio.id}`}>{anuncio.titulo}</Link>
                <div className="cmp-preco">
                  {formatarPreco(anuncio.preco)}
                  <span className={`card-faixa ${anuncio.faixa.tipo}`}>{textoDaFaixa(anuncio.faixa)}</span>
                </div>
                {anuncio.status === 'reservado' && <span className="cmp-tag" style={{ marginTop: 8 }}>Reservado</span>}
              </>
            ), ' cmp-topo'))}

            {linha('medalha', 'Custo-benefício', (anuncio) => (
              <>
                <div className="cmp-nota-bloco" style={{ '--cor-nota': corDaNota(anuncio.nota) }}>
                  <AnelDaNota nota={anuncio.nota} tamanho={76} espessura={7} />
                  <div>
                    <span className="cmp-veredito">{vereditoDaNota(anuncio.nota)}</span>
                    <small>nota de 0 a 10</small>
                  </div>
                </div>
                <p className="cmp-motivo">{anuncio.motivo}</p>
              </>
            ))}
            {linha('etiqueta', 'Estado', (anuncio) => NOME_DA_CONDICAO[anuncio.condicao] ?? <span className="cmp-sem">Não informado</span>)}
            {linha('check', <>Características<small>lidas na descrição</small></>, (anuncio) => (anuncio.caracteristicas.length
              ? <div className="cmp-tags">{anuncio.caracteristicas.map((c) => <span key={c} className="cmp-chip"><Icone nome="check" tamanho={13} cor="#3E8B22" espessura={2.6} />{c}</span>)}</div>
              : <span className="cmp-sem">Nenhuma citada</span>))}
            {linha('alerta', 'Pontos de atenção', (anuncio) => (anuncio.atencao.length
              ? <div className="cmp-tags">{anuncio.atencao.map((a) => <span key={a} className="cmp-chip atencao"><Icone nome="alerta" tamanho={13} cor="#B8860B" espessura={2.2} />{a}</span>)}</div>
              : <span className="cmp-sem">Nenhum citado</span>))}
            {linha('local', 'Localização', (anuncio) => (
              <>
                {[anuncio.bairro, anuncio.cidade].filter(Boolean).join(', ')}
                {textoDaDistancia(anuncio.distancia_km) && <><br /><b className="cmp-distancia">a {textoDaDistancia(anuncio.distancia_km)}</b></>}
              </>
            ))}
            {linha('camera', 'Fotos e informações', (anuncio) => (
              <>
                {anuncio.total_fotos} {anuncio.total_fotos === 1 ? 'foto' : 'fotos'}
                <br /><span className="cmp-sem">{anuncio.descricao_completa ? 'Descrição completa' : 'Descrição curta'}</span>
              </>
            ))}
            {linha('perfil', 'Vendedor', (anuncio) => (
              <>
                <Link className="cmp-vendedor" to={`/usuario/${anuncio.vendedor.id}`}>{anuncio.vendedor.nome}</Link>
                <br />
                {anuncio.vendedor.avaliacao.total > 0
                  ? <span className="cmp-estrela"><Icone nome="estrela" tamanho={16} cor="#E0A100" preenchimento="#E0A100" />{textoDaNota(anuncio.vendedor.avaliacao.media)} ({anuncio.vendedor.avaliacao.total} {anuncio.vendedor.avaliacao.total === 1 ? 'avaliação' : 'avaliações'})</span>
                  : <span className="cmp-sem">Ainda sem avaliações</span>}
                {anuncio.vendedor.vinculo_academico && <><br /><SeloVinculo /></>}
              </>
            ))}
            {linha('', '', (anuncio) => (
              <div className="cmp-acoes">
                {usuario?.id !== anuncio.vendedor.id && (
                  <button type="button" className="cmp-btn" onClick={() => conversar(anuncio)}>
                    <Icone nome="mensagens" tamanho={17} cor="#fff" espessura={2} />Conversar
                  </button>
                )}
                <Link className="cmp-btn-contorno" to={`/anuncio/${anuncio.id}`}>Ver anúncio</Link>
              </div>
            ), ' cmp-fim')}
          </div>
        </div>
      )}
    </LayoutMarketplace>
  )
}
