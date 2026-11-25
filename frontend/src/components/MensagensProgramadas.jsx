import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icone from './IconeMarketplace.jsx'
import useGaveta from '../hooks/useGaveta.js'
import { quandoSai } from '../services/programadas.js'
import '../styles/marketplace-programadas.css'

/**
 * "Mensagens programadas" (o "Mostrar" do aviso na conversa): as que ainda não saíram, agrupadas pelo
 * horário, com "Enviar agora" e "Apagar". Só quem programou vê.
 */
export default function MensagensProgramadas({ programadas, onEnviarAgora, onApagar, onFechar }) {
  const fecharRef = useRef(null)
  const [ocupada, setOcupada] = useState(null)
  useGaveta(true, onFechar, fecharRef)
  // enviou ou apagou a última (aqui, em outra aba ou porque deu o horário): a janela fecha, como no WhatsApp
  const vazia = programadas.length === 0
  useEffect(() => { if (vazia) onFechar() }, [vazia, onFechar])

  const grupos = []
  for (const programada of programadas) {
    const quando = quandoSai(programada.enviar_em)
    const grupo = grupos.find((g) => g.quando === quando)
    if (grupo) grupo.itens.push(programada)
    else grupos.push({ quando, itens: [programada] })
  }

  async function fazer(acao, programada) {
    setOcupada(programada.id)
    try {
      await acao(programada)
    } finally {
      setOcupada(null)
    }
  }

  return createPortal(
    <div className="telas-marketplace">
      <div className="pm-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
        <div className="pm-folha" role="dialog" aria-modal="true" aria-labelledby="pms-titulo">
          <span className="pm-alca" aria-hidden="true" />
          <div className="pm-cab">
            <span className="pm-icone" aria-hidden="true"><Icone nome="relogio" tamanho={20} cor="#fff" espessura={2} /></span>
            <h2 id="pms-titulo">Mensagens programadas</h2>
            <button type="button" className="pm-x" aria-label="Fechar" ref={fecharRef} onClick={onFechar}>
              <Icone nome="fechar" tamanho={22} cor="#16281C" espessura={2} />
            </button>
          </div>
          <div className="pm-lista">
            {grupos.map((grupo) => (
              <section key={grupo.quando} aria-label={`Para ${grupo.quando}`}>
                <p className="pm-grupo">Para {grupo.quando}</p>
                {grupo.itens.map((programada) => (
                  <div key={programada.id} className="pm-item">
                    <div className="linha-msg eu ultima"><div className="bolha"><p>{programada.texto}</p></div></div>
                    <div className="pm-acoes">
                      <button type="button" className="pm-acao" disabled={ocupada === programada.id} onClick={() => fazer(onEnviarAgora, programada)}>
                        <Icone nome="enviar" tamanho={16} cor="currentColor" espessura={2} />Enviar agora
                      </button>
                      <button type="button" className="pm-acao perigo" disabled={ocupada === programada.id} onClick={() => fazer(onApagar, programada)}>
                        <Icone nome="lixeira" tamanho={16} cor="currentColor" />Apagar
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
          <p className="pm-nota">A mensagem sai sozinha no horário, mesmo com o site fechado.</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
