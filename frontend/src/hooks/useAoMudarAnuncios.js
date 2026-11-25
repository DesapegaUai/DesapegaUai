import { useEffect, useEffectEvent } from 'react'
import { ouvir, quandoReconectar } from '../services/tempoReal.js'

/**
 * Tempo real para quem mostra anúncios calculados (comparador, lista de compras): chama `atualizar`
 * quando algum anúncio é publicado, muda (preço, fotos, status) ou sai (vendido, excluído), e quando a
 * conexão volta. Vários avisos seguidos viram um pedido só, com intervalo mínimo entre dois pedidos.
 */
export default function useAoMudarAnuncios(atualizar, { intervaloMs = 1500, ativo = true } = {}) {
  const aoMudar = useEffectEvent(() => atualizar())
  useEffect(() => {
    if (!ativo) return undefined
    let relogio = null
    let ultima = 0
    const agendar = () => {
      if (relogio) return
      relogio = setTimeout(() => {
        relogio = null
        ultima = Date.now()
        aoMudar()
      }, Math.max(0, intervaloMs - (Date.now() - ultima)))
    }
    const parares = [ouvir('anuncio_publicado', agendar), ouvir('anuncio_atualizado', agendar), ouvir('anuncio_removido', agendar), quandoReconectar(agendar)]
    return () => {
      parares.forEach((parar) => parar())
      clearTimeout(relogio)
    }
  }, [intervaloMs, ativo])
}
