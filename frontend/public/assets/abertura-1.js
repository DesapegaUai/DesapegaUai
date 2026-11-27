// Abertura do app no Android: o próprio Android mostra a carinha (o ícone do app) no verde-limão enquanto o
// site carrega. Quando o app acabou de ser aberto, a tela de carregamento (src/styles/carregamento.css) começa
// com a mesma carinha, pronta e no mesmo lugar, e ela só ganha vida, sem sumir e se desenhar de novo.
// Recarregar o app, iPhone e computador: a carinha se desenha.
// Roda antes de a página aparecer (por isso é um arquivo à parte, sem esperar o resto do site). Fica em
// assets/ com o número da versão no nome, e o celular guarda por 1 ano: mudou? Troque o número aqui no nome
// do arquivo e no index.html.
(() => {
  try {
    const navegacao = performance.getEntriesByType?.('navigation')[0]
    const abriuAgora = !navegacao || navegacao.type === 'navigate'
    if (abriuAgora && /Android/i.test(navigator.userAgent) && matchMedia('(display-mode: standalone)').matches) {
      document.documentElement.classList.add('carinha-pronta')
    }
  } catch {
    // sem isso, a carinha só se desenha, como no iPhone
  }
})()
