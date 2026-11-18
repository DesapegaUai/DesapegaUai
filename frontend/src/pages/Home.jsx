import { useState } from 'react'
import Achados from '../components/Achados.jsx'
import Cabecalho from '../components/Cabecalho.jsx'
import Categorias from '../components/Categorias.jsx'
import Destaque from '../components/Destaque.jsx'
import Rodape from '../components/Rodape.jsx'
import SecaoConectando from '../components/SecaoConectando.jsx'
import './Home.css'

// Página inicial (Home). O texto digitado na busca do cabeçalho filtra os "Achados perto de você".
export default function Home() {
  const [busca, setBusca] = useState('')

  return (
    <div className="pagina-inicio">
      <Cabecalho busca={busca} onBusca={setBusca} />
      <main>
        <Destaque />
        <Categorias />
        <Achados busca={busca} />
        <SecaoConectando />
      </main>
      <Rodape />
    </div>
  )
}
