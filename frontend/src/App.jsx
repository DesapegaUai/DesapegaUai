import { Route, Routes } from 'react-router'
import Inicio from './pages/Inicio.jsx'
import NaoEncontrada from './pages/NaoEncontrada.jsx'

// Rotas (páginas) do site. Cada página nova entra aqui com um <Route>.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
  )
}
