import { useEffect, useEffectEvent, useState } from 'react'
import { Link } from 'react-router'
import './Toast.css'

// Aviso rápido que aparece no alto da tela e some sozinho (o famoso "toast").
// O visual segue o padrão mais usado hoje (Sonner, Vercel, Linear): cartão claro,
// ícone do tipo do aviso, título curto, texto opcional e botão de fechar.
//
// Como usar numa tela:
//   const [toast, setToast] = useState(null)
//   setToast({ tipo: 'sucesso', titulo: 'Anúncio salvo', chave: Date.now() })
//   <Toast aviso={toast} onFechar={() => setToast(null)} />
//
// tipo: 'sucesso', 'info' ou 'erro'. texto é opcional.
// A chave muda a cada aviso, assim a animação recomeça mesmo se o aviso for igual ao anterior.
// Mensagem do chat: pessoa { nome, foto, iniciais } mostra a foto de quem mandou no lugar do ícone
// (sem foto, as iniciais, como no perfil) e link abre a conversa ao tocar no aviso.
// Anúncio novo: imagem mostra a foto de capa do que foi publicado e link abre o anúncio.

// Quanto tempo o aviso fica na tela antes de sumir.
// Aviso só com título é rápido de ler. Com o texto embaixo, fica um segundo a mais.
// 2 s é o tempo do aviso de sucesso do react-hot-toast, e 3 s é o do Ant Design.
const TEMPO_SO_TITULO = 2000
const TEMPO_COM_TEXTO = 3000
const TEMPO_DE_MENSAGEM = 5000 // mensagem do chat: dá tempo de ler quem mandou e o texto
const TEMPO_DE_SAIDA = 200 // igual à animação toast-sai do Toast.css

export default function Toast({ aviso, onFechar }) {
  // A área fica sempre na página, mesmo vazia.
  // Assim o leitor de tela (usado por quem não enxerga) anuncia o aviso quando ele aparece.
  return (
    <div className="toast-area" role="status" aria-live="polite">
      {aviso && <CartaoDoToast key={aviso.chave} aviso={aviso} onFechar={onFechar} />}
    </div>
  )
}

function CartaoDoToast({ aviso, onFechar }) {
  const [saindo, setSaindo] = useState(false)
  const [pausado, setPausado] = useState(false) // com o mouse em cima, o aviso não some
  const fechar = useEffectEvent(() => onFechar())
  const tempoNaTela = aviso.pessoa || aviso.imagem ? TEMPO_DE_MENSAGEM : aviso.texto ? TEMPO_COM_TEXTO : TEMPO_SO_TITULO

  // Conta o tempo para o aviso começar a sair
  useEffect(() => {
    if (pausado || saindo) return
    const espera = setTimeout(() => setSaindo(true), tempoNaTela)
    return () => clearTimeout(espera)
  }, [pausado, saindo, tempoNaTela])

  // Espera a animação de saída terminar e tira o aviso da tela
  useEffect(() => {
    if (!saindo) return
    const espera = setTimeout(fechar, TEMPO_DE_SAIDA)
    return () => clearTimeout(espera)
  }, [saindo])

  return (
    <div
      className={saindo ? 'toast toast--saindo' : 'toast'}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      {aviso.pessoa ? <FotoDaPessoa pessoa={aviso.pessoa} />
        : aviso.imagem ? <img className="toast-imagem" src={aviso.imagem} alt="" />
          : <IconeDoTipo tipo={aviso.tipo} />}
      {aviso.link ? (
        <Link className="toast-conteudo toast-link" to={aviso.link} onClick={() => setSaindo(true)}>
          <p className="toast-titulo">{aviso.pessoa && <span className="toast-oculto">Nova mensagem de </span>}{aviso.titulo}</p>
          {aviso.texto && <p className="toast-texto">{aviso.texto}</p>}
        </Link>
      ) : (
        <div className="toast-conteudo">
          <p className="toast-titulo">{aviso.titulo}</p>
          {aviso.texto && <p className="toast-texto">{aviso.texto}</p>}
        </div>
      )}
      <button type="button" className="toast-fechar" onClick={() => setSaindo(true)} aria-label="Fechar aviso">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// foto de quem mandou a mensagem; sem foto, as iniciais (o mesmo avatar do perfil)
function FotoDaPessoa({ pessoa }) {
  return (
    <span className="toast-foto" aria-hidden="true">
      {pessoa.foto ? <img src={pessoa.foto} alt="" referrerPolicy="no-referrer" /> : pessoa.iniciais}
    </span>
  )
}

function IconeDoTipo({ tipo }) {
  if (tipo === 'sucesso') {
    return (
      <svg className="toast-icone toast-icone--sucesso" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="10" />
        <path d="m6 10.2 2.6 2.6L14 7.4" />
      </svg>
    )
  }
  if (tipo === 'erro') {
    return (
      <svg className="toast-icone toast-icone--erro" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="10" />
        <path d="M10 5.8v5" />
        <circle className="toast-icone-ponto" cx="10" cy="14" r="1.1" />
      </svg>
    )
  }
  return (
    <svg className="toast-icone toast-icone--info" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="10" />
      <circle className="toast-icone-ponto" cx="10" cy="6.2" r="1.1" />
      <path d="M10 9.2v5" />
    </svg>
  )
}
