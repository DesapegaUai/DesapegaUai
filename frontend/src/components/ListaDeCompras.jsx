import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import AnelDaNota from './AnelDaNota.jsx'
import BrilhoIA from './BrilhoIA.jsx'
import Icone from './IconeMarketplace.jsx'
import SemFoto from './SemFoto.jsx'
import useAoMudarAnuncios from '../hooks/useAoMudarAnuncios.js'
import { CATEGORIAS } from '../services/categorias.js'
import { textoDaDistancia } from '../services/comparador.js'
import { formatarPreco } from '../services/formatar.js'
import { origemDaBusca, useLocalizacao } from '../services/localizacao.js'
import { adicionarNaLista, listaDeCompras, marcarComoComprado, tirarDaLista } from '../services/mercadoApi.js'
import '../styles/marketplace-comparador.css'

const TEMPO_DO_DESFAZER_MS = 6000
const SUGESTOES = ['Celular usado até R$ 800', 'Mesa de escritório', 'Bicicleta aro 29', 'Geladeira frost free']
const iconeDoItem = (item) => CATEGORIAS.find((c) => c.slug === item.anuncios[0]?.categoria)?.icone ?? 'sacola'

/**
 * Lista de compras (aba de Favoritos): a pessoa escreve o que quer, a IA do DesapegaUai mostra o que entendeu
 * e os anúncios que combinam perto dela, com a nota de custo-benefício. É particular: ninguém mais vê.
 * Ao vivo: anúncio novo, preço novo, vendido ou excluído atualizam a lista na hora.
 */
export default function ListaDeCompras({ onTotal, onErro }) {
  const local = useLocalizacao()
  const referencia = JSON.stringify({ ...origemDaBusca(local), raio_km: local.raioKm })
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [texto, setTexto] = useState('')
  const [erroCampo, setErroCampo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [removido, setRemovido] = useState(null)
  const pedido = useRef(null)
  const campoRef = useRef(null)

  const carregar = useCallback(() => {
    pedido.current?.abort()
    const controle = new AbortController()
    pedido.current = controle
    return listaDeCompras(JSON.parse(referencia), { sinal: controle.signal })
      .then((resultado) => {
        setDados(resultado)
        setErro(null)
        onTotal?.(resultado.itens.length)
      })
      .catch((falha) => { if (falha.name !== 'AbortError') setErro(falha.message) })
  }, [referencia, onTotal])

  useEffect(() => {
    carregar()
    return () => pedido.current?.abort()
  }, [carregar])
  useAoMudarAnuncios(carregar)

  // o "Desfazer" some sozinho depois de alguns segundos
  useEffect(() => {
    if (!removido) return undefined
    const relogio = setTimeout(() => setRemovido(null), TEMPO_DO_DESFAZER_MS)
    return () => clearTimeout(relogio)
  }, [removido])

  async function adicionar(evento) {
    evento.preventDefault()
    const limpo = texto.trim()
    if (limpo.length < 2) {
      setErroCampo('Escreva o que você quer encontrar, por exemplo: celular usado até R$ 800.')
      campoRef.current?.focus()
      return
    }
    setSalvando(true)
    try {
      await adicionarNaLista(limpo, local.cidade?.id)
      setTexto('')
      setErroCampo('')
      await carregar()
    } catch (falha) {
      setErroCampo(falha.message)
      campoRef.current?.focus()
    } finally {
      setSalvando(false)
    }
  }

  function usarSugestao(sugestao) {
    setTexto(sugestao)
    setErroCampo('')
    campoRef.current?.focus()
  }

  async function alternarComprado(item) {
    try {
      await marcarComoComprado(item.id, !item.comprado)
      await carregar()
    } catch (falha) {
      onErro?.('Não foi possível marcar o item', falha.message)
    }
  }

  async function tirar(item) {
    try {
      await tirarDaLista(item.id)
      setRemovido(item)
      await carregar()
    } catch (falha) {
      onErro?.('Não foi possível tirar o item', falha.message)
    }
  }

  async function desfazer() {
    const item = removido
    setRemovido(null)
    try {
      const novo = await adicionarNaLista(item.texto, local.cidade?.id)
      if (item.comprado) await marcarComoComprado(novo.id, true)
      await carregar()
    } catch (falha) {
      onErro?.('Não foi possível desfazer', falha.message)
    }
  }

  const itens = dados?.itens ?? []
  const comAnuncios = itens.filter((item) => !item.comprado && item.anuncios.length > 0)
  const faltam = itens.filter((item) => !item.comprado).length

  return (
    <div className="col-grade">
      <section className="lc-hero" aria-labelledby="lc-titulo">
        <div className="lc-hero-topo">
          <span className="ia-bloco"><Icone nome="sacola" tamanho={24} cor="#fff" espessura={1.9} /></span>
          <div>
            <h2 id="lc-titulo">O que você quer encontrar?</h2>
            <p>Escreva do seu jeito. A IA entende, procura perto de você e avisa quando aparecer.</p>
          </div>
        </div>
        <form className="lc-form" onSubmit={adicionar} noValidate>
          <label className="lc-campo">
            <span className="oculto">O que você quer encontrar?</span>
            <BrilhoIA tamanho={20} />
            <input
              ref={campoRef}
              value={texto}
              onChange={(e) => { setTexto(e.target.value); setErroCampo('') }}
              maxLength={80}
              placeholder="Ex.: celular usado até R$ 800"
              aria-invalid={Boolean(erroCampo)}
              aria-describedby={erroCampo ? 'lc-erro' : 'lc-ajuda'}
            />
          </label>
          <button type="submit" className="cmp-btn" disabled={salvando}>
            <Icone nome="mais" tamanho={18} cor="#fff" espessura={2.4} />
            {salvando ? 'Adicionando…' : 'Adicionar'}
          </button>
        </form>
        {erroCampo && <p id="lc-erro" className="lc-erro" role="alert">{erroCampo}</p>}
        <div className="lc-sugestoes">
          <span>Experimente:</span>
          {SUGESTOES.map((sugestao) => <button key={sugestao} type="button" onClick={() => usarSugestao(sugestao)}>{sugestao}</button>)}
        </div>
        <p id="lc-ajuda" className="lc-ajuda">
          <Icone nome="cadeado" tamanho={15} cor="#6B726C" />
          Só você vê a sua lista. Quem anuncia não fica sabendo o que você procura.
        </p>
      </section>

      {itens.length > 0 && (
        <div className="lc-resumo">
          <div className="lc-numero"><span><Icone nome="sacola" tamanho={15} cor="#6B726C" />Na lista</span><b>{faltam} {faltam === 1 ? 'item' : 'itens'}</b></div>
          <div className="lc-numero"><span><Icone nome="busca" tamanho={15} cor="#6B726C" />Já encontrados</span><b>{comAnuncios.length} de {faltam}</b></div>
          <div className="lc-numero lc-melhores">
            <span><BrilhoIA tamanho={15} cor="#fff" />Pelos melhores de cada item</span>
            <b>{formatarPreco(dados.total_estimado)}</b>
            {comAnuncios.length > 0 && <small>{comAnuncios.map((item) => `${item.entendi[0].toLowerCase()} ${formatarPreco(item.anuncios[0].preco)}`).join(' + ')}</small>}
          </div>
        </div>
      )}

      {erro && !dados && <div className="vazio" role="alert"><b>Não foi possível carregar a lista.</b><p>{erro}</p></div>}
      {!dados && !erro && <p className="lc-ajuda" role="status">Carregando a lista…</p>}
      {dados && itens.length === 0 && (
        <div className="vazio">
          <Icone nome="sacola" tamanho={36} cor="#4CA02B" />
          <b>Sua lista de compras está vazia</b>
          <p>Coloque o que você quer comprar. A IA procura nos anúncios perto de você, mostra o melhor custo-benefício e avisa quando aparecer um novo.</p>
        </div>
      )}

      {itens.length > 0 && (
        <ul className="lc-itens">
          {itens.map((item) => (
            <li key={item.id} className={`lc-item${item.comprado ? ' comprado' : ''}`}>
              <div className="lc-item-cab">
                <span className="ia-bloco claro"><Icone nome={iconeDoItem(item)} tamanho={22} cor="#3E8B22" espessura={1.7} /></span>
                <div className="lc-item-txt">
                  <h2>{item.texto}</h2>
                  <p className="lc-entendi"><BrilhoIA tamanho={13} />A IA entendeu: {item.entendi.map((parte) => <span key={parte} className="cmp-chip">{parte}</span>)}</p>
                </div>
                <div className="lc-lado">
                  {item.comprado
                    ? <span className="lc-status comprado"><Icone nome="check" tamanho={14} cor="currentColor" espessura={2.6} />Comprado</span>
                    : item.total > 0
                      ? <span className="lc-status achou"><i aria-hidden="true" />{item.total} {item.total === 1 ? 'encontrado' : 'encontrados'}</span>
                      : <span className="lc-status aguardando"><Icone nome="sino" tamanho={14} cor="currentColor" espessura={2} />Aguardando</span>}
                  <div className="lc-acoes">
                    <button type="button" className="lc-acao" aria-pressed={item.comprado} onClick={() => alternarComprado(item)}>
                      <Icone nome="check" tamanho={15} cor="currentColor" espessura={2.4} />
                      {item.comprado ? 'Comprado' : 'Comprei'}
                    </button>
                    <button type="button" className="lc-acao so-icone" aria-label={`Tirar "${item.texto}" da lista`} title="Tirar da lista" onClick={() => tirar(item)}>
                      <Icone nome="lixeira" tamanho={17} cor="#6B726C" />
                    </button>
                  </div>
                </div>
              </div>

              {!item.comprado && item.total > 0 && (
                <>
                  <p className="lc-achados">
                    <b>{item.total} {item.total === 1 ? 'anúncio' : 'anúncios'}</b> perto de você · a partir de <b>{formatarPreco(item.menor_preco)}</b>
                  </p>
                  <ul className="lc-minis">
                    {item.anuncios.map((anuncio) => (
                      <li key={anuncio.id}>
                        <Link className={`lc-mini${anuncio.melhor ? ' melhor' : ''}`} to={`/anuncio/${anuncio.id}`}>
                          {anuncio.melhor && <span className="cmp-fita"><Icone nome="medalha" tamanho={13} cor="#fff" espessura={2} />Melhor custo-benefício</span>}
                          <span className="cmp-miniatura">
                            {anuncio.foto ? <img src={anuncio.foto} alt="" loading="lazy" /> : <SemFoto categoria={anuncio.categoria} tamanho={28} />}
                          </span>
                          <span className="lc-mini-txt">
                            <b>{anuncio.titulo}</b>
                            <span className="lc-mini-preco">{formatarPreco(anuncio.preco)}</span>
                            <span className="lc-mini-local">{[anuncio.bairro, textoDaDistancia(anuncio.distancia_km) && `a ${textoDaDistancia(anuncio.distancia_km)}`].filter(Boolean).join(' · ')}</span>
                          </span>
                          <AnelDaNota nota={anuncio.nota} tamanho={44} espessura={4} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="lc-links">
                    {item.anuncios.length >= 2 && (
                      <Link className="lc-ver" to={`/comparar?ids=${item.anuncios.map((a) => a.id).join(',')}`}>
                        Comparar estes {item.anuncios.length} <Icone nome="seta-direita" tamanho={16} cor="currentColor" />
                      </Link>
                    )}
                    {item.total > item.anuncios.length && (
                      <Link className="lc-ver" to={`/busca?q=${encodeURIComponent(item.entendi[0])}`}>
                        Ver mais na busca <Icone nome="seta-direita" tamanho={16} cor="currentColor" />
                      </Link>
                    )}
                  </div>
                </>
              )}
              {!item.comprado && item.total === 0 && (
                <p className="lc-esperando"><Icone nome="sino" tamanho={18} cor="#B8860B" espessura={1.9} />Nenhum anúncio ainda. A IA avisa você quando aparecer.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {removido && (
        <div className="aviso-flutuante" role="status">
          <span>"{removido.texto}" saiu da lista.</span>
          <button type="button" onClick={desfazer}>Desfazer</button>
        </div>
      )}
    </div>
  )
}
