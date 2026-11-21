// Service worker do DesapegaUai: mostra a notificação push mesmo com o site fechado
// e abre o anúncio quando a pessoa toca nela.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()))

self.addEventListener('push', (evento) => {
  let dados
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = { titulo: 'DesapegaUai', texto: evento.data?.text() ?? '' }
  }
  const titulo = dados.titulo || 'DesapegaUai'
  evento.waitUntil(self.registration.showNotification(titulo, {
    body: dados.texto || '',
    icon: dados.icone || '/icon-192.png',
    badge: '/favicon-48x48.png',
    tag: dados.tag || undefined,
    data: { url: dados.url || '/' },
    lang: 'pt-BR',
  }))
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
