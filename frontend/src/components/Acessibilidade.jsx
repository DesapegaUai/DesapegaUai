import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './Acessibilidade.css'

// Botões de acessibilidade no canto direito de todas as telas.
// O de cima abre o menu: tamanho do texto, alto contraste, links destacados e pausar animações.
// O de baixo abre o VLibras, do Governo Federal, que traduz o conteúdo do site para Libras de graça.
// O VLibras só é baixado quando alguém clica nele: quem não usa não carrega nada a mais.

const CHAVE = 'desapegauai:acessibilidade'
// Endereço oficial do VLibras. Ele manda a maior parte dos arquivos para o jsDelivr, mas a página do
// avatar precisa vir dele mesmo: o jsDelivr entrega páginas HTML como texto e o avatar não abre.
const ENDERECO_VLIBRAS = 'https://vlibras.gov.br/app'
const TAMANHOS = [100, 110, 120, 130] // % do tamanho normal
const PADRAO = { texto: 0, contraste: false, links: false, semAnimacao: false }

// O texto maior é um zoom das telas, mas o layout continua o da largura real da tela, e cada
// layout só aguenta até uma largura mínima (medida nos testes, sem rolagem para o lado).
// O maior tamanho de texto permitido é o que ainda deixa a tela com essa largura.
function larguraMinimaDoLayout(largura) {
  if (largura <= 600) return 320 // celular
  if (largura <= 700) return 601 // celular deitado
  if (largura <= 820) return 680 // tablet estreito
  if (largura <= 1024) return 900 // tablet
  return 1025 // computador
}

function nivelMaximo() {
  const largura = window.innerWidth
  const minima = larguraMinimaDoLayout(largura)
  let maximo = 0
  TAMANHOS.forEach((tamanho, nivel) => { if (largura / (tamanho / 100) >= minima) maximo = nivel })
  return maximo
}

function lerPreferencias() {
  try {
    const salvas = JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
    return salvas && typeof salvas === 'object' ? { ...PADRAO, ...salvas } : { ...PADRAO }
  } catch {
    return { ...PADRAO }
  }
}

function salvarPreferencias(preferencias) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(preferencias))
  } catch {
    // navegador sem armazenamento (janela anônima): vale só até fechar a página
  }
}

// a escolha salva vale até o máximo que a tela de agora aguenta
const nivelDoTexto = (valor) => Math.min(Math.max(Math.trunc(Number(valor)) || 0, 0), nivelMaximo())

function aplicar(preferencias) {
  const raiz = document.documentElement
  const nivel = nivelDoTexto(preferencias.texto)
  // o site usa medidas em px, então o texto maior é um zoom das telas, como o do navegador.
  // Os botões de acessibilidade ficam fora do zoom (fora do #root) para caberem em qualquer tela.
  const telas = document.getElementById('root')
  if (telas) telas.style.zoom = nivel ? `${TAMANHOS[nivel]}%` : ''
  raiz.classList.toggle('alto-contraste', Boolean(preferencias.contraste))
  raiz.classList.toggle('destacar-links', Boolean(preferencias.links))
  raiz.classList.toggle('sem-animacao', Boolean(preferencias.semAnimacao))
}

// aplica antes da primeira tela aparecer, para o site não piscar com o visual padrão
aplicar(lerPreferencias())

let carregandoVLibras = null
function carregarVLibras() {
  if (window.VLibrasWidget?.open) return Promise.resolve(window.VLibrasWidget)
  if (!carregandoVLibras) {
    carregandoVLibras = new Promise((ok, falha) => {
      const script = document.createElement('script')
      script.src = `${ENDERECO_VLIBRAS}/vlibras-plugin.js`
      script.async = true
      script.onload = () => {
        try {
          vigiarIconesDoVLibras()
          new window.VLibras.Widget({ rootPath: ENDERECO_VLIBRAS, avatar: 'icaro', position: 'R' })
          if (window.VLibrasWidget?.open) ok(window.VLibrasWidget)
          else throw new Error('O VLibras não respondeu.')
        } catch (erro) {
          carregandoVLibras = null
          falha(erro)
        }
      }
      script.onerror = () => {
        carregandoVLibras = null
        script.remove()
        falha(new Error('Não foi possível abrir o VLibras. Confira a internet e tente de novo.'))
      }
      document.body.appendChild(script)
    })
  }
  return carregandoVLibras
}

// Safari: os ícones da barra do VLibras (fechar, menu, velocidade...) são máscaras CSS, e o Safari recusa
// o redirecionamento do vlibras.gov.br para o jsDelivr. Os ícones passam a vir direto do jsDelivr, na versão
// para a qual o vlibras.gov.br aponta hoje (os arquivos de uma versão nunca mudam).
const ICONES_DO_VLIBRAS = 'https://cdn.jsdelivr.net/gh/spbgovbr-vlibras/vlibras-portal@v7.12.3/app/assets/'

// a janela do VLibras fica num shadow DOM; o Safari escreve o endereço com barras invertidas (https\:\/\/...)
function trocarIcones(sombra) {
  for (const elemento of sombra.querySelectorAll('[style]')) {
    for (const propriedade of ['--icon', 'background-image']) {
      const valor = elemento.style.getPropertyValue(propriedade).replaceAll('\\', '')
      if (valor.includes(`${ENDERECO_VLIBRAS}/assets/`)) {
        elemento.style.setProperty(propriedade, valor.replaceAll(`${ENDERECO_VLIBRAS}/assets/`, ICONES_DO_VLIBRAS))
      }
    }
  }
}

let vigiandoIcones = false
function vigiarIconesDoVLibras() {
  if (vigiandoIcones) return
  vigiandoIcones = true
  const vigiarJanela = (janela) => {
    const sombra = janela.shadowRoot
    if (!sombra) return setTimeout(() => vigiarJanela(janela), 100)
    trocarIcones(sombra)
    new MutationObserver(() => trocarIcones(sombra)).observe(sombra, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] })
  }
  const janela = document.getElementById('vlibras-app-root')
  if (janela) return vigiarJanela(janela)
  // a janela do VLibras ainda não existe: espera ela aparecer
  const espera = new MutationObserver(() => {
    const criada = document.getElementById('vlibras-app-root')
    if (!criada) return
    espera.disconnect()
    vigiarJanela(criada)
  })
  espera.observe(document.body, { subtree: true, childList: true })
}

// o próprio VLibras lembra se ficou aberto: se a pessoa recarregar a página, ele volta aberto
function vlibrasFicouAberto() {
  try {
    return Boolean(localStorage.getItem('@vlibras-widget')?.includes('"isOpen":true'))
  } catch {
    return false
  }
}

// boneco de acessibilidade em "T" (cabeça, braços retos e pernas), o mesmo desenho usado no site da Vale;
// ícone "accessibility" do Material Icons, do Google (licença Apache 2.0)
function IconeAcessibilidade() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z" />
    </svg>
  )
}

// as duas mãos fazendo sinal, com os tracinhos de movimento: o ícone oficial do botão do VLibras
// (Governo Federal), o mesmo do site da Vale. Só o desenho das mãos, sem o quadrado azul do fundo.
function IconeLibras() {
  return (
    <svg viewBox="5 5 30 30" width="32" height="32" aria-hidden="true" focusable="false" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M14.35 8a1 1 0 0 0-.38.24c-.22.21-.22.21-.17.72l.11 1.35c.3 3.62.34 4.7.21 4.78-.21.14-.33-.06-2.35-3.97-.69-1.33-.82-1.48-1.24-1.34-.68.23-.63.57.45 2.9l.26.58c0 .01.12.3.27.61.8 1.76 1.01 2.47.75 2.57-.18.07-.51-.1-.78-.42-.14-.16-.3-.36-.38-.43a19 19 0 0 1-.78-.95l-.72-.86a7 7 0 0 0-.8-.86c-.34-.13-.8.13-.8.46 0 .29.7 1.44 2.13 3.56.9 1.33 1.11 1.8 1.32 2.97q.64 3.7 1.78 4.6c.51.4.53.4 1.75.35l1.11-.04.85-1.14.93-1.23c.33-.43 1.17-1.92 1.17-2.07 0-.02-.44-.02-.97 0q-.98.05-1.43-.04c-.52-.1-1.18-.4-1.55-.7a1.55 1.55 0 0 1-.38-1.94c.27-.45.64-.65 1.41-.74.63-.08 1.3-.26 2.27-.62l.51-.19v-.82c0-.84.16-3.78.29-5.16.1-1.09.1-1.08-.17-1.34-.19-.19-.3-.24-.5-.24-.5 0-.52.07-1.02 2.57l-.54 2.8c-.12.68-.21.93-.37 1-.2.07-.39-.25-.48-.82l-.27-1.68c-.19-1.19-.56-3.4-.64-3.8-.05-.24-.36-.6-.57-.65a1 1 0 0 0-.28 0m9.37 7.25a14 14 0 0 0-2.12.8l-1.31.62c-1.49.74-3.2 1.34-3.8 1.34-.4 0-.84.18-.88.37-.04.2.4.6.82.76.38.15.48.15 1.83.11 1.22-.03 1.47-.02 1.67.07.33.16.42.43.31.93-.11.51-.74 1.77-1.25 2.5-.33.48-2.29 3.1-3.43 4.57-.4.53-.42.8-.07 1.15.45.45.39.49 2.8-1.94 2.26-2.27 2.45-2.42 2.55-2.01.07.24.08.2-.92 2.35a16 16 0 0 0-.57 1.25c-1.15 2.49-1.2 2.65-.86 3.08.12.15.2.18.47.18.18 0 .38-.04.44-.09s.4-.62.77-1.28c.63-1.15 1-1.82 1.32-2.37 1.17-2.04 1.16-2.03 1.38-2.03.13 0 .13.03.1.86-.05.76-.14 1.66-.4 3.75-.1.79-.1 1.45.02 1.6.14.19.63.24.85.1.23-.15.33-.53.6-2.12.55-3.38.7-4.02.91-4.22.14-.13.15-.13.3 0 .07.08.17.19.2.26.04.06.15.85.24 1.76.27 2.53.29 2.66.5 2.85q.35.3.7 0c.2-.17.2-.21.26-1.12.04-.52.05-1.54.03-2.28-.03-1.43.04-2.63.17-3.04l.49-1.21c.22-.52.54-1.36.7-1.87.5-1.55.47-2.8-.1-3.36a5 5 0 0 0-.8-.54 6 6 0 0 1-1.32-1c-.57-.54-.78-.68-1.04-.75a6 6 0 0 0-1.56-.03m5.5 2.06c-.04.08.02.32.12.58.23.58.28 1.1.18 1.78-.13.88-.12.98.06 1 .24.04.36-.24.45-1 .1-.85.01-1.49-.28-2.08-.2-.42-.45-.55-.54-.28m1.27.24c-.02.05.03.3.1.54.19.58.15 1.5-.08 2.2-.15.43-.15.48-.05.59.24.24.49-.1.65-.88a4 4 0 0 0-.17-2.4c-.1-.17-.4-.2-.45-.05m-19.45 6.03c-.14.15-.1.35.2.9.52.94 1.77 2.01 2.06 1.77.21-.17.13-.33-.3-.6a4 4 0 0 1-1.38-1.56c-.29-.55-.42-.67-.58-.5m-1 .45c-.11.13-.02.46.3 1.12.45.91 1.41 1.84 1.77 1.7.18-.07.14-.35-.09-.48a4 4 0 0 1-1.45-1.99q-.25-.68-.53-.35" />
    </svg>
  )
}

function Opcao({ ligado, onClick, titulo, texto }) {
  return (
    <button type="button" className="acs-opcao" aria-pressed={ligado} onClick={onClick}>
      <span className="acs-opcao-texto">
        <b>{titulo}</b>
        <small>{texto}</small>
      </span>
      <span className="acs-chave" aria-hidden="true" />
    </button>
  )
}

export default function Acessibilidade() {
  const [preferencias, setPreferencias] = useState(lerPreferencias)
  const [aberto, setAberto] = useState(false)
  const [abrindoLibras, setAbrindoLibras] = useState(false)
  const [erroLibras, setErroLibras] = useState('')
  const [maximo, setMaximo] = useState(nivelMaximo)
  const painel = useRef(null)
  const botaoMenu = useRef(null)

  useEffect(() => {
    aplicar(preferencias)
    salvarPreferencias(preferencias)
  }, [preferencias])

  // girar o celular ou mudar o tamanho da janela muda o tamanho máximo do texto
  useEffect(() => {
    const aoMudarTela = () => {
      setMaximo(nivelMaximo())
      aplicar(lerPreferencias())
    }
    window.addEventListener('resize', aoMudarTela)
    return () => window.removeEventListener('resize', aoMudarTela)
  }, [])

  useEffect(() => {
    if (vlibrasFicouAberto()) carregarVLibras().catch(() => {})
  }, [])

  const fechar = useCallback((devolverFoco = true) => {
    setAberto(false)
    if (devolverFoco) botaoMenu.current?.focus()
  }, [])

  // Esc fecha; clicar fora também
  useEffect(() => {
    if (!aberto) return undefined
    painel.current?.querySelector('button')?.focus()
    const aoTeclar = (e) => { if (e.key === 'Escape') fechar() }
    const aoClicar = (e) => {
      if (!painel.current?.contains(e.target) && !botaoMenu.current?.contains(e.target)) fechar(false)
    }
    document.addEventListener('keydown', aoTeclar)
    document.addEventListener('pointerdown', aoClicar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('pointerdown', aoClicar)
    }
  }, [aberto, fechar])

  const mudar = (campo, valor) => setPreferencias((atual) => ({ ...atual, [campo]: valor }))
  const nivel = Math.min(nivelDoTexto(preferencias.texto), maximo)
  const mudouAlgo = JSON.stringify({ ...PADRAO, ...preferencias }) !== JSON.stringify(PADRAO)

  async function abrirLibras() {
    setErroLibras('')
    setAbrindoLibras(true)
    try {
      const vlibras = await carregarVLibras()
      vlibras.open()
      setAberto(false)
    } catch (erro) {
      setErroLibras(erro.message)
      setAberto(true)
    } finally {
      setAbrindoLibras(false)
    }
  }

  return createPortal(
    <>
      <div className="acs-aba">
        <button
          ref={botaoMenu}
          type="button"
          className="acs-botao"
          aria-label="Acessibilidade"
          title="Acessibilidade"
          aria-expanded={aberto}
          aria-controls="acs-painel"
          onClick={() => (aberto ? fechar() : setAberto(true))}
        >
          <IconeAcessibilidade />
        </button>
        <button
          type="button"
          className="acs-botao"
          aria-label="Traduzir para Libras com o VLibras"
          title="Libras (VLibras)"
          aria-busy={abrindoLibras}
          onClick={abrirLibras}
        >
          <IconeLibras />
        </button>
      </div>

      {aberto && (
        <div ref={painel} id="acs-painel" className="acs-painel" role="dialog" aria-labelledby="acs-titulo">
          <div className="acs-topo">
            <h2 id="acs-titulo">Acessibilidade</h2>
            <button type="button" className="acs-fechar" aria-label="Fechar" onClick={() => fechar()}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>

          <div className="acs-texto">
            <span id="acs-texto-rotulo">Tamanho do texto</span>
            <div className="acs-texto-botoes" role="group" aria-labelledby="acs-texto-rotulo">
              <button type="button" aria-label="Diminuir o texto" disabled={nivel === 0} onClick={() => mudar('texto', nivel - 1)}>A-</button>
              <output aria-live="polite">{TAMANHOS[nivel]}%</output>
              <button type="button" aria-label="Aumentar o texto" disabled={nivel >= maximo} onClick={() => mudar('texto', nivel + 1)}>A+</button>
            </div>
          </div>
          {maximo === 0 && <p className="acs-dica">Nesta tela, o texto já está no maior tamanho que cabe. Para ampliar mais, use o zoom do aparelho.</p>}

          <Opcao ligado={preferencias.contraste} onClick={() => mudar('contraste', !preferencias.contraste)} titulo="Alto contraste" texto="Textos e bordas mais escuros" />
          <Opcao ligado={preferencias.links} onClick={() => mudar('links', !preferencias.links)} titulo="Destacar links" texto="Links sublinhados e foco bem visível" />
          <Opcao ligado={preferencias.semAnimacao} onClick={() => mudar('semAnimacao', !preferencias.semAnimacao)} titulo="Pausar animações" texto="Sem movimento e sem troca automática de cards" />

          <button type="button" className="acs-libras" onClick={abrirLibras} disabled={abrindoLibras}>
            <IconeLibras />
            {abrindoLibras ? 'Abrindo o VLibras…' : 'Traduzir para Libras (VLibras)'}
          </button>
          {erroLibras && <p className="acs-erro" role="alert">{erroLibras}</p>}

          <button type="button" className="acs-restaurar" disabled={!mudouAlgo} onClick={() => setPreferencias({ ...PADRAO })}>
            Voltar ao padrão
          </button>
        </div>
      )}
    </>,
    document.body,
  )
}
