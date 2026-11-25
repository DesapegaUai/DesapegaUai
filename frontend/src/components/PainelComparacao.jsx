import { Link } from 'react-router'
import AnelDaNota from './AnelDaNota.jsx'
import BrilhoIA from './BrilhoIA.jsx'
import Icone from './IconeMarketplace.jsx'
import SemFoto from './SemFoto.jsx'
import { formatarPreco } from '../services/formatar.js'
import { NOME_DA_CONDICAO, fraseDeFora, nomeDoGrupo, textoDaDistancia, textoDaFaixa } from '../services/comparador.js'
import '../styles/marketplace-comparador.css'

const NA_LISTA = 4 // a página "Comparar" mostra até 4 lado a lado
const SETA_DA_FAIXA = { abaixo: 'seta-baixo', acima: 'seta-cima', media: 'igual' }

/**
 * Comparação inteligente no topo da busca: a IA do DesapegaUai junta os anúncios parecidos, mostra o
 * menor preço, a média e o maior, e a nota de custo-benefício de cada um (o melhor primeiro). Ao vivo:
 * a busca refaz a conta quando um anúncio é publicado, muda de preço ou é vendido.
 */
export default function PainelComparacao({ dados }) {
  if (!dados) return null
  const { tipo, precos, anuncios, fora, total } = dados
  const mostrados = anuncios.slice(0, NA_LISTA)
  const foraDaConta = fraseDeFora(fora)

  return (
    <section className="cmp-painel" aria-labelledby="cmp-painel-titulo">
      <header className="cmp-cab">
        <div className="cmp-cab-titulo">
          <span className="ia-bloco"><BrilhoIA tamanho={24} cor="#fff" /></span>
          <div>
            <h2 id="cmp-painel-titulo">Comparação inteligente</h2>
            <p>A IA comparou {nomeDoGrupo(tipo, total)} <span className="cmp-aovivo" title="Atualiza sozinha quando um anúncio muda"><i aria-hidden="true" />Ao vivo</span></p>
          </div>
        </div>
        <dl className="cmp-stats">
          <div className="cmp-stat menor"><dt><Icone nome="seta-baixo" tamanho={14} cor="#3E8B22" espessura={2.4} />Menor preço</dt><dd>{formatarPreco(precos.menor)}</dd></div>
          <div className="cmp-stat"><dt><Icone nome="igual" tamanho={14} cor="#6B726C" espessura={2.4} />Preço médio</dt><dd>{formatarPreco(precos.media)}</dd></div>
          <div className="cmp-stat"><dt><Icone nome="seta-cima" tamanho={14} cor="#B8860B" espessura={2.4} />Maior preço</dt><dd>{formatarPreco(precos.maior)}</dd></div>
        </dl>
      </header>

      <ol className="cmp-linhas" aria-label="Do melhor custo-benefício para o menor">
        {mostrados.map((anuncio, i) => (
          <li key={anuncio.id} className={`cmp-linha${anuncio.melhor ? ' melhor' : ''}`}>
            {anuncio.melhor && <span className="cmp-fita"><Icone nome="medalha" tamanho={15} cor="#fff" espessura={1.9} />Melhor custo-benefício</span>}
            <span className="cmp-posicao" aria-hidden="true">{i + 1}</span>
            <span className="cmp-miniatura">
              {anuncio.foto ? <img src={anuncio.foto} alt="" loading="lazy" /> : <SemFoto categoria={anuncio.categoria} tamanho={24} />}
            </span>
            <div className="cmp-linha-info">
              <Link className="cmp-linha-titulo" to={`/anuncio/${anuncio.id}`}>{anuncio.titulo}</Link>
              <div className="cmp-linha-meta">
                <span><Icone nome="etiqueta" tamanho={14} cor="#8C918B" />{NOME_DA_CONDICAO[anuncio.condicao] ?? 'Sem estado'}</span>
                {textoDaDistancia(anuncio.distancia_km) && <span className="cmp-col-distancia"><Icone nome="local" tamanho={14} cor="#8C918B" />a {textoDaDistancia(anuncio.distancia_km)}</span>}
              </div>
            </div>
            <div className="cmp-linha-preco">
              <b>{formatarPreco(anuncio.preco)}</b>
              <span className={`cmp-faixa-mini ${anuncio.faixa.tipo}`}>
                <Icone nome={SETA_DA_FAIXA[anuncio.faixa.tipo]} tamanho={12} cor="currentColor" espessura={2.6} />
                {textoDaFaixa(anuncio.faixa, { curto: true })}
              </span>
            </div>
            <AnelDaNota nota={anuncio.nota} tamanho={54} />
          </li>
        ))}
      </ol>

      <footer className="cmp-pe">
        <p>
          <BrilhoIA tamanho={15} />
          {foraDaConta ?? 'A nota vai de 0 a 10 e junta preço, estado, características, fotos e distância.'}
          {!foraDaConta && total > NA_LISTA && ` Mostrando os ${NA_LISTA} melhores de ${total}.`}
        </p>
        <Link className="cmp-btn" to={`/comparar?ids=${mostrados.map((a) => a.id).join(',')}`}>
          Ver comparação completa <Icone nome="seta-direita" tamanho={16} cor="#fff" espessura={2.2} />
        </Link>
      </footer>
    </section>
  )
}
