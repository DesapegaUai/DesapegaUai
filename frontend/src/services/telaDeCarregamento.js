// Tira a tela de carregamento do app instalado (o #carregamento do index.html, com o estilo em
// src/styles/carregamento.css) quando o site já sabe se a pessoa está logada. Nunca antes de a carinha
// terminar de se desenhar (1,35 s desde que a página começou a abrir); depois disso, se ainda estiver
// carregando, a carinha continua viva. Na saída, as barras do celular voltam a ficar brancas.
// No navegador a tela nem aparece (o CSS só mostra no app), e tirar ela não muda nada.
const DESENHO_TERMINA_MS = 1350
const SAIDA_MS = 250

export function esconderTelaDeCarregamento() {
  const tela = document.getElementById('carregamento')
  if (!tela || tela.dataset.saindo) return
  tela.dataset.saindo = 'sim'
  setTimeout(() => {
    tela.classList.add('carregamento-saindo')
    document.querySelector('meta[name="theme-color"][media]')?.setAttribute('content', '#FFFFFF')
    setTimeout(() => tela.remove(), SAIDA_MS)
  }, Math.max(0, DESENHO_TERMINA_MS - performance.now()))
}
