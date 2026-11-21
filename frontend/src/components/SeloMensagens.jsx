import { useContext } from 'react'
import ContextoNotificacoes from './NotificacoesAnunciosContext.js'
import './SeloMensagens.css'

// Bolinha com a quantidade de conversas com mensagem não lida.
// Vai em cima do ícone de mensagens (cabeçalhos) ou no fim da linha "Mensagens" do menu (naLinha).
// O ícone ou link que recebe o selo precisa da classe "tem-selo".
export default function SeloMensagens({ naLinha = false }) {
  const total = useContext(ContextoNotificacoes)?.mensagensNaoLidas ?? 0
  if (!total) return null

  return (
    <span className={naLinha ? 'selo-msg selo-msg--linha' : 'selo-msg'}>
      <span aria-hidden="true">{total > 9 ? '9+' : total}</span>
      <span className="selo-msg-leitor">
        {total === 1 ? ', 1 conversa com mensagem nova' : `, ${total} conversas com mensagem nova`}
      </span>
    </span>
  )
}
