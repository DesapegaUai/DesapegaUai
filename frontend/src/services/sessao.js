import { useSyncExternalStore } from 'react'
import { api } from './api.js'
import { reconectarTempoReal } from './tempoReal.js'

// Quem está logado. Carrega uma vez ao abrir o site (GET /auth/sessao, que também registra o acesso).

let estado = { carregando: true, usuario: null }
let pedido = null
const ouvintes = new Set()

function mudar(novo, { reconectar = true } = {}) {
  const trocouDeConta = novo.usuario?.id !== estado.usuario?.id
  estado = novo
  ouvintes.forEach((avisar) => avisar())
  if (trocouDeConta && reconectar) reconectarTempoReal()
}

// Ao abrir o site o cookie é o mesmo com que o tempo real já conectou: não precisa reconectar.
// (Reconectar aqui cortava a conexão no meio e fazia as telas carregarem os dados duas vezes.)
// Só entrar e sair da conta trocam o cookie com a página aberta.
export function carregarSessao() {
  pedido ??= api.get('/auth/sessao')
    .then(({ usuario }) => mudar({ carregando: false, usuario }, { reconectar: false }))
    .catch(() => mudar({ carregando: false, usuario: null }, { reconectar: false }))
    .finally(() => { pedido = null })
  return pedido
}

export function entrou(usuario) {
  mudar({ carregando: false, usuario })
  window.dispatchEvent(new CustomEvent('desapegauai:login', { detail: usuario }))
}

// sair: o aparelho deixa de receber push e o cookie é apagado
export async function sair() {
  let pushEndpoint = null
  try {
    const registro = await navigator.serviceWorker?.getRegistration()
    const inscricao = await registro?.pushManager.getSubscription()
    if (inscricao) {
      pushEndpoint = inscricao.endpoint
      await inscricao.unsubscribe()
    }
  } catch {
    // sem service worker: nada para desinscrever
  }
  await api.post('/auth/logout', pushEndpoint ? { push_endpoint: pushEndpoint } : {}).catch(() => {})
  mudar({ carregando: false, usuario: null })
  window.dispatchEvent(new Event('desapegauai:logout'))
}

window.addEventListener('desapegauai:nao-autenticado', () => {
  if (estado.usuario) mudar({ carregando: false, usuario: null })
})

const assinar = (avisar) => {
  ouvintes.add(avisar)
  return () => ouvintes.delete(avisar)
}
export const useSessao = () => useSyncExternalStore(assinar, () => estado)
