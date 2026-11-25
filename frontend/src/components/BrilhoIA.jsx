/** O brilho que marca o que a IA do DesapegaUai fez (comparação, nota, lista de compras). */
export default function BrilhoIA({ tamanho = 18, cor = '#3E8B22' }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill={cor} d="M12 2.5c.6 4.7 2.8 6.9 7.5 7.5-4.7.6-6.9 2.8-7.5 7.5-.6-4.7-2.8-6.9-7.5-7.5 4.7-.6 6.9-2.8 7.5-7.5zM19 15.5c.25 1.9 1.1 2.75 3 3-1.9.25-2.75 1.1-3 3-.25-1.9-1.1-2.75-3-3 1.9-.25 2.75-1.1 3-3z" />
    </svg>
  )
}
