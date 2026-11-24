// Testes de ponta a ponta (E2E) no navegador: npm run e2e
// Sobem uma API e um site só para os testes (portas 3334 e 5174), com o banco de conferência
// recriado do zero, para não mexer no banco de desenvolvimento.
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const BANCO_DOS_TESTES = process.env.E2E_DB_NAME || 'desapegauai_conferencia'
// as fotos dos testes ficam fora das fotos do site
const PASTA_DOS_TESTES = path.join(os.tmpdir(), 'desapegauai-e2e')

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-relatorio' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // microfone de mentira (faz bipes) e sem a pergunta de permissão: é o que deixa testar o áudio do chat
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } } },
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' }, testMatch: /compatibilidade/ },
    { name: 'celular', use: { ...devices['Pixel 7'], channel: 'chrome' }, testMatch: /compatibilidade/ },
    { name: 'tablet', use: { ...devices['Galaxy Tab S4'], channel: 'chrome' }, testMatch: /compatibilidade/ },
  ],
  webServer: [
    {
      command: 'npm run banco && node src/server.js',
      cwd: '../backend',
      url: 'http://127.0.0.1:3334/api/saude',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { DB_NAME: BANCO_DOS_TESTES, PORT: '3334', FRONTEND_URL: 'http://127.0.0.1:5174', PERMITIR_LOGIN_TESTE: 'true', GEOCODIFICACAO_EXTERNA: 'false', PASTA_UPLOADS: path.join(PASTA_DOS_TESTES, 'uploads'), PASTA_UPLOADS_PRIVADOS: path.join(PASTA_DOS_TESTES, 'uploads-privados') },
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_PROXY: 'http://127.0.0.1:3334' },
    },
  ],
})
