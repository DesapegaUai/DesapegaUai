import { corDaNota, textoDaNota, vereditoDaNota } from '../services/comparador.js'

/** Nota de custo-benefício (0 a 10) num anel que se preenche, com a cor da nota. */
export default function AnelDaNota({ nota, tamanho = 52, espessura = 5 }) {
  const centro = tamanho / 2
  const raio = (tamanho - espessura) / 2
  const volta = 2 * Math.PI * raio
  const cor = corDaNota(nota)
  return (
    <span
      className="anel-nota"
      style={{ width: tamanho, height: tamanho, '--cor-nota': cor, '--volta': volta, fontSize: Math.round(tamanho * 0.31) }}
      role="img"
      aria-label={`Nota de custo-benefício ${textoDaNota(nota)} de 10, ${vereditoDaNota(nota).toLowerCase()}`}
    >
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden="true" focusable="false">
        <circle cx={centro} cy={centro} r={raio} fill="none" stroke="#E7EEE2" strokeWidth={espessura} />
        <circle
          className="anel-nota-cheio"
          cx={centro}
          cy={centro}
          r={raio}
          fill="none"
          stroke={cor}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - Math.max(0, Math.min(10, nota)) / 10)}
          transform={`rotate(-90 ${centro} ${centro})`}
        />
      </svg>
      <b aria-hidden="true">{textoDaNota(nota)}</b>
    </span>
  )
}
