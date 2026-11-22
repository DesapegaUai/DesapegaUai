// Service worker do DesapegaUai: mostra a notificação push mesmo com o site fechado
// e abre o anúncio quando a pessoa toca nela.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()))

// avatar de quem não tem foto, igual ao do site: iniciais verdes num círculo claro
async function avatarDeIniciais(iniciais) {
  if (!iniciais || typeof OffscreenCanvas === 'undefined') return null
  try {
    const tela = new OffscreenCanvas(192, 192)
    const pincel = tela.getContext('2d')
    pincel.fillStyle = '#EFF2EC'
    pincel.beginPath()
    pincel.arc(96, 96, 96, 0, Math.PI * 2)
    pincel.fill()
    pincel.fillStyle = '#3E8B22'
    pincel.font = '700 76px sans-serif'
    pincel.textAlign = 'center'
    pincel.textBaseline = 'middle'
    pincel.fillText(iniciais, 96, 100)
    const bytes = new Uint8Array(await (await tela.convertToBlob({ type: 'image/png' })).arrayBuffer())
    let binario = ''
    for (const byte of bytes) binario += String.fromCharCode(byte)
    return `data:image/png;base64,${btoa(binario)}`
  } catch {
    return null
  }
}

self.addEventListener('push', (evento) => {
  let dados
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = { titulo: 'DesapegaUai', texto: evento.data?.text() ?? '' }
  }
  const titulo = dados.titulo || 'DesapegaUai'
  evento.waitUntil((async () => self.registration.showNotification(titulo, {
    body: dados.texto || '',
    // mensagem do chat: a foto de quem mandou (sem foto, as iniciais); os outros avisos usam o ícone do site
    icon: dados.icone || (await avatarDeIniciais(dados.iniciais)) || '/icon-192.png',
    badge: '/favicon-48x48.png',
    tag: dados.tag || undefined,
    renotify: Boolean(dados.tag), // mensagem nova da mesma conversa troca a notificação e avisa de novo
    data: { url: dados.url || '/' },
    lang: 'pt-BR',
  }))())
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = new URL(evento.notification.data?.url || '/', self.location.origin).href
  evento.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const doSite = abertas.find((janela) => janela.url.startsWith(self.location.origin))
    if (doSite) {
      await doSite.focus()
      return doSite.navigate(destino)
    }
    return self.clients.openWindow(destino)
  })())
})
