// Perfil público de um usuário: o que qualquer pessoa pode ver do vendedor.
// Telefone e e-mail não aparecem aqui; o contato é só pelo chat.
import * as anuncioModel from '../models/anuncioModel.js'
import { resumoDoUsuario } from '../models/comparecimentoModel.js'
import * as usuarioModel from '../models/usuarioModel.js'
import { estaOnline } from '../socket.js'
import { erroHttp } from '../utils/erroHttp.js'
import { lerId } from '../utils/validacao.js'

// GET /api/usuarios/:id
export async function verPerfilPublico(req, res) {
  const id = lerId(req.params.id, 'id do usuário')
  const usuario = await usuarioModel.buscarPerfilPublico(id)
  if (!usuario) throw erroHttp(404, 'Usuário não encontrado.')

  res.json({
    usuario: {
      ...usuario,
      total_anuncios_ativos: Number(usuario.total_anuncios_ativos),
      total_vendidos: Number(usuario.total_vendidos),
      online: estaOnline(id),
      compromisso: await resumoDoUsuario(id),
    },
    anuncios: await anuncioModel.listarCardsAtivosDoUsuario(id),
  })
}
