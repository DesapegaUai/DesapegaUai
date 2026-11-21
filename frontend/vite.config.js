import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Para abrir o site no celular (mesma rede Wi-Fi), rode:  npm run celular
// Isso liga CELULAR=1: o Vite passa a aceitar acesso de outros aparelhos da rede e avisa a API que o
// pedido veio do endereço de sempre (a API só aceita o localhost em desenvolvimento).
const noCelular = process.env.CELULAR === '1'
const origemLocal = { origin: 'http://localhost:5173' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: noCelular ? true : undefined,
    // Em desenvolvimento, o front chama /api/... e o Vite repassa para o back-end.
    // Assim o front e a API parecem estar no mesmo endereço e não dá erro de CORS.
    // API_PROXY troca o endereço da API (os testes de navegador usam uma API separada).
    proxy: {
      '/api': {
        target: process.env.API_PROXY || 'http://localhost:3333',
        changeOrigin: true,
        ws: true,
        headers: noCelular ? origemLocal : undefined,
      },
    },
  },
})
