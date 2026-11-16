import './Icone.css'

/*
  Ícone do sprite (public/icones-sprite.svg). A cor vem do CSS (`color`), pois os traços usam currentColor.
  Use o nome sem o prefixo "icone-": <Icone nome="favorito" tamanho={24} />
  Os nomes "home-..." são as variantes de traço usadas na página inicial.
*/
export default function Icone({ nome, tamanho = 24, className = '', ...resto }) {
  return (
    <svg
      className={`icone ${className}`.trim()}
      width={tamanho}
      height={tamanho}
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      <use href={`/icones-sprite.svg#icone-${nome}`} />
    </svg>
  )
}
