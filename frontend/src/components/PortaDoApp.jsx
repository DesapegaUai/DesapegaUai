import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { emModoApp, escolheuContinuarSemEntrar } from '../services/modoApp.js'
import { useSessao } from '../services/sessao.js'

// Na abertura do app instalado: quem está logado (o Android usa o mesmo login do Chrome) entra direto;
// quem não está vai para a tela de entrar, que tem "Continuar sem entrar". No navegador nada muda.
// Confere uma vez só por abertura, depois que a sessão terminou de carregar.
export default function PortaDoApp() {
  const { carregando, usuario } = useSessao()
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const conferido = useRef(false)

  useEffect(() => {
    if (conferido.current || carregando) return
    conferido.current = true
    if (!emModoApp() || usuario || pathname === '/entrar' || escolheuContinuarSemEntrar()) return
    navegar('/entrar', { replace: true })
  }, [carregando, usuario, pathname, navegar])

  return null
}
