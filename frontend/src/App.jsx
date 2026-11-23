import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import Acessibilidade from './components/Acessibilidade.jsx'
import RotaPrivada from './components/RotaPrivada.jsx'
import TelasMarketplace from './components/TelasMarketplace.jsx'
import { NotificacoesAnunciosProvider } from './components/NotificacoesAnuncios.jsx'
import Busca from './pages/Busca.jsx'
import TodosAnuncios from './pages/TodosAnuncios.jsx'
import CadastrarAnuncio from './pages/CadastrarAnuncio.jsx'
import Casa from './pages/Casa.jsx'
import Conversas from './pages/Conversas.jsx'
import DetalhesAnuncio from './pages/DetalhesAnuncio.jsx'
import EditarPerfil from './pages/EditarPerfil.jsx'
import Eletronicos from './pages/Eletronicos.jsx'
import Favoritos from './pages/Favoritos.jsx'
import Games from './pages/Games.jsx'
import Home from './pages/Home.jsx'
import Institucional from './pages/Institucional.jsx'
import Livros from './pages/Livros.jsx'
import Login from './pages/Login.jsx'
import Mapa from './pages/Mapa.jsx'
import MeusAnuncios from './pages/MeusAnuncios.jsx'
import Moda from './pages/Moda.jsx'
import NaoEncontrada from './pages/NaoEncontrada.jsx'
import Outros from './pages/Outros.jsx'
import Perfil from './pages/Perfil.jsx'
import PerfilPublico from './pages/PerfilPublico.jsx'
import ProcuraSe from './pages/ProcuraSe.jsx'
import Servicos from './pages/Servicos.jsx'
import Veiculos from './pages/Veiculos.jsx'
import { retomarGpsSalvo } from './services/localizacao.js'
import { registrarServiceWorker } from './services/push.js'
import { carregarSessao } from './services/sessao.js'
import { conectarTempoReal } from './services/tempoReal.js'

// Rotas (páginas) do site. Cada página nova entra aqui com um <Route>.
export default function App() {
  useEffect(() => {
    carregarSessao()
    conectarTempoReal()
    retomarGpsSalvo()
    registrarServiceWorker()?.catch(() => {})
  }, [])

  return (
    <NotificacoesAnunciosProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/entrar" element={<Login />} />

        <Route element={<TelasMarketplace />}>
          <Route path="/categoria/casa" element={<Casa />} />
          <Route path="/categoria/eletronicos" element={<Eletronicos />} />
          <Route path="/categoria/moda" element={<Moda />} />
          <Route path="/categoria/veiculos" element={<Veiculos />} />
          <Route path="/categoria/livros" element={<Livros />} />
          <Route path="/categoria/games" element={<Games />} />
          <Route path="/categoria/servicos" element={<Servicos />} />
          <Route path="/categoria/outros" element={<Outros />} />
          <Route path="/busca" element={<Busca />} />
          <Route path="/anuncios" element={<TodosAnuncios />} />
          <Route path="/mapa" element={<Mapa />} />
          <Route path="/procura-se" element={<ProcuraSe />} />
          <Route path="/anuncio/:id" element={<DetalhesAnuncio />} />
          <Route path="/usuario/:id" element={<PerfilPublico />} />
          <Route path="/ajuda/:pagina" element={<Institucional />} />
          <Route path="/ajuda" element={<Navigate to="/ajuda/como-funciona" replace />} />
          <Route path="/termos" element={<Navigate to="/ajuda/termos-de-uso" replace />} />
          <Route path="/privacidade" element={<Navigate to="/ajuda/politica-de-privacidade" replace />} />

          <Route element={<RotaPrivada />}>
            <Route path="/anunciar" element={<CadastrarAnuncio />} />
            <Route path="/anuncios/:id/editar" element={<CadastrarAnuncio />} />
            <Route path="/meus-anuncios" element={<MeusAnuncios />} />
            <Route path="/favoritos" element={<Favoritos />} />
            <Route path="/conversas" element={<Conversas />} />
            <Route path="/conversas/:id" element={<Conversas />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/perfil/editar" element={<EditarPerfil />} />
          </Route>
        </Route>

        <Route path="*" element={<NaoEncontrada />} />
      </Routes>
      <Acessibilidade />
    </NotificacoesAnunciosProvider>
  )
}
