import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icone from './IconeMarketplace.jsx'
import RodaDeEscolha from './RodaDeEscolha.jsx'
import useGaveta from '../hooks/useGaveta.js'
import { HORAS, MINUTOS, dataEscolhida, diasParaEscolher, escolhaInicial, quandoSai } from '../services/programadas.js'
import '../styles/marketplace-programadas.css'

const MINIMO_NO_FUTURO_MS = 60 * 1000

/**
 * "Programar mensagem" (igual ao WhatsApp): dia, hora e minuto em rodinhas e o botão que mostra quando a
 * mensagem vai sair. No celular sobe de baixo; no computador aparece no meio da tela.
 */
export default function ProgramarMensagem({ texto, onProgramar, onFechar }) {
  const [agora] = useState(() => new Date())
  // relógio que anda sozinho: se a pessoa deixar a janela aberta, um horário que passou fica bloqueado
  const [relogio, setRelogio] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setRelogio(Date.now()), 15 * 1000)
    return () => clearInterval(id)
  }, [])
  const dias = useMemo(() => diasParaEscolher(agora), [agora])
  const [escolha, setEscolha] = useState(() => escolhaInicial(agora))
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const fecharRef = useRef(null)
  // só programa com um toque/clique que começou no próprio botão (ou pelo teclado): um clique "fantasma"
  // de quem acabou de soltar o dedo do enviar nunca programa sozinho
  const apertou = useRef(false)
  const fechar = useCallback(() => { if (!enviando) onFechar() }, [enviando, onFechar])
  useGaveta(true, fechar, fecharRef)

  const data = dataEscolhida(escolha, agora)
  const noPassado = data.getTime() < relogio + MINIMO_NO_FUTURO_MS
  const mudar = (campo) => (i) => { setEscolha((atual) => ({ ...atual, [campo]: i })); setErro('') }

  async function programar() {
    if (noPassado || enviando) return
    setEnviando(true)
    try {
      await onProgramar(data)
    } catch (falha) {
      setErro(falha.message)
      setEnviando(false)
    }
  }

  return createPortal(
    <div className="telas-marketplace">
      <div className="pm-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar() }}>
        <div className="pm-folha" role="dialog" aria-modal="true" aria-labelledby="pm-titulo">
          <span className="pm-alca" aria-hidden="true" />
          <div className="pm-cab">
            <span className="pm-icone" aria-hidden="true"><Icone nome="relogio" tamanho={20} cor="#fff" espessura={2} /></span>
            <h2 id="pm-titulo">Programar mensagem</h2>
            <button type="button" className="pm-x" aria-label="Fechar" ref={fecharRef} onClick={fechar}>
              <Icone nome="fechar" tamanho={22} cor="#16281C" espessura={2} />
            </button>
          </div>
          <p className="pm-previa">“{texto}”</p>
          <div className="pm-rodas" role="group" aria-label="Dia e hora do envio">
            <i className="pm-faixa" aria-hidden="true" />
            <RodaDeEscolha rotulo="Dia" opcoes={dias} indice={escolha.dia} onMudar={mudar('dia')} classe="roda-dia" />
            <RodaDeEscolha rotulo="Hora" opcoes={HORAS} indice={escolha.hora} onMudar={mudar('hora')} />
            <RodaDeEscolha rotulo="Minuto" opcoes={MINUTOS} indice={escolha.minuto} onMudar={mudar('minuto')} />
          </div>
          {erro && <p className="pm-erro" role="alert">{erro}</p>}
          <button
            type="button"
            className="pm-enviar"
            disabled={noPassado || enviando}
            onPointerDown={() => { apertou.current = true }}
            onPointerCancel={() => { apertou.current = false }}
            onClick={(e) => {
              if (e.detail !== 0 && !apertou.current) return
              apertou.current = false
              programar()
            }}
          >
            {noPassado ? 'Escolha um horário que ainda não passou' : enviando ? 'Programando…' : `Enviar ${quandoSai(data)}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
