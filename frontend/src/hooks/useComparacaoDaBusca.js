import { useCallback, useEffect, useRef, useState } from 'react'
import { compararBusca } from '../services/mercadoApi.js'
import { origemDaBusca, useLocalizacao } from '../services/localizacao.js'
import useAoMudarAnuncios from './useAoMudarAnuncios.js'

/**
 * A comparação dos parecidos da busca, feita pela IA do DesapegaUai, com a mesma referência de local e o
 * mesmo raio da busca. Em tempo real: anúncio novo, preço novo, vendido ou excluído refazem a conta.
 * Sem termo (ou com menos de 2 parecidos), volta null.
 */
export default function useComparacaoDaBusca(termo) {
  const local = useLocalizacao()
  const chave = termo ? JSON.stringify({ busca: termo, ...origemDaBusca(local), raio_km: local.raioKm }) : null
  const [resultado, setResultado] = useState({ chave: null, dados: null })
  const pedido = useRef(null)

  const carregar = useCallback((chaveDaConsulta) => {
    if (!chaveDaConsulta) return
    pedido.current?.abort()
    const controle = new AbortController()
    pedido.current = controle
    compararBusca(JSON.parse(chaveDaConsulta), { sinal: controle.signal })
      .then((dados) => setResultado({ chave: chaveDaConsulta, dados }))
      .catch(() => {}) // sem conexão ou pedido trocado: continua mostrando a última comparação desta busca
  }, [])

  useEffect(() => {
    carregar(chave)
    return () => pedido.current?.abort()
  }, [chave, carregar])

  useAoMudarAnuncios(() => carregar(chave), { ativo: Boolean(chave) })

  // a comparação de outra busca (ou de outro raio) não aparece enquanto a nova não chega
  const dados = resultado.chave === chave ? resultado.dados : null
  return dados?.anuncios?.length >= 2 ? dados : null
}
