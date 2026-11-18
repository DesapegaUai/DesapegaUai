import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import '../styles/marketplace-base.css'

// Moldura das telas de categorias, favoritos, conversas e perfil.
// Volta ao topo a cada troca de tela (menos quando é só um #âncora).
export default function TelasMarketplace() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <div className="telas-marketplace">
      <Outlet />
    </div>
  )
}
