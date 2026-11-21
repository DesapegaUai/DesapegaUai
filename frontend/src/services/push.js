import { api } from './api.js'

// Notificação push (Web Push): o aparelho recebe o aviso mesmo com o site fechado, enquanto a
// pessoa não sair da conta. Precisa de https (ou localhost) e, no iPhone, do site adicionado à
// Tela de Início.

export function motivoSemPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'Este navegador não recebe notificações push. Os avisos aparecem quando o site estiver aberto.'
  }
  if (!window.isSecureContext) return 'As notificações push só funcionam em endereço seguro (https). Os avisos aparecem quando o site estiver aberto.'
  return null
}

function chaveEmBytes(base64) {
  const preenchida = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(preenchida), (letra) => letra.charCodeAt(0))
}

export async function registrarServiceWorker() {
  if (motivoSemPush()) return null
  return navigator.serviceWorker.register('/sw.js')
}

// pede a permissão (só depois do clique da pessoa) e inscreve este aparelho na API
export async function inscreverAparelho() {
  const motivo = motivoSemPush()
  if (motivo) return { ok: false, motivo }
  const { chave_publica: chave } = await api.get('/notificacoes/push/chave')
  if (!chave) return { ok: false, motivo: 'As notificações push ainda não foram configuradas no servidor. Os avisos aparecem quando o site estiver aberto.' }

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') {
    return { ok: false, motivo: 'Você não permitiu notificações neste navegador. Os avisos aparecem quando o site estiver aberto.' }
  }
  const registro = await registrarServiceWorker()
  await navigator.serviceWorker.ready
  const inscricao = (await registro.pushManager.getSubscription())
    ?? (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(chave) }))
  await api.post('/notificacoes/push', inscricao.toJSON())
  return { ok: true }
}

export async function desinscreverAparelho() {
  if (motivoSemPush()) return
  const registro = await navigator.serviceWorker.getRegistration()
  const inscricao = await registro?.pushManager.getSubscription()
  if (!inscricao) return
  await api.delete('/notificacoes/push', { endpoint: inscricao.endpoint }).catch(() => {})
  await inscricao.unsubscribe()
}

// depois do login: se a pessoa já tinha permitido, o aparelho volta a receber sem perguntar
export async function reinscreverSePermitido() {
  if (motivoSemPush() || Notification.permission !== 'granted') return
  try {
    const { chave_publica: chave } = await api.get('/notificacoes/push/chave')
    if (!chave) return
    const registro = await registrarServiceWorker()
    await navigator.serviceWorker.ready
    const inscricao = (await registro.pushManager.getSubscription())
      ?? (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(chave) }))
    await api.post('/notificacoes/push', inscricao.toJSON())
  } catch {
    // sem push: os avisos continuam chegando com o site aberto
  }
}
