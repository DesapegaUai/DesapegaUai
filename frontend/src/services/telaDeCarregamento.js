// Tira a tela de carregamento do app instalado (o #carregamento do index.html, com o estilo em
// src/styles/carregamento.css) quando o site já sabe se a pessoa está logada. Nunca antes de a carinha
// terminar de se desenhar; depois disso, se ainda estiver carregando, a carinha continua viva. Na saída,
// as barras do celular voltam a ficar brancas.
// No navegador a tela nem aparece (o CSS só mostra no app), e tirar ela não muda nada.
const SAIDA_MS = 250

// Espera o fim do desenho pela própria animação (o último brilho é a última peça a aparecer). O tempo conta
// de quando a carinha começou a se desenhar na tela, e não de quando o celular começou a abrir o site: no app
// do Android, a abertura do sistema fica na frente enquanto a página baixa, e contar desde lá fazia a carinha
// só piscar. Sem animação (movimento reduzido), não há o que esperar.
function desenhoTerminou(tela) {
  const ultimoBrilho = tela.querySelector('.cg-b3')
  const desenho = ultimoBrilho?.getAnimations?.().find((animacao) => animacao.animationName === 'cg-surgir')
  return desenho ? desenho.finished.catch(() => {}) : Promise.resolve()
}

// Android, app acabou de abrir (html.carinha-pronta): a carinha já chega pronta da abertura do Android e só
// ganha vida. Fica até ela sorrir uma vez (o primeiro sorriso termina em 1,7 s), para dar tempo de ver.
const PRIMEIRO_SORRISO_MS = 1700

function sorriuUmaVez(tela) {
  const sorriso = tela.querySelector('.cg-sorriso')?.getAnimations?.().find((animacao) => animacao.animationName === 'cg-sorrir')
  const falta = sorriso ? Math.max(0, PRIMEIRO_SORRISO_MS - Number(sorriso.currentTime ?? 0)) : 0
  return new Promise((pronto) => setTimeout(pronto, falta))
}

export function esconderTelaDeCarregamento() {
  const tela = document.getElementById('carregamento')
  if (!tela || tela.dataset.saindo) return
  tela.dataset.saindo = 'sim'
  const pronta = document.documentElement.classList.contains('carinha-pronta')
  const esperar = pronta ? sorriuUmaVez(tela) : desenhoTerminou(tela)
  esperar.then(() => {
    tela.classList.add('carregamento-saindo')
    document.querySelector('meta[name="theme-color"][media]')?.setAttribute('content', '#FFFFFF')
    setTimeout(() => tela.remove(), SAIDA_MS)
  })
}
