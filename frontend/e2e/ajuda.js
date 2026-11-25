// Auxiliares dos testes de navegador.
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { expect } from '@playwright/test'

// o banco dos testes (o de conferência, recriado pelo playwright.config.js), para preparar o que a API não
// faz sozinha (ex.: uma conta de teste a mais). O usuário e a senha vêm do backend/.env, lidos sem mostrar.
export async function bancoDosTestes() {
  const mysql = createRequire(path.resolve('../backend/package.json'))('mysql2/promise')
  const env = {}
  for (const linha of readFileSync(path.resolve('../backend/.env'), 'utf8').split(/\r?\n/)) {
    const achou = /^\s*(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD)\s*=\s*(.*?)\s*$/.exec(linha)
    if (achou) env[achou[1]] = achou[2].replace(/^["']|["']$/g, '')
  }
  return mysql.createConnection({
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: process.env.E2E_DB_NAME || 'desapegauai_conferencia',
  })
}

// vídeo MP4 de verdade (2 s de barras coloridas), gerado na hora com o ffmpeg da API: a moderação abre o
// vídeo e confere os quadros, então um arquivo que só começa como MP4 não passa
export function videoDeTeste() {
  const ffmpeg = createRequire(path.resolve('../backend/package.json'))('ffmpeg-static')
  const arquivo = path.join(os.tmpdir(), `desapegauai-e2e-video-${process.pid}.mp4`)
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=15',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', arquivo])
  const dados = readFileSync(arquivo)
  rmSync(arquivo, { force: true })
  return dados
}

export const CENTRO_VICOSA = { latitude: -20.752736, longitude: -42.881906, accuracy: 15 }

// entra com um usuário de teste (1 Diego, 2 Larissa, 3 Usuário Teste) usando os cookies do navegador
export async function entrarComo(page, usuarioId) {
  const resposta = await page.request.post('/api/auth/teste', { data: { usuario_id: usuarioId } })
  expect(resposta.ok()).toBeTruthy()
}

// o mapa vem da internet (OpenStreetMap): nos testes não carrega os quadrinhos
export async function semMapaDaInternet(page) {
  await page.route(/tile\.openstreetmap\.org/, (rota) => rota.fulfill({ status: 204, body: '' }))
}

// guarda os erros de JavaScript e do console para o teste conferir no fim
export function vigiarErros(page) {
  const erros = []
  page.on('pageerror', (erro) => {
    // Safari: pedido cancelado porque o teste já foi para a tela seguinte (não é erro do site)
    if (/due to access control checks/.test(erro.message)) return
    erros.push(`erro de página: ${erro.message}`)
  })
  page.on('console', (mensagem) => {
    if (mensagem.type() !== 'error') return
    const texto = mensagem.text()
    if (/tile\.openstreetmap|favicon|status of 204/.test(texto)) return
    erros.push(`console: ${texto}`)
  })
  return erros
}

export async function criarAnuncioPelaApi(page, campos = {}) {
  const resposta = await page.request.post('/api/anuncios', {
    multipart: {
      titulo: 'Anúncio criado pelo teste E2E',
      preco: '150',
      categoria_id: '1',
      subcategoria_id: '1',
      bairro_id: '1',
      condicao: 'usado',
      forma_entrega: 'retirada',
      ...campos,
      fotos: { name: 'foto.png', mimeType: 'image/png', buffer: FOTO_PNG },
    },
  })
  expect(resposta.status(), await resposta.text()).toBe(201)
  return resposta.json()
}

// PNG verde de 64x48, só para o envio de foto
export const FOTO_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAfUlEQVRoge2SAQkAURSDlsUgFrzSF2M8/sAAOhY/TpO6gQugvqK7EHdJ3cAFUF/RXYi7pG7gAqiv6C7EXVI3cAHUV3QX4i6pG7gA6iu6C3GX1A1cAPUV3YW4S+oGLoD6iu5C3CV1AxdAfUV3Ie6SuoELoL6iuxB3Sd3AxwN+gqMEprWuWQgAAAAASUVORK5CYII=', 'base64')

// simula a pessoa negando a permissão do GPS (o navegador de teste não nega sozinho)
export async function negarGps(page) {
  await page.addInitScript(() => {
    const negar = (sucesso, falha) => setTimeout(() => falha?.({ code: 1, message: 'User denied Geolocation' }), 50)
    navigator.geolocation.watchPosition = (s, f) => { negar(s, f); return 1 }
    navigator.geolocation.getCurrentPosition = negar
  })
}

// simula o GPS desligado ou sem sinal
export async function gpsIndisponivel(page) {
  await page.addInitScript(() => {
    const falhar = (sucesso, falha) => setTimeout(() => falha?.({ code: 2, message: 'Position unavailable' }), 50)
    navigator.geolocation.watchPosition = (s, f) => { falhar(s, f); return 1 }
    navigator.geolocation.getCurrentPosition = falhar
  })
}
