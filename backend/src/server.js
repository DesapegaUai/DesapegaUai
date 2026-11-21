import { app } from './app.js'
import { env } from './config/env.js'
import { aplicarRetencao } from './services/localizacaoService.js'
import { iniciarSocket } from './socket.js'

const servidor = app.listen(env.porta, (erro) => {
  if (erro) {
    console.error(
      `Não foi possível iniciar a API na porta ${env.porta}:`,
      erro.message,
    )

    process.exit(1)
  }

  console.log(
    `API do DesapegaUai rodando em http://localhost:${env.porta}/api/saude (documentação em /api/docs)`,
  )
})

iniciarSocket(servidor)

// LGPD: localização de usuário parada há mais de 30 dias é apagada (ao subir e a cada 6 horas)
const retencao = () => aplicarRetencao().catch((erro) => console.error('Erro na retenção de localizações:', erro.message))
retencao()
setInterval(retencao, 6 * 60 * 60 * 1000).unref()
