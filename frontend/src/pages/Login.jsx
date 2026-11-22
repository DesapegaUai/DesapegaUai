import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import LogoAnimado from '../components/LogoAnimado.jsx'
import Toast from '../components/Toast.jsx'
import { api } from '../services/api.js'
import { entrou } from '../services/sessao.js'
import './Login.css'

// Tela de login. O visual segue o protótipo 00-login.html da pasta de design.
// Hoje a API só faz login com o Google. Os campos de e-mail e senha, o "Esqueceu a senha?",
// o botão da Apple e o "Criar conta" continuam na tela porque fazem parte do design,
// mas por enquanto eles só mostram um aviso.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// Textos que aparecem na tela. Ficam todos juntos aqui para ser fácil de mudar.
// MSG são os erros, que aparecem embaixo do formulário.
const MSG = {
  email: 'Digite um e-mail válido.',
  senha: 'Digite sua senha.',
  termos: 'Para continuar, aceite os Termos de uso e a Política de privacidade.',
  googleSemChave: 'O botão do Google precisa do VITE_GOOGLE_CLIENT_ID no arquivo .env. Depois de preencher, reinicie o npm run dev.',
  googleFora: 'Entrar com o Google está indisponível no momento. Tente de novo daqui a pouco.',
}

// AVISO são os avisos rápidos (toast) que aparecem no alto da tela e somem sozinhos.
const AVISO = {
  emailEmBreve: { tipo: 'info', titulo: 'Login com e-mail em breve', texto: 'Por enquanto, entre com o Google.' },
  senhaEmBreve: {
    tipo: 'info',
    titulo: 'Recuperação de senha em breve',
    texto: 'Ela chega junto com o login por e-mail. Por enquanto, entre com o Google.',
  },
  appleEmBreve: { tipo: 'info', titulo: 'Login com a Apple em breve', texto: 'Por enquanto, entre com o Google.' },
  criarConta: {
    tipo: 'info',
    titulo: 'Crie sua conta com o Google',
    texto: 'É só entrar com o Google: sua conta é criada no primeiro acesso.',
  },
  saiu: { tipo: 'sucesso', titulo: 'Você saiu da sua conta' },
}

// Coloca o script do Google na página.
// A variável scriptGoogle guarda o carregamento para o script não ser colocado duas vezes.
// Em desenvolvimento o React roda os efeitos duas vezes de propósito (é o StrictMode),
// então sem esse cuidado o script seria carregado em dobro.
let scriptGoogle = null
function carregarGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!scriptGoogle) {
    scriptGoogle = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = resolve
      script.onerror = () => {
        script.remove()
        scriptGoogle = null // se deu erro, deixa tentar de novo depois
        reject(new Error('Não foi possível carregar o login do Google. Confira sua internet.'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptGoogle
}

// O Google só deixa chamar o initialize() uma vez por página.
// Por isso ele é chamado uma vez só, e a resposta do Google vai para a função
// guardada em repassarCredencial, que é a da tela de login aberta no momento.
let repassarCredencial = null
let googleIniciado = false
function iniciarGoogle() {
  if (googleIniciado) return
  googleIniciado = true
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (resposta) => repassarCredencial?.(resposta),
  })
}

export default function Login() {
  const location = useLocation()
  // depois de entrar, a pessoa vai sempre para a tela inicial (Home)
  const navegar = useNavigate()
  const [entrando, setEntrando] = useState(false) // entrou e está indo para a Home
  const [verificando, setVerificando] = useState(true)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [aceitou, setAceitou] = useState(false)
  const [erro, setErro] = useState(null) // erro que aparece embaixo do formulário: { texto, campo }
  const [toast, setToast] = useState(() => (location.state?.saiu ? { ...AVISO.saiu, chave: 1 } : null)) // aviso rápido no meio da tela, que some sozinho: { texto, chave }
  const [carregando, setCarregando] = useState(false)
  const [erroGoogle, setErroGoogle] = useState('')

  // Os refs servem para colocar o cursor no campo que está com erro
  // e para saber em qual div o Google deve desenhar o botão dele.
  const emailRef = useRef(null)
  const senhaRef = useRef(null)
  const termosRef = useRef(null)
  const googleRef = useRef(null)

  const mostrarFormulario = !verificando && !entrando

  // Mostra um aviso rápido no alto da tela (veja src/components/Toast.jsx).
  // A chave muda a cada aviso, assim a animação recomeça mesmo se o aviso for igual ao anterior.
  function avisar(aviso) {
    setErro(null)
    setToast({ ...aviso, chave: Date.now() })
  }

  function mostrarErro(texto, campo = null) {
    setErro({ texto, campo })
    const campos = { email: emailRef, senha: senhaRef, termos: termosRef }
    campos[campo]?.current?.focus()
  }

  // Quando a pessoa corrige o campo que estava com erro, o aviso some
  function limparErroDo(campo) {
    if (erro?.campo === campo) setErro(null)
  }

  async function entrarComoTeste(usuarioId) {
    setErro(null)
    setCarregando(true)
    try {
      const dados = await api.post('/auth/teste', { usuario_id: usuarioId })
      setEntrando(true)
      entrou(dados.usuario)
      navegar('/', { replace: true })
    } catch (e) {
      mostrarErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  async function entrarComGoogle(credential) {
    setErro(null)
    setCarregando(true)
    try {
      const dados = await api.post('/auth/google', { credential })
      if (!dados?.usuario) throw new Error('Não foi possível entrar. Tente novamente.')
      setEntrando(true)
      entrou(dados.usuario)
      navegar('/', { replace: true })
    } catch (e) {
      mostrarErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  // O Google chama esta função quando a pessoa escolhe a conta.
  // Ela é criada com useEffectEvent para sempre ler o valor atual do checkbox dos termos.
  // Sem isso, ela poderia ler um valor antigo, de quando o botão do Google foi criado.
  const receberCredencial = useEffectEvent((resposta) => {
    if (!aceitou) return mostrarErro(MSG.termos, 'termos')
    entrarComGoogle(resposta.credential)
  })

  // Atalho de teste sem nada na tela. Só existe no npm run celular (ou com VITE_LOGIN_TESTE=1 no .env):
  // abrir /entrar?teste=1 entra como Diego, ?teste=2 como Larissa e ?teste=3 como Usuário Teste.
  // No celular o login do Google não funciona pelo endereço da rede, então é por aqui que se entra.
  const entrarPeloEndereco = useEffectEvent(() => {
    if (!import.meta.env.DEV || import.meta.env.VITE_LOGIN_TESTE !== '1') return
    const id = Number(new URLSearchParams(location.search).get('teste'))
    if ([1, 2, 3].includes(id)) entrarComoTeste(id)
  })

  // Quando a tela abre, pergunta para a API se a pessoa já está logada.
  // Não precisa mandar o token: o navegador manda o cookie "token" sozinho.
  useEffect(() => {
    let ativo = true
    api
      .get('/auth/sessao')
      .then((dados) => {
        if (!ativo) return
        if (dados?.usuario) {
          setEntrando(true)
          entrou(dados.usuario)
          navegar('/', { replace: true })
          return
        }
        entrarPeloEndereco() // atalho de teste do npm run celular (não faz nada fora dele)
      })
      .catch(() => {}) // se não tem sessão ou a API está fora do ar, só mostra o login
      .finally(() => {
        if (ativo) setVerificando(false)
      })
    return () => {
      ativo = false
    }
  }, [navegar])

  // Desenha o botão do Google. Ele tem que ser o botão do próprio Google,
  // porque só ele devolve o "credential" que a API usa para conferir o login.
  // Se a largura mudar, por exemplo ao girar o celular, o botão é desenhado de novo.
  useEffect(() => {
    const espaco = googleRef.current
    if (!mostrarFormulario || !GOOGLE_CLIENT_ID || !espaco) return

    let cancelado = false
    let observador
    let espera
    let larguraDesenhada = 0
    const repassar = (resposta) => receberCredencial(resposta)

    function desenhar() {
      const largura = Math.floor(espaco.getBoundingClientRect().width)
      if (!largura || Math.abs(largura - larguraDesenhada) < 4) return
      larguraDesenhada = largura
      window.google.accounts.id.renderButton(espaco, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'signin_with', // não aparece na tela, mas é o que o leitor de tela fala
        logo_alignment: 'center',
        locale: 'pt-BR',
        width: Math.min(largura, 400), // o Google não deixa passar de 400px
      })
      // Se o botão do design for mais largo que 400px (celular deitado), o do Google é esticado
      // no Login.css para cobrir o botão inteiro. Aqui só calcula quanto precisa esticar.
      espaco.style.setProperty('--google-esticar', largura / Math.min(largura, 400))
    }

    carregarGoogle()
      .then(() => {
        if (cancelado) return
        iniciarGoogle()
        repassarCredencial = repassar
        desenhar()
        observador = new ResizeObserver(() => {
          clearTimeout(espera)
          espera = setTimeout(desenhar, 150)
        })
        observador.observe(espaco)
      })
      .catch((e) => {
        if (!cancelado) setErroGoogle(e.message)
      })

    return () => {
      cancelado = true
      clearTimeout(espera)
      observador?.disconnect()
      if (repassarCredencial === repassar) repassarCredencial = null
    }
  }, [mostrarFormulario])

  function entrar(e) {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) return mostrarErro(MSG.email, 'email')
    if (!senha) return mostrarErro(MSG.senha, 'senha')
    if (!aceitou) return mostrarErro(MSG.termos, 'termos')
    // A API ainda não tem login com e-mail e senha. Quando tiver, a chamada para a API entra aqui.
    avisar(AVISO.emailEmBreve)
  }

  function alternarTermos(e) {
    setAceitou(e.target.checked)
    if (e.target.checked) limparErroDo('termos')
  }

  // O espaço do erro fica sempre na página, mesmo vazio.
  // Assim o leitor de tela (usado por quem não enxerga) lê o erro quando ele aparece.
  const avisos = (
    <p id="login-erro" className="login-aviso login-aviso--erro" role="alert">
      {erro?.texto}
    </p>
  )

  // Avisa o leitor de tela que o campo está com erro e qual é o texto do erro
  function propsDoCampo(campo) {
    const comErro = erro?.campo === campo
    return { 'aria-invalid': comErro || undefined, 'aria-describedby': comErro ? 'login-erro' : undefined }
  }

  return (
    <main className="login-tela">
      <title>Entrar | DesapegaUai</title>
      <div className="login-brilho" aria-hidden="true" />

      {/* Aviso rápido no alto da tela ("Você saiu da sua conta", "Apple em breve"...) */}
      <Toast aviso={toast} onFechar={() => setToast(null)} />

      <div className="login-coluna">
        <h1 className="login-logo">
          {/* Logo com a animação da bolinha que vira o pingo do i. Ela já vem verde desde o primeiro pulo. */}
          <LogoAnimado bolinha="verde" />
          <span className="login-sr"> Entrar</span>
        </h1>

        {verificando && (
          <p className="login-carregando" role="status">
            Carregando...
          </p>
        )}

        {entrando && (
          <p className="login-carregando" role="status">
            Entrando...
          </p>
        )}

        {/* Formulário de login */}
        {mostrarFormulario && (
          <div className="login-corpo">
            <form className="login-form" onSubmit={entrar} noValidate>
              <div className="login-grupo">
                <label htmlFor="login-email">E-mail</label>
                <div className="login-campo">
                  <IconeEmail />
                  <input
                    ref={emailRef}
                    id="login-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      limparErroDo('email')
                    }}
                    {...propsDoCampo('email')}
                  />
                </div>
              </div>

              <div className="login-grupo">
                <label htmlFor="login-senha">Senha</label>
                <div className="login-campo">
                  <IconeCadeado />
                  <input
                    ref={senhaRef}
                    id="login-senha"
                    name="senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={senha}
                    onChange={(e) => {
                      setSenha(e.target.value)
                      limparErroDo('senha')
                    }}
                    {...propsDoCampo('senha')}
                  />
                  <button
                    type="button"
                    className="login-olho"
                    onClick={() => setMostrarSenha((v) => !v)}
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-controls="login-senha"
                  >
                    <IconeOlho riscado={mostrarSenha} />
                  </button>
                </div>
              </div>

              <div className="login-esqueci">
                <button type="button" className="login-link" onClick={() => avisar(AVISO.senhaEmBreve)}>
                  Esqueceu a senha?
                </button>
              </div>

              <button type="submit" className="login-entrar" disabled={carregando} aria-busy={carregando}>
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>

              <div className="login-avisos">
                <label className="login-aceite">
                  <input
                    ref={termosRef}
                    type="checkbox"
                    className="login-cx"
                    checked={aceitou}
                    onChange={alternarTermos}
                    {...propsDoCampo('termos')}
                  />
                  <span>
                    {/* Os links abrem em outra aba para a pessoa não perder o que já digitou.
                        As páginas de termos e privacidade ainda vão ser criadas. */}
                    Li e aceito os{' '}
                    <Link to="/termos" target="_blank">
                      Termos de uso
                    </Link>{' '}
                    e a{' '}
                    <Link to="/privacidade" target="_blank">
                      Política de privacidade
                    </Link>
                    .
                  </span>
                </label>
                {avisos}
              </div>
            </form>

            <div className="login-ou">
              <p className="login-ou-linha">ou entre com</p>
              <div className="login-social">
                {GOOGLE_CLIENT_ID && !erroGoogle ? (
                  <div className="login-google">
                    {/* O que aparece na tela é o botão do design. Por cima dele fica o botão oficial
                        do Google, invisível, porque só ele devolve o "credential" que a API usa.
                        Então o clique cai no botão do Google, mas a pessoa vê o botão do design. */}
                    <div className="login-soc" aria-hidden="true">
                      <IconeGoogle />
                      Google
                    </div>
                    {/* Enquanto os termos não forem aceitos, o inert bloqueia o botão do Google
                        e um botão invisível por cima mostra o aviso dos termos */}
                    <div ref={googleRef} className="login-google-botao" inert={!aceitou || carregando} />
                    {!aceitou && (
                      <button type="button" className="login-google-trava" onClick={() => mostrarErro(MSG.termos, 'termos')}>
                        <span className="login-sr">Entrar com o Google</span>
                      </button>
                    )}
                  </div>
                ) : (
                  // Sem a chave do Google no .env (ou se o script do Google não carregou),
                  // fica um botão com o mesmo visual do design, que só explica o problema.
                  <button
                    type="button"
                    className="login-soc"
                    onClick={() => mostrarErro(erroGoogle || (import.meta.env.DEV ? MSG.googleSemChave : MSG.googleFora))}
                  >
                    <IconeGoogle />
                    Google
                  </button>
                )}

                <button type="button" className="login-soc" onClick={() => avisar(AVISO.appleEmBreve)}>
                  <IconeApple />
                  Apple
                </button>
              </div>

            </div>

            <p className="login-criar">
              Ainda não tem conta?{' '}
              <button type="button" className="login-link" onClick={() => avisar(AVISO.criarConta)}>
                Criar conta
              </button>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

// Ícones copiados do protótipo. O tamanho e a cor ficam no Login.css (classe login-icone).
function IconeEmail() {
  return (
    <svg className="login-icone" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="3.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  )
}

function IconeCadeado() {
  return (
    <svg className="login-icone" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="10.5" width="17" height="10.5" rx="3" />
      <path d="M7.5 10.5V7.8a4.5 4.5 0 0 1 9 0v2.7" />
    </svg>
  )
}

function IconeOlho({ riscado }) {
  return (
    <svg className="login-icone" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12c0 1.6-4 5.8-9 5.8S3 13.6 3 12s4-5.8 9-5.8S21 10.4 21 12z" />
      <circle cx="12" cy="12" r="2.9" />
      {riscado && <path d="m4 4 16 16" />}
    </svg>
  )
}

// As cores de cada parte do G vêm no próprio desenho, por isso usa a classe "cheio" (sem contorno)
function IconeGoogle() {
  return (
    <svg className="login-icone login-icone--cheio" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h6.1a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.5-5 3.5-8.5z" />
      <path fill="#34A853" d="M12 23.5c3 0 5.5-1 7.4-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H1.9v3a11.5 11.5 0 0 0 10.2 6.2z" />
      <path fill="#FBBC05" d="M5.7 14.3a6.9 6.9 0 0 1 0-4.4v-3H1.9a11.5 11.5 0 0 0 0 10.4l3.8-3z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.3 1.7l3.2-3.2A11.5 11.5 0 0 0 1.9 6.9l3.8 3c.9-2.7 3.4-4.6 6.3-4.6z" />
    </svg>
  )
}

function IconeApple() {
  return (
    <svg className="login-icone login-icone--cheio" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.4 12.9c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3-2-3.7-2-1.6-.1-3 .9-3.8.9-.8 0-2-.9-3.2-.9-1.7 0-3.2 1-4 2.5-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8 2.1-1.1 2.9-2.3c.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.7zM14.3 5.3c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z" />
    </svg>
  )
}
