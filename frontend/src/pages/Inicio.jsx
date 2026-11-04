import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

// Página provisória: só confere se o front está falando com a API.
// A equipe do front substitui pelo layout da Home do Figma.
export default function Inicio() {
  const [status, setStatus] = useState('verificando...')

  useEffect(() => {
    api
      .get('/saude')
      .then((dados) => setStatus(dados.banco === 'ok' ? 'API e banco conectados' : 'API conectada, banco sem conexão'))
      .catch((erro) => setStatus(erro.message))
  }, [])

  return (
    <main className="container">
      <h1 className="logo">
        Desapega<span>Uai</span>
      </h1>
      <p>Estrutura inicial do front-end.</p>
      <p className="status">Status: {status}</p>
    </main>
  )
}
