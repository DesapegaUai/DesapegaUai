import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Em desenvolvimento, o front chama /api/... e o Vite repassa para o back-end.
    // Assim o front e a API parecem estar no mesmo endereço e não dá erro de CORS.
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
})
