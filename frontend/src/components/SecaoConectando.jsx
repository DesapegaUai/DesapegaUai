import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import useMediaQuery from '../hooks/useMediaQuery.js'
import { useLocalizacao } from '../services/localizacao.js'
import { listarRecentes } from '../services/mercadoApi.js'
import { ouvir, quandoReconectar } from '../services/tempoReal.js'
import Icone from './Icone.jsx'
import IconeDaCategoria from './IconeMarketplace.jsx'
import { CATEGORIAS } from '../services/categorias.js'
import './SecaoConectando.css'

const formatarPreco = (valor) =>
  Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/* Lugares da foto onde ficam os cards (o CSS define a posição de cada classe) */
const lugares = ['rg-bici', 'rg-sofa', 'rg-iphone', 'rg-mesa']
const pinos = ['rg-p1', 'rg-p2', 'rg-p3', 'rg-p4']

/* No celular só aparecem dois lugares (o CSS esconde os outros); anúncio novo entra sempre num desses dois */
const LUGARES_DO_CELULAR = [0, 2]
const LUGARES_DO_COMPUTADOR = [0, 2, 1, 3]
const CELULAR = '(max-width: 760px)'

const QUANTOS_BUSCAR = 12 // anúncios mais recentes que ficam revezando nos cards
const TEMPO_ENTRE_TROCAS_MS = 4000 // a cada 4 s sai o card mais antigo da tela e entra outro anúncio
const TEMPO_MINIMO_MS = 1500 // anúncio recém-publicado entra na hora, mas nunca dois em menos que isso
const TEMPO_DE_SAIDA_MS = 300 // duração da animação do anúncio saindo (rg-sai, no CSS)

const iconeDaCategoria = (slug) => CATEGORIAS.find((c) => c.slug === slug)?.icone ?? 'etiqueta'

export default function SecaoConectando() {
  const celular = useMediaQuery(CELULAR)
  // a cidade de referência da pessoa: os anúncios dela já aparecem em "Achados perto de você", logo acima
  const cidadeDaPessoa = useLocalizacao().cidade?.nome ?? null
  // um card por lugar da foto (null = lugar vazio): { anuncio, novo, saindo }
  const [cards, setCards] = useState(() => lugares.map(() => null))

  useEffect(() => {
    const emUso = celular ? LUGARES_DO_CELULAR : LUGARES_DO_COMPUTADOR
    const naTela = lugares.map(() => null) // { anuncio, novo, saindo, desde }
    const vezes = new Map() // id do anúncio -> ordem em que apareceu pela última vez
    let lista = [] // anúncios ativos mais recentes, o mais novo primeiro
    let recemPublicados = [] // ids avisados pelo servidor que ainda não apareceram
    let contador = 0
    let ultimaTroca = 0
    let relogio = null
    let pedido = null
    const saidas = new Set()

    const mostrar = () => setCards(naTela.map((c) => (c ? { anuncio: c.anuncio, novo: c.novo, saindo: c.saindo } : null)))
    // conta também quem já está escalado para entrar num lugar (durante a animação de saída)
    const estaNaTela = (id) => naTela.some((c) => c?.anuncio.id === id || c?.entrando?.anuncio.id === id)

    // quem entra agora: primeiro o recém-publicado; depois, quem está há mais tempo sem aparecer
    function proximoAnuncio() {
      while (recemPublicados.length) {
        const id = recemPublicados[0]
        const anuncio = lista.find((a) => a.id === id)
        if (!anuncio) break // ainda não veio na lista: espera a próxima carga
        recemPublicados.shift()
        if (!estaNaTela(id)) return { anuncio, novo: true }
      }
      let escolhido = null
      for (const anuncio of lista) {
        if (estaNaTela(anuncio.id)) continue
        if (!escolhido || (vezes.get(anuncio.id) ?? -1) < (vezes.get(escolhido.id) ?? -1)) escolhido = anuncio
      }
      return escolhido ? { anuncio: escolhido, novo: false } : null
    }

    function colocar(lugar, entrada) {
      naTela[lugar] = entrada ? { ...entrada, saindo: false, desde: (contador += 1) } : null
      if (entrada) vezes.set(entrada.anuncio.id, contador)
      ultimaTroca = Date.now()
      mostrar()
    }

    // o anúncio do lugar sai (com animação) e entra o próximo; sem próximo, o lugar fica vazio
    function substituir(lugar, entrada) {
      const atual = naTela[lugar]
      if (!atual) return colocar(lugar, entrada)
      if (atual.saindo) return
      atual.saindo = true
      atual.entrando = entrada
      mostrar()
      const saida = setTimeout(() => {
        saidas.delete(saida)
        // se o que ia entrar foi vendido ou excluído nesse meio tempo, entra outro
        const aindaVale = entrada && lista.some((a) => a.id === entrada.anuncio.id)
        colocar(lugar, aindaVale ? entrada : proximoAnuncio())
      }, TEMPO_DE_SAIDA_MS)
      saidas.add(saida)
    }

    // lugar vazio primeiro; senão, o card que está há mais tempo na tela
    function lugarParaTrocar(candidatos) {
      const vazio = candidatos.find((i) => !naTela[i])
      if (vazio !== undefined) return vazio
      const livres = candidatos.filter((i) => !naTela[i].saindo)
      if (!livres.length) return null
      return livres.reduce((maisAntigo, i) => (naTela[i].desde < naTela[maisAntigo].desde ? i : maisAntigo))
    }

    function agendar(espera = TEMPO_ENTRE_TROCAS_MS) {
      clearTimeout(relogio)
      relogio = setTimeout(() => {
        // "Pausar animações" do menu de acessibilidade: os cards param de trocar sozinhos
        if (document.documentElement.classList.contains('sem-animacao')) return agendar()
        const entrada = proximoAnuncio()
        const lugar = entrada && lugarParaTrocar(entrada.novo ? LUGARES_DO_CELULAR : emUso)
        if (entrada && lugar !== null) substituir(lugar, entrada)
        else if (entrada?.novo) recemPublicados.unshift(entrada.anuncio.id)
        agendar()
      }, espera)
    }

    async function carregar() {
      pedido?.abort()
      const controle = new AbortController()
      pedido = controle
      try {
        const recentes = await listarRecentes(QUANTOS_BUSCAR, { sinal: controle.signal })
        // primeiro as outras cidades da região; os da cidade da pessoa entram depois, no rodízio
        lista = [...recentes.filter((a) => a.cidade !== cidadeDaPessoa), ...recentes.filter((a) => a.cidade === cidadeDaPessoa)]
      } catch {
        return // sem conexão: continua com o que já está na tela
      }
      if (controle.signal.aborted) return

      // quem está na tela: atualiza título/preço/foto; se saiu da lista (vendido, excluído), troca
      naTela.forEach((card, lugar) => {
        if (!card || card.saindo) return
        const atualizado = lista.find((a) => a.id === card.anuncio.id)
        if (atualizado) card.anuncio = atualizado
        else substituir(lugar)
      })
      // lugares vazios (primeira carga, ou anúncio que saiu sem ter outro para entrar)
      for (const lugar of emUso) {
        if (naTela[lugar]) continue
        const entrada = proximoAnuncio()
        if (!entrada) break
        colocar(lugar, entrada)
      }
      mostrar()
      // recém-publicado esperando: entra já (respeitando o tempo mínimo entre duas trocas)
      const temNovo = recemPublicados.some((id) => lista.some((a) => a.id === id))
      if (temNovo) agendar(Math.max(0, TEMPO_MINIMO_MS - (Date.now() - ultimaTroca)))
      else if (!relogio) agendar()
    }

    carregar()

    const pararPublicado = ouvir('anuncio_publicado', ({ id }) => {
      if (!recemPublicados.includes(id)) recemPublicados = [...recemPublicados, id].slice(-QUANTOS_BUSCAR)
      carregar()
    })
    const pararAtualizado = ouvir('anuncio_atualizado', carregar)
    // vendido ou excluído: sai da tela na hora
    const pararRemovido = ouvir('anuncio_removido', ({ id }) => {
      lista = lista.filter((a) => a.id !== id)
      recemPublicados = recemPublicados.filter((novo) => novo !== id)
      const lugar = naTela.findIndex((c) => c?.anuncio.id === id)
      if (lugar !== -1) substituir(lugar)
    })
    const pararReconexao = quandoReconectar(carregar)

    return () => {
      pararPublicado()
      pararAtualizado()
      pararRemovido()
      pararReconexao()
      clearTimeout(relogio)
      saidas.forEach(clearTimeout)
      pedido?.abort()
    }
  }, [celular, cidadeDaPessoa])

  return (
    <section className="conecta">
      <div className="rg-grade">
        <div className="rg-cab-txt">
          <div className="rg-sobre">
            <i />
            Viçosa e região
          </div>
          <h2 className="rg-tit">
            Conectando
            <br />
            pessoas da
            <br />
            <span>sua região.</span>
          </h2>
        </div>

        <div className="rg-cab-cta">
          <p className="rg-apoio">Produtos mais perto de você, mais praticidade e uma comunidade mais forte.</p>
          <Link className="rg-btn" to="/busca">
            Ver anúncios perto de mim
            <Icone nome="home-seta-botao" tamanho={19} />
          </Link>
        </div>

        <div className="rg-caixa">
          <img className="rg-foto" src="/img/fotos/cidade-regiao.webp" alt="" loading="lazy" />
          <div className="rg-veu" />

          {pinos.map((p) => (
            <img key={p} className={`rg-pino ${p}`} src="/img/marcador-mapa.svg" alt="" />
          ))}

          {/* O card fica sempre no lugar (flutuando); só o conteúdo troca, por isso a key vai na foto e no texto */}
          {cards.map((c, i) => c && (
            <Link
              key={lugares[i]}
              to={`/anuncio/${c.anuncio.id}`}
              className={`rg-card ${lugares[i]}${c.saindo ? ' rg-saindo' : ''}`}
            >
              {c.novo && (
                <span key={c.anuncio.id} className="rg-novo">
                  <i />
                  Novo
                </span>
              )}
              {c.anuncio.foto
                ? <img key={`foto-${c.anuncio.id}`} src={c.anuncio.foto} alt="" />
                : <span key={`foto-${c.anuncio.id}`} className="rg-sf"><IconeDaCategoria nome={iconeDaCategoria(c.anuncio.categoria)} tamanho={24} cor="#4CA02B" espessura={1.5} /></span>}
              <div key={`txt-${c.anuncio.id}`} className="rg-card-txt">
                <b>{c.anuncio.titulo}</b>
                <span className="rg-preco">{formatarPreco(c.anuncio.preco)}</span>
                {/* nome de bairro ou cidade comprido termina em "..." dentro do card; o nome inteiro aparece ao passar o mouse */}
                <span className="rg-local" title={c.anuncio.local}>
                  <Icone nome="home-localizacao-pequeno" tamanho={13} />
                  <span className="rg-local-texto">{c.anuncio.local}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
