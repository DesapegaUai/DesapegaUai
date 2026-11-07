// Lê o .env. Nos outros arquivos: import { env } from '../config/env.js'
import path from 'node:path'

try {
  process.loadEnvFile(path.join(import.meta.dirname, '..', '..', '.env'))
} catch {
  // sem .env (ex.: produção): usa as variáveis do sistema
}

const producao = process.env.NODE_ENV === 'production'

export const env = {
  producao,
  porta: Number(process.env.PORT ?? 3333),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    porta: Number(process.env.DB_PORT ?? 3306),
    usuario: process.env.DB_USER ?? 'root',
    senha: process.env.DB_PASSWORD ?? '',
    nome: process.env.DB_NAME ?? 'desapegauai',
  },
  jwtSegredo: process.env.JWT_SEGREDO ?? '',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  permitirLoginTeste: !producao && process.env.PERMITIR_LOGIN_TESTE === 'true', // nunca em produção
}
