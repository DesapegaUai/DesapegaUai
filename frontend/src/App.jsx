import { Route, Routes } from 'react-router'
import TelasMarketplace from './components/TelasMarketplace.jsx'
import Casa from './pages/Casa.jsx'
import Conversas from './pages/Conversas.jsx'
import Eletronicos from './pages/Eletronicos.jsx'
import Favoritos from './pages/Favoritos.jsx'
import Games from './pages/Games.jsx'
import Home from './pages/Home.jsx'
import Livros from './pages/Livros.jsx'
import Moda from './pages/Moda.jsx'
import NaoEncontrada from './pages/NaoEncontrada.jsx'
import Perfil from './pages/Perfil.jsx'
import Servicos from './pages/Servicos.jsx'
import Veiculos from './pages/Veiculos.jsx'

// Rotas (páginas) do site. Cada página nova entra aqui com um <Route>.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route element={<TelasMarketplace />}>
        <Route path="/categoria/casa" element={<Casa />} />
        <Route path="/categoria/eletronicos" element={<Eletronicos />} />
        <Route path="/categoria/moda" element={<Moda />} />
        <Route path="/categoria/veiculos" element={<Veiculos />} />
        <Route path="/categoria/livros" element={<Livros />} />
        <Route path="/categoria/games" element={<Games />} />
        <Route path="/categoria/servicos" element={<Servicos />} />
        <Route path="/favoritos" element={<Favoritos />} />
        <Route path="/conversas" element={<Conversas />} />
        <Route path="/conversas/:id" element={<Conversas />} />
        <Route path="/perfil" element={<Perfil />} />
      </Route>

      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
  )
}
