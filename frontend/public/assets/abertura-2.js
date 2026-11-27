// Abertura do app no Android: o próprio Android mostra a carinha (o ícone do app) no verde-limão enquanto o
// site carrega. Quando o app acabou de ser aberto, a tela de carregamento (src/styles/carregamento.css) começa
// com a mesma carinha, pronta e no mesmo lugar, e ela só ganha vida, sem sumir e se desenhar de novo.
// Recarregar o app, iPhone e computador: a carinha se desenha.
//
// "No mesmo lugar": o Android centraliza a carinha na tela inteira, e o site fica entre a barra de cima
// (status) e a de baixo (gestos). A barra de cima é maior, então a carinha do Android fica mais alta pela
// metade da diferença entre as duas. A de baixo, com navegação por gestos, tem uns 26 px (medido no celular).
// --carinha-sobe leva essa diferença para o CSS.
//
// Roda antes de a página aparecer (por isso é um arquivo à parte, sem esperar o resto do site). Fica em
// assets/ com o número da versão no nome, e o celular guarda por 1 ano: mudou? Troque o número aqui no nome
// do arquivo e no index.html.
(() => {
  try {
    const navegacao = performance.getEntriesByType?.('navigation')[0]
    const abriuAgora = !navegacao || navegacao.type === 'navigate'
    if (abriuAgora && /Android/i.test(navigator.userAgent) && matchMedia('(display-mode: standalone)').matches) {
      const html = document.documentElement
      html.classList.add('carinha-pronta')
      const barras = screen.height - innerHeight // a de cima mais a de baixo
      if (barras >= 40 && barras <= 120) {
        const sobe = Math.min(20, Math.max(0, barras / 2 - 26))
        html.style.setProperty('--carinha-sobe', `${sobe.toFixed(1)}px`)
      }
    }
  } catch {
    // sem isso, a carinha só se desenha, como no iPhone
  }
})()
