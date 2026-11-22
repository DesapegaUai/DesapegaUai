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

function IconeAcessibilidade() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false">
      <circle cx="12" cy="3.6" r="2.3" fill="currentColor" />
      <path d="M3.2 7.6c-.7-.2-1.3.3-1.4 1-.1.6.3 1.1.9 1.3l5.6 1.4c.5.1.9.6.9 1.1v2.3l-1.9 6.9c-.2.7.2 1.4.9 1.6.7.2 1.4-.2 1.6-.9L12 16.4l2.2 6.9c.2.7.9 1.1 1.6.9.7-.2 1.1-.9.9-1.6l-1.9-6.9v-2.3c0-.5.4-1 .9-1.1l5.6-1.4c.6-.2 1-.7.9-1.3-.1-.7-.7-1.2-1.4-1L12 9.7Z" fill="currentColor" />
    </svg>
  )
}

// ícone "sign_language" do Material Symbols, do Google (licença Apache 2.0): duas mãos fazendo um sinal
function IconeLibras() {
  return (
    <svg viewBox="0 -960 960 960" width="30" height="30" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M456-39 101-72q-13-2-21-11.5T74-105q1-13 10.5-21t22.5-6l160 14 25-90-228-45q-12-2-19-12.5T40-288q2-12 12.5-19t22.5-5l234 46 23-82-266-74q-12-3-18-14t-3-23q3-12 14-18t23-3l266 74 22-79-182-95q-11-6-15-18t2-23q6-11 18-14.5t23 2.5l255 133 4-89q1-15 8-28t18-22q9-8 20-11t21-2q10 1 18 6t12 15l93 217q8 17 9 36t-4 38l-53 189q-15 54-60 85.5T456-39Zm249-280q5-19 9.5-38.5T711-395L603-646l69-28-84-204q-5-11 0-22.5t16-16.5q11-5 22.5-.5T643-901l110 266 60-66q10-11 23.5-16t27.5-4q12 1 22.5 5t18.5 12q8 8 10.5 17t-.5 19l-68 224q-5 18-16 33t-27 26l-99 66ZM499-682 393-836q-7-11-5-22.5t13-18.5q10-8 22-6t19 13l128 185q-17-6-35.5-5.5T499-682Zm-65 117-57-29-95-113q-8-10-7-22t11-20q10-8 22-7t20 11l110 132q-3 12-3.5 24t-.5 24Z" />
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
