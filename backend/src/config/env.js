// Lê o .env. Nos outros arquivos: import { env } from '../config/env.js'
import path from 'node:path'

try {
  process.loadEnvFile(path.join(import.meta.dirname, '..', '..', '.env'))
} catch {
  // sem .env (ex.: produção): usa as variáveis do sistema
}

const producao = process.env.NODE_ENV === 'production'
const emTeste = Boolean(process.env.NODE_TEST_CONTEXT) // o node --test põe essa variável
const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'

// em desenvolvimento, localhost e 127.0.0.1 são o mesmo site
function origensDoFront() {
  if (producao) return [frontendUrl]
  const gemea = frontendUrl.includes('//localhost')
    ? frontendUrl.replace('//localhost', '//127.0.0.1')
    : frontendUrl.replace('//127.0.0.1', '//localhost')
  return [...new Set([frontendUrl, gemea])]
}

export const env = {
  producao,
  emTeste,
  porta: Number(process.env.PORT ?? 3333),
  frontendUrl,
  origensDoFront: origensDoFront(),
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

  // Rua exata pelo OpenStreetMap (Nominatim). Nos testes fica desligado: nada sai da máquina.
  geocodificacaoExterna: !emTeste && process.env.GEOCODIFICACAO_EXTERNA !== 'false',
  nominatimUserAgent: process.env.NOMINATIM_USER_AGENT || 'DesapegaUai/1.0 (marketplace da Zona da Mata mineira)',

  // Notificação push (Web Push). Gere as chaves com: npx web-push generate-vapid-keys
  vapid: {
    publica: process.env.VAPID_PUBLIC_KEY ?? '',
    privada: process.env.VAPID_PRIVATE_KEY ?? '',
    contato: process.env.VAPID_CONTATO || 'https://github.com/DesapegaUai/DesapegaUai', // mailto: ou https:
  },

  silenciarLogs: emTeste,
  logRequisicoes: process.env.LOG_REQUISICOES === 'true',
}
