import { useCallback, useEffect, useRef, useState } from 'react'
import { buscarProximos } from '../services/mercadoApi.js'
import { origemDaBusca, useLocalizacao } from '../services/localizacao.js'
import { ouvir, quandoReconectar, useTempoReal } from '../services/tempoReal.js'

const INTERVALO_MINIMO_MS = 3000 // entre duas atualizações automáticas do feed

/**
 * Anúncios perto da referência (GPS ou cidade/bairro), dentro do raio, com os filtros da tela.
 * Quem decide o que entra é a API; aqui só se pede de novo quando algo muda.
 */
export default function useFeedProximo(filtros) {
  const local = useLocalizacao()
  const { conectado } = useTempoReal()
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: null })
  const ultimaChave = useRef(null)
  const ultimaAtualizacao = useRef(0)
  const agendada = useRef(null)
  const pedidoAtual = useRef(null)

  // filtros null: a tela ainda não está pronta (ex.: carregando a categoria)
  const chave = filtros ? JSON.stringify({ ...origemDaBusca(local), raio_km: local.raioKm, ...filtros }) : null

  const carregar = useCallback(async (chaveDaConsulta, { forcar = false } = {}) => {
    if (!forcar && chaveDaConsulta === ultimaChave.current) return
    ultimaChave.current = chaveDaConsulta
    ultimaAtualizacao.current = Date.now()
    pedidoAtual.current?.abort()
    const controle = new AbortController()
    pedidoAtual.current = controle
    setEstado((atual) => ({ ...atual, carregando: true, erro: null }))
    try {
      const dados = await buscarProximos(JSON.parse(chaveDaConsulta), { sinal: controle.signal })
      setEstado({ dados, carregando: false, erro: null })
    } catch (erro) {
      if (erro.name === 'AbortError') return
      // perdeu a conexão: mantém o último resultado na tela
      setEstado((atual) => ({ dados: atual.dados, carregando: false, erro }))
    }
  }, [])

  useEffect(() => {
    if (chave) carregar(chave)
  }, [chave, carregar])

  // atualização automática, com intervalo mínimo e sem empilhar pedidos
  const atualizarDepois = useCallback(() => {
    if (agendada.current) return
    const espera = Math.max(0, INTERVALO_MINIMO_MS - (Date.now() - ultimaAtualizacao.current))
    agendada.current = setTimeout(() => {
      agendada.current = null
      if (ultimaChave.current) carregar(ultimaChave.current, { forcar: true })
    }, espera)
  }, [carregar])

  useEffect(() => {
    const pararPublicado = ouvir('anuncio_publicado', atualizarDepois)
    const pararAtualizado = ouvir('anuncio_atualizado', atualizarDepois)
    // removido ou vendido: sai da tela na hora, sem esperar a API
    const pararRemovido = ouvir('anuncio_removido', ({ id }) => {
      setEstado((atual) => (atual.dados
        ? { ...atual, dados: { ...atual.dados, itens: atual.dados.itens.filter((item) => item.id !== id), total: Math.max(0, atual.dados.total - (atual.dados.itens.some((item) => item.id === id) ? 1 : 0)) } }
        : atual))
    })
    const pararReconexao = quandoReconectar(atualizarDepois)
    return () => {
      pararPublicado()
      pararAtualizado()
      pararRemovido()
      pararReconexao()
      clearTimeout(agendada.current)
      agendada.current = null
      pedidoAtual.current?.abort()
      // o pedido foi cancelado: esquece a chave, senão a mesma busca não é refeita quando a tela
      // volta (acontece no npm run dev, que monta cada tela duas vezes) e a lista fica em "Carregando"
      ultimaChave.current = null
    }
  }, [atualizarDepois])

  const marcarFavorito = useCallback((id, favoritado) => {
    setEstado((atual) => (atual.dados
      ? { ...atual, dados: { ...atual.dados, itens: atual.dados.itens.map((item) => (item.id === id ? { ...item, favoritado } : item)) } }
      : atual))
  }, [])

  return {
    ...estado,
    semConexao: !conectado,
    local,
    recarregar: () => carregar(ultimaChave.current, { forcar: true }),
    marcarFavorito,
  }
}
