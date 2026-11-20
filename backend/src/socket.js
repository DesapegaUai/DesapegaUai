import { Server } from 'socket.io'
import { env } from './config/env.js'
import { lerTokenDoCookie, verificarToken } from './utils/token.js'
import { salvarMensagem } from './models/mensagemModel.js'

let io = null

export function iniciarSocket(servidor) {
  io = new Server(servidor, {
    path: '/api/socket.io',
    cors: {
      origin: env.frontendUrl,
      credentials: true,
    },
  })

  // Confere o login antes de aceitar a conexão.
  io.use((socket, next) => {
    const cookie = socket.handshake.headers.cookie
    const token = lerTokenDoCookie(cookie)
    const usuarioId = verificarToken(token)

    if (!usuarioId) {
      return next(new Error('Faça login para continuar.'))
    }

    socket.data.usuarioId = usuarioId
    next()
  })

  io.on('connection', (socket) => {
    const usuarioId = socket.data.usuarioId

    // Cada usuário tem sua própria sala.
    socket.join('usuario:' + usuarioId)

    socket.on('enviar_mensagem', async (dados, responder) => {
      // O front deve enviar uma função para receber a confirmação.
      if (typeof responder !== 'function') {
        return
      }

      try {
        const resultado = await salvarMensagem(
          dados?.conversa_id,
          usuarioId,
          dados?.texto,
        )

        avisarUsuarios(
          resultado.participantes,
          'nova_mensagem',
          resultado.mensagem,
        )

        responder({
          ok: true,
          mensagem: resultado.mensagem,
        })
      } catch (erro) {
        let mensagem = 'Não foi possível enviar a mensagem.'

        if (erro.status >= 400 && erro.status < 500) {
          mensagem = erro.message
        } else {
          console.error('Erro ao enviar mensagem pelo socket:', erro)
        }

        responder({
          ok: false,
          erro: mensagem,
        })
      }
    })
  })
}

export function avisarUsuarios(ids, evento, dados) {
  // Permite que o REST funcione mesmo sem o socket iniciado.
  if (!io) {
    return
  }

  const salas = []

  for (const id of ids) {
    salas.push('usuario:' + id)
  }

  io.to(salas).emit(evento, dados)
}