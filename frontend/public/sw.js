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

// Baixa a imagem e devolve ela pronta (data:), ou null se não carregou. Assim a notificação nunca fica com
// a imagem quebrada: o Android trocava a que não carregava por uma letra cinza ("D", de desapegauai).
async function imagemQueCarrega(endereco, esperarMs = 4000) {
  if (!endereco) return null
  if (endereco.startsWith('data:')) return endereco
  const parar = new AbortController()
  const relogio = setTimeout(() => parar.abort(), esperarMs)
  try {
    const resposta = await fetch(new URL(endereco, self.location.origin).href, { signal: parar.signal })
    const tipo = resposta.headers.get('content-type') || ''
    if (!resposta.ok || !tipo.startsWith('image/')) return null
    const bytes = new Uint8Array(await resposta.arrayBuffer())
    let binario = ''
    for (const byte of bytes) binario += String.fromCharCode(byte)
    return `data:${tipo.split(';')[0]};base64,${btoa(binario)}`
  } catch {
    return null
  } finally {
    clearTimeout(relogio)
  }
}

// O aviso no padrão dos apps grandes:
// - no lugar do sino, a carinha do Uai em silhueta (o Android usa só o desenho e pinta do jeito dele);
// - à direita, a imagem do próprio aviso: a foto do anúncio, ou a foto (ou as iniciais) de quem falou com
//   a pessoa; se ela não carregar, a logo do app;
// - puxando a notificação para baixo, a foto do anúncio grande (dados.imagem).
// O título vem curto do servidor: no Android ele divide a linha com o nome do app e a hora.
// No iPhone o próprio sistema põe o ícone do app e ignora as imagens.
async function montarNotificacao(dados) {
  const [icone, imagem] = await Promise.all([
    (async () => (await imagemQueCarrega(dados.icone)) || (await avatarDeIniciais(dados.iniciais)) || '/apple-touch-icon.png')(),
    imagemQueCarrega(dados.imagem),
  ])
  return {
    titulo: dados.titulo || 'DesapegaUai',
    opcoes: {
      body: dados.texto || '',
      icon: icone,
      ...(imagem ? { image: imagem } : {}),
      badge: '/icone-notificacao-96.png',
      tag: dados.tag || undefined,
      renotify: Boolean(dados.tag), // mensagem nova da mesma conversa troca a notificação e avisa de novo
      data: { url: dados.url || '/' },
      lang: 'pt-BR',
    },
  }
}

self.addEventListener('push', (evento) => {
  let dados
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = { titulo: 'DesapegaUai', texto: evento.data?.text() ?? '' }
  }
  evento.waitUntil((async () => {
    const { titulo, opcoes } = await montarNotificacao(dados)
    return self.registration.showNotification(titulo, opcoes)
  })())
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
