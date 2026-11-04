import { app } from './app.js'
import { env } from './config/env.js'

app.listen(env.porta, (erro) => {
  if (erro) {
    console.error(`Não foi possível iniciar a API na porta ${env.porta}:`, erro.message)
    process.exit(1)
  }
  console.log(`API do DesapegaUai rodando em http://localhost:${env.porta}/api/saude`)
})
