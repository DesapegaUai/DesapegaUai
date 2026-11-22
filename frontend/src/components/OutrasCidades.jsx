import { useEffect, useRef, useState } from 'react'
import CardAnuncio from './CardAnuncioMarketplace.jsx'
import useFavoritar from '../hooks/useFavoritar.js'
import { buscarAlemDoRaio } from '../services/mercadoApi.js'
import { useLocalizacao } from '../services/localizacao.js'
import { ouvir } from '../services/tempoReal.js'

// Anúncios que ficaram fora da distância escolhida (por exemplo, de Ponte Nova para quem está em Viçosa
// com 5 km). Aparecem embaixo dos anúncios de perto, do mais perto para o mais longe, para nenhum anúncio
// da categoria ou da busca ficar escondido. filtros: os mesmos da tela, sem página e sem ordenação.
// idsDePerto: os anúncios que já estão na lista de perto (nunca aparecem duas vezes na tela).
export default function OutrasCidades({ filtros, idsDePerto = [], onErroFavorito, classeGrade = 'grade' }) {
  const local = useLocalizacao()
  const [itens, setItens] = useState([])
  const [versao, setVersao] = useState(0)
  const pedido = useRef(null)
  const favoritarAnuncio = useFavoritar({
    aoMudar: (id, favoritado) => setItens((atual) => atual.map((a) => (a.id === id ? { ...a, favoritado } : a))),
    aoErrar: onErroFavorito,
  })

  // a origem da distância: o GPS ou a cidade escolhida (a busca geral não usa o bairro como origem)
  const origem = local.modo === 'gps' && local.posicao
    ? { latitude: local.posicao.latitude, longitude: local.posicao.longitude }
    : { cidade_id: local.cidade?.id }
  const chave = filtros ? JSON.stringify({ ...filtros, ...origem, raio: local.raioKm }) : null

  useEffect(() => {
    if (!chave) return undefined
    const { raio, ...consulta } = JSON.parse(chave)
    pedido.current?.abort()
    const controle = new AbortController()
    pedido.current = controle
    buscarAlemDoRaio(consulta, raio, { sinal: controle.signal })
      .then(setItens)
      .catch(() => {}) // sem conexão: fica o que já estava na tela
    return () => controle.abort()
  }, [chave, versao])

  // anúncio novo, editado ou removido: atualiza a lista
  useEffect(() => {
    let espera = null
    const atualizar = () => { clearTimeout(espera); espera = setTimeout(() => setVersao((v) => v + 1), 3000) }
    const parar = [ouvir('anuncio_publicado', atualizar), ouvir('anuncio_atualizado', atualizar), ouvir('anuncio_removido', ({ id }) => setItens((atual) => atual.filter((a) => a.id !== id)))]
    return () => { clearTimeout(espera); parar.forEach((p) => p()) }
  }, [])

  const jaNaTela = new Set(idsDePerto)
  const visiveis = itens.filter((anuncio) => !jaNaTela.has(anuncio.id))
  if (!visiveis.length) return null

  return (
    <section className="outras-cidades" aria-labelledby="outras-cidades-titulo">
      <h2 id="outras-cidades-titulo" className="t-titulo-3">Em outras cidades da região</h2>
      <p className="outras-cidades-sub">A mais de {local.raioKm} km, do mais perto para o mais longe.</p>
      <div className={classeGrade}>
        {visiveis.map((anuncio) => (
          <CardAnuncio key={anuncio.id} anuncio={anuncio} favorito={anuncio.favoritado} onFavoritar={favoritarAnuncio} />
        ))}
      </div>
    </section>
  )
}
