// Excluir uma conta inteira: sai do banco a conta com os anúncios, as fotos, as conversas, as avaliações,
// os pedidos e os avisos (ON DELETE CASCADE), e saem do disco a foto de perfil, as fotos dos anúncios e as
// fotos dos chats. Usado pelo "Excluir minha conta" (DELETE /api/perfil) e pela limpeza das contas de
// demonstração (npm run remover-demonstracao).
import * as usuarioModel from '../models/usuarioModel.js'
import { publicarParaTodos } from '../socket.js'
import { apagarDoDisco } from '../utils/arquivos.js'
import { pastaDaConversa, pastaDoAnuncio, pastaDoPerfil } from '../utils/fotos.js'
import { registrar } from '../utils/log.js'

export async function excluirContaComFotos(usuarioId, motivo = 'pedido_do_usuario') {
  // a lista vem antes: depois de apagar a conta o banco não sabe mais de quem eram as pastas
  const { anuncios, conversas } = await usuarioModel.pastasDaConta(usuarioId)
  const excluida = await usuarioModel.excluirConta(usuarioId)

  await apagarDoDisco(pastaDoPerfil(usuarioId), { tipo: 'pasta_perfil', usuario_id: usuarioId })
  for (const anuncioId of anuncios) {
    await apagarDoDisco(pastaDoAnuncio(anuncioId), { tipo: 'pasta_anuncio', anuncio_id: anuncioId })
    publicarParaTodos('anuncio_removido', { id: anuncioId, motivo: 'excluido' })
  }
  for (const conversaId of conversas) {
    await apagarDoDisco(pastaDaConversa(conversaId), { tipo: 'pasta_conversa', conversa_id: conversaId })
  }

  registrar('conta.excluida', { usuario_id: usuarioId, motivo, anuncios: anuncios.length, conversas: conversas.length })
  return { excluida, anuncios: anuncios.length, conversas: conversas.length }
}
