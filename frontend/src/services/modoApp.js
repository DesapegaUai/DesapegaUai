// O site aberto como app instalado (pela tela de início do celular), e não numa aba do navegador.
// Android e computador: display-mode standalone (o mesmo valor do site.webmanifest); iPhone: navigator.standalone.
// O que muda só no app: a aba de acessibilidade fica recolhida, a abertura leva quem não está logado para a
// tela de entrar (com "Continuar sem entrar") e as barras do celular ficam brancas (theme-color no index.html).
export function emModoApp() {
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches === true || window.navigator.standalone === true
  } catch {
    return false
  }
}

// Marca a página (html.modo-app) antes da primeira tela aparecer, para o CSS do app valer desde o início.
export function marcarModoApp() {
  if (emModoApp()) document.documentElement.classList.add('modo-app')
}

// "Continuar sem entrar" vale até fechar o app (sessionStorage); na próxima abertura, a tela de entrar volta.
const CHAVE_SEM_ENTRAR = 'desapegauai-continuar-sem-entrar'

export function escolheuContinuarSemEntrar() {
  try {
    return sessionStorage.getItem(CHAVE_SEM_ENTRAR) === '1'
  } catch {
    return false
  }
}

export function lembrarContinuarSemEntrar() {
  try {
    sessionStorage.setItem(CHAVE_SEM_ENTRAR, '1')
  } catch {
    // sem sessionStorage: a tela de entrar aparece de novo na próxima abertura, e tudo bem
  }
}
