import { useEffect, useState } from 'react'
import brilho1 from '../assets/logo-animado/brilho-1.svg'
import brilho2 from '../assets/logo-animado/brilho-2.svg'
import brilho3 from '../assets/logo-animado/brilho-3.svg'
import palavra from '../assets/logo-animado/palavra-escura.svg'
import './LogoAnimado.css'

// Logo com a animação do pingo do i, feita a partir da pasta 15-animacao-logo do design.
//
// Como funciona:
// 1. O letreiro "DesapegaUai" aparece subindo, ainda sem o pingo do i.
// 2. Uma bolinha cai e vai pulando de letra em letra.
//    Ela começa preta e fica verde quando chega no "Uai".
// 3. A bolinha pousa em cima do i e vira o pingo, com um balancinho.
// 4. Os 3 risquinhos de brilho aparecem um de cada vez.
//
// A animação toca uma vez quando a tela abre. Depois o logo fica parado.
//
// Todos os números de posição usam a mesma medida do arquivo da designer:
// o logo tem 1221 de largura por 261 de altura.
// Como é SVG, ele aumenta e diminui junto com a tela sem perder a qualidade.

const LARGURA = 1221
const ALTURA = 261

// Em que segundo começa cada parte da animação
const CENAS = { pulos: 0.9, pingo: 3.7, brilhos: 4.7 }
const POUSO = CENAS.pingo + 0.55 // momento em que a bolinha encosta no i
const FIM = CENAS.brilhos + 0.24 + 0.4 // quando o último brilho termina, a animação acaba

const R = 13.5 // tamanho (raio) da bolinha
const PINGO = { x: 1136, y: 55 } // lugar final da bolinha, em cima do i
const INICIO = { x: -120, y: -420 } // de onde ela cai, um pouco acima do logo

// Os pontos onde a bolinha encosta, na ordem: D, s, p, g, U, a.
// x é a posição na horizontal e top é a altura do topo de cada letra.
const PULOS = [
  { x: 65, top: 41 },
  { x: 282, top: 80 },
  { x: 495, top: 80 },
  { x: 700, top: 80 },
  { x: 893, top: 40 },
  { x: 1050, top: 78 },
]
// Cada brilho cresce a partir do ponto "origem" (o lado que fica perto do pingo).
// O "em" é o segundo em que ele começa a aparecer.
const BRILHOS = [
  { src: brilho1, origem: [1158, 42], em: CENAS.brilhos },
  { src: brilho2, origem: [1172, 50], em: CENAS.brilhos + 0.12 },
  { src: brilho3, origem: [1173, 75], em: CENAS.brilhos + 0.24 },
]

// As cores ficam em RGB porque a bolinha vai misturando uma na outra aos poucos
const COR_ESCURA = [27, 29, 24] // #1B1D18, a mesma cor do "Desapega"
const COR_LIMA = [130, 192, 58] // #82C03A, a mesma cor do "Uai"

// Não deixa o valor passar do mínimo nem do máximo
const limitar = (v, min, max) => Math.max(min, Math.min(max, v))

// Diz quanto de uma parte da animação já passou: 0 é o começo e 1 é o fim
const trecho = (T, a, b) => limitar((T - a) / (b - a), 0, 1)

// Curvas de movimento. Elas deixam o movimento mais natural do que andar sempre na mesma velocidade.
// suave: começa rápido e vai freando (no design se chama easeOutCubic)
const suave = (t) => 1 - Math.pow(1 - t, 3)
// comPulo: passa um pouquinho do tamanho final e volta, como uma mola (easeOutBack)
const comPulo = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2)

// Monta o caminho da bolinha: primeiro uma queda,
// depois um arco de uma letra até a outra, como uma bola quicando.
const TRAJETO = (() => {
  const pontos = [INICIO, ...PULOS.map((p) => ({ x: p.x, y: p.top - R })), PINGO]
  const primeiro = 0.5
  const pulo = (CENAS.pingo - CENAS.pulos - primeiro) / (PULOS.length - 1) // cada pulo dura 0,46 segundo
  const partes = []
  let t = CENAS.pulos
  for (let i = 0; i < pontos.length - 1; i++) {
    const ultimo = i === pontos.length - 2
    const dur = i === 0 ? primeiro : ultimo ? POUSO - t : pulo
    const a = pontos[i]
    const b = pontos[i + 1]
    const pico = Math.min(a.y, b.y) - (ultimo ? 150 : 110)
    partes.push({ a, b, pico, inicio: t, fim: t + dur, queda: i === 0 })
    t += dur
  }
  return partes
})()

// Cada vez que a bolinha encosta numa letra aparece uma ondinha verde.
// Aqui ficam o momento e o lugar de cada toque, incluindo o pouso no i.
const TOQUES = [
  ...TRAJETO.slice(0, -1).map((p) => ({ em: p.fim, x: p.b.x, y: p.b.y + R })),
  { em: POUSO, x: PINGO.x, y: PINGO.y + R },
]

// Calcula onde a bolinha está no segundo T e o quanto ela está esticada ou achatada.
// sx é a largura e sy é a altura (1 é o tamanho normal).
function bolinhaEm(T) {
  for (const p of TRAJETO) {
    if (T > p.fim) continue
    const u = trecho(T, p.inicio, p.fim)
    const x = p.a.x + (p.b.x - p.a.x) * u
    let y
    if (p.queda) {
      y = p.a.y + (p.b.y - p.a.y) * u * u
    } else {
      const altura = Math.min(p.a.y, p.b.y) - p.pico
      y = (1 - u) * p.a.y + u * p.b.y - 4 * altura * u * (1 - u)
    }
    // No ar a bolinha estica um pouco. Quando encosta na letra, ela achata.
    const ar = limitar(Math.min(u, 1 - u) / 0.18, 0, 1)
    const contato = 1 - ar
    if (contato > 0.7) {
      const c = (contato - 0.7) / 0.3
      return { x, y, sx: 1 + 0.28 * c, sy: 1 - 0.28 * c }
    }
    return { x, y, sx: 1 - 0.08 * ar, sy: 1 + 0.12 * ar }
  }
  // Depois de pousar no i, ela balança um pouco e para
  const u = trecho(T, POUSO, POUSO + 0.45)
  const balanco = Math.sin(u * Math.PI * 2.5) * (1 - u)
  return { ...PINGO, sx: 1 + 0.3 * balanco, sy: 1 - 0.3 * balanco }
}

// A cor muda de preto para verde enquanto a bolinha passa do "g" para o "U"
function corDaBolinha(x, sempreVerde) {
  const mistura = sempreVerde ? 1 : limitar((x - 850) / 43, 0, 1)
  const [r, g, b] = COR_ESCURA.map((c, i) => Math.round(c + (COR_LIMA[i] - c) * mistura))
  return `rgb(${r}, ${g}, ${b})`
}

// Algumas pessoas ligam a opção "reduzir movimento" no celular ou no computador
// porque animação dá enjoo ou tontura nelas. Aqui a gente confere essa opção.
function querMenosMovimento() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// O design tem duas versões da bolinha:
// <LogoAnimado /> usa a versão A, que começa preta e fica verde (é a que está na tela)
// <LogoAnimado bolinha="verde" /> usa a versão B, que é verde o tempo todo
export default function LogoAnimado({ bolinha = 'preta-verde', className = '' }) {
  // Se a pessoa ligou "reduzir movimento", o logo já aparece pronto, sem animação
  const [semAnimacao] = useState(querMenosMovimento)
  // T é o tempo da animação em segundos. Cada vez que ele muda, o desenho é atualizado.
  const [T, setT] = useState(() => (semAnimacao ? FIM : 0))

  useEffect(() => {
    if (semAnimacao) return
    let cancelado = false
    let quadro

    // Espera as imagens do logo carregarem para a animação não começar pela metade.
    // Se demorar mais de 1,5 segundo, começa assim mesmo.
    const camadas = [palavra, ...BRILHOS.map((b) => b.src)].map((src) => {
      const img = new Image()
      img.src = src
      return img.decode().catch(() => {})
    })
    const limite = new Promise((resolve) => setTimeout(resolve, 1500))

    Promise.race([Promise.all(camadas), limite]).then(() => {
      if (cancelado) return
      // requestAnimationFrame pede para o navegador chamar "passo" antes de desenhar cada quadro
      // da tela (umas 60 vezes por segundo). A cada quadro o tempo T avança.
      const comeco = performance.now()
      const passo = (agora) => {
        const t = (agora - comeco) / 1000
        setT(Math.min(t, FIM))
        if (t < FIM) quadro = requestAnimationFrame(passo)
      }
      quadro = requestAnimationFrame(passo)
    })

    return () => {
      cancelado = true
      cancelAnimationFrame(quadro)
    }
  }, [semAnimacao])

  const entrada = suave(trecho(T, 0, 0.8))
  const bola = bolinhaEm(T)
  const bolaVisivel = trecho(T, CENAS.pulos, CENAS.pulos + 0.15) // a bolinha aparece logo no começo da queda
  const base = bola.y + R // a bolinha achata a partir de baixo, como uma bola de verdade

  return (
    <svg
      className={`logo-animado ${className}`.trim()}
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      role="img"
      aria-label="DesapegaUai"
    >
      {/* Letreiro "DesapegaUai" sem o pingo do i. Ele sobe e aparece no começo. */}
      <image
        href={palavra}
        width={LARGURA}
        height={ALTURA}
        opacity={entrada}
        transform={`translate(0 ${(1 - entrada) * 35})`}
      />

      {/* Ondinhas que aparecem quando a bolinha encosta nas letras */}
      {TOQUES.map((toque, i) => {
        const u = trecho(T, toque.em, toque.em + 0.35)
        if (u <= 0 || u >= 1) return null
        const raio = R + 6 + 30 * suave(u)
        return (
          <ellipse
            key={i}
            cx={toque.x}
            cy={toque.y}
            rx={raio}
            ry={raio * 0.35}
            fill="none"
            stroke={`rgba(130, 192, 58, ${0.8 * (1 - u)})`}
            strokeWidth={2 * (1 - u)}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}

      {/* A bolinha. No final ela é o pingo do i. */}
      <circle
        cx={bola.x}
        cy={bola.y}
        r={R}
        fill={corDaBolinha(bola.x, bolinha === 'verde')}
        opacity={bolaVisivel}
        transform={`translate(${bola.x} ${base}) scale(${bola.sx} ${bola.sy}) translate(${-bola.x} ${-base})`}
      />

      {/* Os 3 brilhos saem do pingo, um de cada vez.
          Cada um cresce do zero até o tamanho normal, com o efeito de mola. */}
      {BRILHOS.map(({ src, origem: [ox, oy], em }) => {
        const u = trecho(T, em, em + 0.4)
        if (u <= 0) return null
        const escala = Math.max(0, comPulo(u))
        return (
          <image
            key={src}
            href={src}
            width={LARGURA}
            height={ALTURA}
            transform={`translate(${ox} ${oy}) scale(${escala}) translate(${-ox} ${-oy})`}
          />
        )
      })}
    </svg>
  )
}
