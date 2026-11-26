// Gera as imagens paradas da abertura do app instalado. Rodar de novo se a carinha ou as cores mudarem:
//   node scripts/gerar-telas-de-abertura.mjs        (na pasta frontend)
//
// - public/icone-app-192.png e icone-app-512.png: a carinha num quadrado verde-limão liso (#C6FE32).
//   O Android desenha a primeira tela do app com esse ícone no centro, em cima do background_color do
//   site.webmanifest (o mesmo #C6FE32): o quadrado some e fica só a carinha no verde-limão.
//   (Os icon-192/512 de antes continuam iguais: são os da notificação push e do logo para o Google.)
// - public/abertura/*.jpg: a primeira tela do iPhone, uma por tamanho de tela, só com o degradê. Assim a
//   carinha começa a se desenhar na tela de carregamento (src/styles/carregamento.css) sem pulo. Em JPEG de alta
//   qualidade: o degradê em PNG ficava com uns 350 KB por tela.
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const PUBLICO = path.join(import.meta.dirname, '..', 'public')
const DEGRADE = 'linear-gradient(160deg, #E9FDB0 0%, #D4FE6E 35%, #C6FE32 55%, #98FD49 85%, #83FC55 100%)'

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

// a carinha do favicon.svg, trocando o degradê do quadrado pelo verde-limão liso
const favicon = await fs.readFile(path.join(PUBLICO, 'favicon.svg'), 'utf8')
const iconeLiso = favicon.replace('fill="url(#g)"', 'fill="#C6FE32"')
if (iconeLiso === favicon) throw new Error('não achei o fundo do favicon.svg para trocar a cor')

const navegador = await chromium.launch({ channel: 'chrome' }) // o mesmo Chrome dos testes (npm run e2e)
try {
  for (const tamanho of [192, 512]) {
    const pagina = await navegador.newPage({ viewport: { width: tamanho, height: tamanho } })
    await pagina.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${tamanho}px;height:${tamanho}px}</style>${iconeLiso}`)
    await pagina.screenshot({ path: path.join(PUBLICO, `icone-app-${tamanho}.png`), omitBackground: true })
    await pagina.close()
  }

  await fs.mkdir(path.join(PUBLICO, 'abertura'), { recursive: true })
  const linhas = []
  for (const iphone of IPHONES) {
    const pagina = await navegador.newPage({ viewport: { width: iphone.largura, height: iphone.altura }, deviceScaleFactor: iphone.escala })
    await pagina.setContent(`<style>html,body{margin:0;height:100%;background:${DEGRADE}}</style>`)
    const arquivo = `${iphone.nome}.jpg`
    await pagina.screenshot({ path: path.join(PUBLICO, 'abertura', arquivo), type: 'jpeg', quality: 92 })
    await pagina.close()
    linhas.push(`    <link rel="apple-touch-startup-image" media="(device-width: ${iphone.largura}px) and (device-height: ${iphone.altura}px) and (-webkit-device-pixel-ratio: ${iphone.escala}) and (orientation: portrait)" href="/abertura/${arquivo}" />`)
  }
  console.log('Imagens geradas. As linhas do index.html (abertura do iPhone):\n')
  console.log(linhas.join('\n'))
} finally {
  await navegador.close()
}
