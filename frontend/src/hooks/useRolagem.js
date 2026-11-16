import { useEffect, useState } from 'react'

// Diz se a página já rolou mais do que `limite` pixels.
// Exemplo: const rolou = useRolagem(220)
export function useRolagem(limite) {
  const [passou, setPassou] = useState(() => window.scrollY > limite)

  useEffect(() => {
    const conferir = () => setPassou(window.scrollY > limite)
    window.addEventListener('scroll', conferir, { passive: true })
    return () => window.removeEventListener('scroll', conferir)
  }, [limite])

  return passou
}
