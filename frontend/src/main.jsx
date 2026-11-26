import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './styles/global.css'
import App from './App.jsx'
import { marcarModoApp } from './services/modoApp.js'

marcarModoApp() // app instalado: html.modo-app antes da primeira tela

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
