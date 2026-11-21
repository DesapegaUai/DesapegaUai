import { useEffect } from 'react'
import { Link } from 'react-router'
import LayoutMarketplace from '../components/LayoutMarketplace.jsx'
import Icone from '../components/IconeMarketplace.jsx'
import '../styles/marketplace-detalhes.css'

// Endereço que não existe no site: mostra o aviso dentro da moldura normal (cabeçalho e rodapé).
export default function NaoEncontrada() {
  useEffect(() => { document.title = 'DesapegaUai — Página não encontrada' }, [])

  return (
    <LayoutMarketplace comFab={false}>
      <div className="det-vazio">
        <Icone nome="busca" tamanho={40} cor="#4CA02B" />
        <h1>Página não encontrada</h1>
        <p>Esse endereço não existe ou mudou de lugar.</p>
        <Link to="/">Voltar para o início</Link>
      </div>
    </LayoutMarketplace>
  )
}
