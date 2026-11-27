// Gera os ícones do app e as telas de abertura do iPhone. Rodar de novo se a carinha ou as cores mudarem:
//   node scripts/gerar-telas-de-abertura.mjs        (na pasta frontend)
//
// A carinha de todos os ícones sai da logo (public/favicon.svg) e é alinhada pelo PESO: o centro de toda a
// parte escura (o "Uai", o sorriso e os brilhos) fica no meio do ícone. Centralizar pela caixa em volta deixa
// a carinha torta para o olho: os brilhos e o pingo do "i" pesam do lado direito.
//
// - public/icone-app-android-512.png: o ícone do app no Android (o celular recorta em círculo ou gota) e a
//   primeira tela do app, que o próprio Android desenha: o ícone no meio, em cima do background_color do
//   site.webmanifest (o mesmo #C6FE32). Como o fundo do ícone é o mesmo verde-limão, fica só a carinha, e a
//   tela de carregamento (src/styles/carregamento.css) continua com ela no mesmo lugar e tamanho.
//   A carinha ocupa 74% do ícone e fica dentro do círculo de 80% que o Android nunca corta.
//   A beirada é transparente (verde até 82% do meio, sumindo até 86%): a abertura do Android mostra o miolo
//   de 87% do ícone e escurecia a beira desse recorte, desenhando uma linha em volta da carinha. Com a beira
//   transparente não sobra o que escurecer. O ícone da tela inicial só mostra o miolo (até uns 80%), então
//   ele não muda. O verde fica guardado também nos pontos transparentes, para nenhum programa que aumente
//   ou diminua a imagem misturar a beira com preto.
// - public/apple-touch-icon.png: o ícone do app no iPhone.
// - public/icone-app-192.png e icone-app-512.png: os ícones "any" do manifest (instalar no computador).
// - public/icon-192.png e icon-512.png: a logo da notificação (sw.js) e a que o Google mostra (seo.js), com o
//   degradê da logo.
// - public/icone-notificacao-96.png: a carinha em silhueta branca, sem fundo, no lugar do sino das
//   notificações do Android (e na barra de cima do celular). O Android usa só o desenho, sem as cores, e
//   pinta ele do jeito dele: por isso é branca e com o fundo transparente.
// - public/abertura/*.jpg: a primeira tela do iPhone, uma por tamanho de tela, só com o degradê. Assim a
//   carinha começa a se desenhar na tela de carregamento sem pulo. Em JPEG: o degradê em PNG fica pesado.
import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { chromium } from '@playwright/test'

// PNG colorido com transparência, gravado aqui mesmo: o navegador zera a cor dos pontos transparentes ao
// salvar, e aqui ela continua verde
function pngComTransparencia(lado, rgba) {
  const pedaco = (tipo, dados) => {
    const tamanho = Buffer.alloc(4)
    tamanho.writeUInt32BE(dados.length)
    const tipoEDados = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
    const conferencia = Buffer.alloc(4)
    conferencia.writeUInt32BE(zlib.crc32(tipoEDados))
    return Buffer.concat([tamanho, tipoEDados, conferencia])
  }
  const cabecalho = Buffer.alloc(13)
  cabecalho.writeUInt32BE(lado, 0)
  cabecalho.writeUInt32BE(lado, 4)
  cabecalho[8] = 8 // 8 bits por cor
  cabecalho[9] = 6 // vermelho, verde, azul e transparência
  const linhas = Buffer.alloc(lado * (lado * 4 + 1))
  for (let y = 0; y < lado; y++) {
    linhas[y * (lado * 4 + 1)] = 0 // linha sem filtro
    Buffer.from(rgba.buffer, rgba.byteOffset + y * lado * 4, lado * 4).copy(linhas, y * (lado * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', cabecalho),
    pedaco('IDAT', zlib.deflateSync(linhas, { level: 9 })),
    pedaco('IEND', Buffer.alloc(0)),
  ])
}

// transparência da beirada do ícone do Android: opaco até 82% do meio, some até 86% (distância medida em
// quadrado, como o recorte da abertura do Android)
const BEIRA_OPACA = 0.82
const BEIRA_SOME = 0.86
function transparenciaDaBeira(lado, x, y) {
  const distancia = Math.max(Math.abs(x + 0.5 - lado / 2), Math.abs(y + 0.5 - lado / 2)) / (lado / 2)
  if (distancia <= BEIRA_OPACA) return 255
  if (distancia >= BEIRA_SOME) return 0
  return Math.round(255 * (BEIRA_SOME - distancia) / (BEIRA_SOME - BEIRA_OPACA))
}

const PUBLICO = path.join(import.meta.dirname, '..', 'public')
const INDEX = path.join(import.meta.dirname, '..', 'index.html')
const LIMAO = '#C6FE32'
const DEGRADE = 'linear-gradient(160deg, #E9FDB0 0%, #D4FE6E 35%, #C6FE32 55%, #98FD49 85%, #83FC55 100%)'
// posição da carinha na tela de carregamento (o <g> do #carregamento no index.html), antes do ajuste do peso
const CARINHA_DA_TELA = { x: -41.85, y: -63.7 }

// tamanho da tela em pontos (como o iPhone informa ao site) e a densidade
export const IPHONES = [
  { nome: 'iphone-16-pro-max', largura: 440, altura: 956, escala: 3 },
  { nome: 'iphone-16-pro', largura: 402, altura: 874, escala: 3 },
  { nome: 'iphone-15-pro-max', largura: 430, altura: 932, escala: 3 }, // também 14 Pro Max, 15 Plus e 16 Plus
  { nome: 'iphone-15', largura: 393, altura: 852, escala: 3 }, // também 14 Pro, 15 Pro e 16
  { nome: 'iphone-14-plus', largura: 428, altura: 926, escala: 3 }, // também 12 e 13 Pro Max
  { nome: 'iphone-14', largura: 390, altura: 844, escala: 3 }, // também 12, 13 e os Pro deles
  { nome: 'iphone-13-mini', largura: 375, altura: 812, escala: 3 }, // também X, XS, 11 Pro e 12 mini
  { nome: 'iphone-11-pro-max', largura: 414, altura: 896, escala: 3 }, // também XS Max
  { nome: 'iphone-11', largura: 414, altura: 896, escala: 2 }, // também XR
  { nome: 'iphone-8-plus', largura: 414, altura: 736, escala: 3 }, // também 6 Plus e 7 Plus
  { nome: 'iphone-se', largura: 375, altura: 667, escala: 2 }, // SE 2 e 3, 6, 7 e 8
]

// a logo sem o quadrado de fundo: só a carinha (e as definições do degradê, que não aparecem sozinhas)
const favicon = await fs.readFile(path.join(PUBLICO, 'favicon.svg'), 'utf8')
const FUNDO_DA_LOGO = /<rect[^>]*fill="url\(#g\)"[^>]*\/>/
const fundoDaLogo = favicon.match(FUNDO_DA_LOGO)?.[0]
if (!fundoDaLogo) throw new Error('não achei o fundo do favicon.svg (o <rect> com o degradê)')
const semFundo = favicon.replace(FUNDO_DA_LOGO, '')
const carinha = semFundo.slice(semFundo.indexOf('>', semFundo.indexOf('<svg')) + 1, semFundo.lastIndexOf('</svg>'))

// ícone de 512: fundo + a carinha em "tamanho" (1 = o da logo), centralizada e com o ajuste do peso (dx, dy)
function icone({ fundo, tamanho, dx = 0, dy = 0 }) {
  const ex = 256 * (1 - tamanho) + dx * tamanho
  const ey = 256 * (1 - tamanho) + dy * tamanho
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${fundo}<g transform="translate(${ex.toFixed(2)} ${ey.toFixed(2)}) scale(${tamanho})">${carinha}</g></svg>`
}

const navegador = await chromium.launch({ channel: 'chrome' }) // o mesmo Chrome dos testes (npm run e2e)
try {
  const pagina = await navegador.newPage()

  // centro de peso da parte escura, em unidades do desenho de 512 a partir do meio
  const centroDePeso = (svg) => pagina.evaluate(async (svg) => {
    const imagem = new Image()
    imagem.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
    await imagem.decode()
    const tela = document.createElement('canvas')
    tela.width = 1000
    tela.height = 1000
    const desenho = tela.getContext('2d')
    desenho.drawImage(imagem, 0, 0, 1000, 1000)
    const pontos = desenho.getImageData(0, 0, 1000, 1000).data
    let somaX = 0, somaY = 0, soma = 0
    for (let y = 0; y < 1000; y++) {
      for (let x = 0; x < 1000; x++) {
        const k = (y * 1000 + x) * 4
        const brilho = (pontos[k] + pontos[k + 1] + pontos[k + 2]) / 3
        const peso = (pontos[k + 3] / 255) * Math.max(0, Math.min(1, (120 - brilho) / 70)) // só a cor da carinha
        somaX += peso * (x + 0.5)
        somaY += peso * (y + 0.5)
        soma += peso
      }
    }
    return { x: (somaX / soma / 1000) * 512 - 256, y: (somaY / soma / 1000) * 512 - 256 }
  }, svg)

  // acha o deslocamento que põe o peso no meio (3 rodadas de ajuste bastam)
  let dx = 0, dy = 0
  for (let rodada = 0; rodada < 3; rodada++) {
    const fora = await centroDePeso(icone({ fundo: '', tamanho: 1, dx, dy }))
    dx -= fora.x
    dy -= fora.y
  }

  const salvar = async (arquivo, svg, lado) => {
    await pagina.setViewportSize({ width: lado, height: lado })
    await pagina.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${lado}px;height:${lado}px}</style>${svg}`)
    await pagina.screenshot({ path: path.join(PUBLICO, arquivo), omitBackground: true })
  }
  const quadradoLimao = `<rect width="512" height="512" fill="${LIMAO}"/>`
  const arredondadoLimao = `<rect width="512" height="512" rx="120" fill="${LIMAO}"/>`
  // Android: desenha opaco no navegador, pega os pontos e põe a beirada transparente (mantendo o verde)
  const pontosDoAndroid = await pagina.evaluate(async (svg) => {
    const imagem = new Image()
    imagem.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
    await imagem.decode()
    const tela = Object.assign(document.createElement('canvas'), { width: 512, height: 512 })
    const desenho = tela.getContext('2d')
    desenho.drawImage(imagem, 0, 0, 512, 512)
    return Array.from(desenho.getImageData(0, 0, 512, 512).data)
  }, icone({ fundo: quadradoLimao, tamanho: 0.74, dx, dy }))
  const rgba = Uint8Array.from(pontosDoAndroid)
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) rgba[(y * 512 + x) * 4 + 3] = transparenciaDaBeira(512, x, y)
  }
  await fs.writeFile(path.join(PUBLICO, 'icone-app-android-512.png'), pngComTransparencia(512, rgba))
  await salvar('apple-touch-icon.png', icone({ fundo: quadradoLimao, tamanho: 0.905, dx, dy }), 180)
  for (const lado of [192, 512]) {
    await salvar(`icone-app-${lado}.png`, icone({ fundo: arredondadoLimao, tamanho: 1, dx, dy }), lado)
    await salvar(`icon-${lado}.png`, icone({ fundo: fundoDaLogo, tamanho: 0.931, dx, dy }), lado)
  }
  // a carinha ocupa quase toda a largura (o Android desenha esse ícone bem pequeno)
  await salvar('icone-notificacao-96.png', icone({ fundo: '', tamanho: 1.08, dx, dy }).replaceAll('#2E3335', '#FFFFFF'), 96)

  await fs.mkdir(path.join(PUBLICO, 'abertura'), { recursive: true })
  const linhas = []
  for (const iphone of IPHONES) {
    const telaDoIphone = await navegador.newPage({ viewport: { width: iphone.largura, height: iphone.altura }, deviceScaleFactor: iphone.escala })
    await telaDoIphone.setContent(`<style>html,body{margin:0;height:100%;background:${DEGRADE}}</style>`)
    const arquivo = `${iphone.nome}.jpg`
    await telaDoIphone.screenshot({ path: path.join(PUBLICO, 'abertura', arquivo), type: 'jpeg', quality: 92 })
    await telaDoIphone.close()
    linhas.push(`    <link rel="apple-touch-startup-image" media="(device-width: ${iphone.largura}px) and (device-height: ${iphone.altura}px) and (-webkit-device-pixel-ratio: ${iphone.escala}) and (orientation: portrait)" href="/abertura/${arquivo}" />`)
  }

  // a carinha da tela de carregamento precisa do mesmo ajuste do peso
  const posicao = `translate(${(CARINHA_DA_TELA.x + dx).toFixed(2)} ${(CARINHA_DA_TELA.y + dy).toFixed(2)}) scale(0.575)`
  const index = await fs.readFile(INDEX, 'utf8')
  console.log(`Ícones gerados (ajuste do peso: ${dx.toFixed(2)}, ${dy.toFixed(2)}).`)
  console.log(index.includes(posicao)
    ? 'A carinha do index.html já está alinhada pelo peso.'
    : `ATENÇÃO: no index.html, troque o transform do <g> da carinha (#carregamento) por: ${posicao}`)
  console.log('\nAs linhas do index.html (abertura do iPhone):\n')
  console.log(linhas.join('\n'))
} finally {
  await navegador.close()
}
