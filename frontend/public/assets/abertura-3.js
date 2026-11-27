// Tela de carregamento do app (o #carregamento do index.html, estilo em src/styles/carregamento.css).
// Só aparece quando o app é aberto. Recarregar a página (puxar a tela para baixo) ou voltar não é abrir o
// app: aí o site abre direto, sem a carinha (html.sem-carregamento).
//
// Abertura do app no Android: o próprio Android mostra a carinha (o ícone do app) no verde-limão enquanto o
// site carrega. A tela de carregamento começa com a mesma carinha, pronta e no mesmo lugar, e ela só ganha
// vida, sem sumir e se desenhar de novo (html.carinha-pronta). iPhone e computador: a carinha se desenha.
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
    const html = document.documentElement
    const navegacao = performance.getEntriesByType?.('navigation')[0]
    if (navegacao && navegacao.type !== 'navigate') {
      html.classList.add('sem-carregamento')
      return
    }
    if (/Android/i.test(navigator.userAgent) && matchMedia('(display-mode: standalone)').matches) {
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
