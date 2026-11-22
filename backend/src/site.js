// Em produção a API também entrega o site (o build do front, em frontend/dist). Assim o site e a
// API ficam no mesmo endereço: o cookie de login (sameSite lax) funciona e não precisa de CORS.
// No seu computador quem entrega o site é o Vite (npm run dev no frontend).
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { env } from './config/env.js'

// PASTA_DO_SITE no ambiente troca o lugar do build
const PASTA_DO_SITE = process.env.PASTA_DO_SITE
  ? path.resolve(process.env.PASTA_DO_SITE)
  : path.join(import.meta.dirname, '..', '..', 'frontend', 'dist')

const UM_ANO = 365 * 24 * 60 * 60

// O que as telas podem carregar. O padrão do helmet (pensado para a API) bloquearia o botão do
// Google, o mapa e a prévia das fotos, então o site tem a sua própria lista.
function politicaDeConteudo(frontendUrl) {
  let tempoReal = ''
  try {
    tempoReal = ` wss://${new URL(frontendUrl).host}` // Socket.IO (navegador antigo não aceita o 'self' para wss)
  } catch {
    // FRONTEND_URL inválido: fica só o 'self'
  }
  return [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com/gsi/client",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
    // data: ícones do CSS; blob: prévia da foto antes de enviar; mapa; foto da conta Google
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.googleusercontent.com",
    "font-src 'self' data:",
    `connect-src 'self' https://accounts.google.com/gsi/${tempoReal}`,
    'frame-src https://accounts.google.com/gsi/',
    "media-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

// Devolve o middleware que entrega o site, ou null se o build não existe (API sozinha).
export function entregarSite({ pasta = PASTA_DO_SITE, frontendUrl = env.frontendUrl } = {}) {
  const paginaInicial = path.join(pasta, 'index.html')
  if (!fs.existsSync(paginaInicial)) return null

  const politica = politicaDeConteudo(frontendUrl)
  const arquivos = express.static(pasta, {
    index: false,
    redirect: false,
    setHeaders: (res, arquivo) => {
      // o Vite põe um código no nome de tudo o que está em assets/: pode guardar por 1 ano
      const comCodigoNoNome = path.relative(pasta, arquivo).split(path.sep)[0] === 'assets'
      res.set('Cache-Control', comCodigoNoNome ? `public, max-age=${UM_ANO}, immutable` : 'no-cache')
    },
  })

  return (req, res, next) => {
    const daApi = req.path === '/api' || req.path.startsWith('/api/')
    if (daApi || (req.method !== 'GET' && req.method !== 'HEAD')) return next()

    res.set('Content-Security-Policy', politica)
    // o login do Google abre uma janela e confere de qual site veio o pedido
    res.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    arquivos(req, res, () => {
      // arquivo que não existe (/img/nada.png) é 404; o resto é tela do site (React Router)
      if (path.extname(req.path)) return next()
      res.set('Cache-Control', 'no-cache')
      res.sendFile(paginaInicial)
    })
  }
}
