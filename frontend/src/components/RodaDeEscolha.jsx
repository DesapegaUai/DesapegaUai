import { useEffect, useRef } from 'react'

const ALTURA = 40 // de cada opção; a roda mostra 5 e a do meio é a escolhida

/**
 * Rodinha de escolher (como a do WhatsApp e do iPhone): gira com o dedo ou o mouse e para encaixada numa
 * opção. No teclado é um "spinbutton": setas para cima e para baixo, Page Up/Down e Home/End.
 */
export default function RodaDeEscolha({ rotulo, opcoes, indice, onMudar, classe = '' }) {
  const listaRef = useRef(null)
  const relogio = useRef(null)
  const montada = useRef(false)
  const ultimo = opcoes.length - 1
  const limitar = (i) => Math.max(0, Math.min(ultimo, i))

  // escolheu pelo teclado ou tocando numa opção: a roda gira até ela (ao abrir, já aparece no lugar)
  useEffect(() => {
    const lista = listaRef.current
    if (!lista) return
    const alvo = indice * ALTURA
    if (Math.abs(lista.scrollTop - alvo) > 2) lista.scrollTo({ top: alvo, behavior: montada.current ? 'smooth' : 'auto' })
    montada.current = true
  }, [indice])

  useEffect(() => () => clearTimeout(relogio.current), [])

  // parou de girar: escolhe a opção que ficou no meio
  function aoRolar() {
    clearTimeout(relogio.current)
    relogio.current = setTimeout(() => {
      const lista = listaRef.current
      if (!lista) return
      const i = limitar(Math.round(lista.scrollTop / ALTURA))
      if (i !== indice) onMudar(i)
    }, 90)
  }

  function teclar(e) {
    const passos = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }
    let novo = null
    if (e.key in passos) novo = limitar(indice + passos[e.key])
    else if (e.key === 'Home') novo = 0
    else if (e.key === 'End') novo = ultimo
    if (novo === null) return
    e.preventDefault()
    if (novo !== indice) onMudar(novo)
  }

  return (
    <div
      className={`roda ${classe}`.trim()}
      role="spinbutton"
      tabIndex={0}
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={ultimo}
      aria-valuenow={indice}
      aria-valuetext={opcoes[indice]?.rotulo}
      onKeyDown={teclar}
    >
      <div className="roda-lista" ref={listaRef} onScroll={aoRolar} aria-hidden="true">
        <span className="roda-vazio" />
        <span className="roda-vazio" />
        {opcoes.map((opcao, i) => (
          <button type="button" tabIndex={-1} key={opcao.valor} className={i === indice ? 'on' : undefined} onClick={() => onMudar(i)}>
            {opcao.rotulo}
          </button>
        ))}
        <span className="roda-vazio" />
        <span className="roda-vazio" />
      </div>
    </div>
  )
}
