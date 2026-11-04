// Lê as configurações do arquivo .env e reúne tudo num objeto só.
// Nos outros arquivos: import { env } from '../config/env.js'
import path from 'node:path'

try {
  process.loadEnvFile(path.join(import.meta.dirname, '..', '..', '.env'))
} catch {
  // Sem .env (por exemplo, no servidor de produção): usa as variáveis do próprio sistema.
}

export const env = {
  producao: process.env.NODE_ENV === 'production',
  porta: Number(process.env.PORT ?? 3333),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    porta: Number(process.env.DB_PORT ?? 3306),
    usuario: process.env.DB_USER ?? 'root',
    senha: process.env.DB_PASSWORD ?? '',
    nome: process.env.DB_NAME ?? 'desapegauai',
  },
}
