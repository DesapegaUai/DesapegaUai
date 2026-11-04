import { Link } from 'react-router'

export default function NaoEncontrada() {
  return (
    <main className="container">
      <h1>Página não encontrada</h1>
      <Link to="/">Voltar para o início</Link>
    </main>
  )
}
