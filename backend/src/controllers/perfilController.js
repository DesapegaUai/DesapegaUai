// telefone e e-mail só aparecem aqui, para o próprio dono (LGPD)
import * as usuarioModel from '../models/usuarioModel.js'
import { erroHttp } from '../utils/erroHttp.js'
import { lerTexto } from '../utils/validacao.js'

// GET /api/perfil
export async function verPerfil(req, res) {
  const perfil = await usuarioModel.buscarPerfil(req.usuario.id)
  if (!perfil) throw erroHttp(404, 'Usuário não encontrado.')
  res.json(perfil)
}

// PUT /api/perfil: campo que não vier fica como está; telefone ou bio vazios apagam
export async function editarPerfil(req, res) {
  const corpo = req.body ?? {}
  if (typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw erroHttp(400, 'Envie um JSON com nome, telefone e/ou bio.')
  }

  const atual = await usuarioModel.buscarPerfil(req.usuario.id)
  if (!atual) throw erroHttp(404, 'Usuário não encontrado.')

  const nome =
    'nome' in corpo ? lerTexto(corpo.nome, 'nome', { obrigatorio: true, min: 2, max: 120 }) : atual.nome
  const telefone = 'telefone' in corpo ? lerTelefone(corpo.telefone) : atual.telefone
  const bio = 'bio' in corpo ? lerTexto(corpo.bio, 'bio', { max: 300 }) : atual.bio

  await usuarioModel.atualizarPerfil(req.usuario.id, { nome, telefone, bio })
  res.json(await usuarioModel.buscarPerfil(req.usuario.id))
}

// guarda só os números (DDD + número)
function lerTelefone(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null
  if (typeof valor !== 'string' && typeof valor !== 'number') {
    throw erroHttp(400, 'O campo telefone precisa ser um texto.')
  }
  const digitos = String(valor).replace(/\D/g, '')
  if (digitos.length < 10 || digitos.length > 11) {
    throw erroHttp(400, 'O telefone precisa ter DDD e número: 10 ou 11 dígitos.')
  }
  return digitos
}
