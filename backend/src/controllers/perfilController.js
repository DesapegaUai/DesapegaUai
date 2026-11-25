import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

// telefone e e-mail só aparecem aqui, para o próprio dono (LGPD)
import * as usuarioModel from '../models/usuarioModel.js'
import { excluirContaComFotos } from '../services/exclusaoDeConta.js'
import { exigirFotoPermitida } from '../services/moderacaoDeImagem.js'
import { exigirTextoPermitido } from '../services/moderacaoDeTexto.js'
import { apagarDoDisco } from '../utils/arquivos.js'
import { erroHttp } from '../utils/erroHttp.js'
import { apagarCookieDeLogin } from '../utils/token.js'
import { lerTexto } from '../utils/validacao.js'
import { caminhoDaFotoDePerfil, pastaDoPerfil } from '../utils/fotos.js'
import { publicarParaTodos } from '../socket.js'

const FORMATOS_DE_FOTO = ['jpeg', 'png', 'webp']
const MAXIMO_DE_PIXELS = 40_000_000

// GET /api/perfil
// nome e foto são públicos (aparecem no perfil, nos anúncios, nas avaliações e no chat): quem mudou
// avisa todo mundo com o site aberto, e cada tela troca na hora, sem ficar com o dado antigo
function avisarQuePerfilMudou(perfil) {
  publicarParaTodos('perfil_atualizado', { id: perfil.id, nome: perfil.nome, foto_url: perfil.foto_url ?? null })
}

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
  // só o que a pessoa mandou agora (o nome que veio da conta Google não é conferido de novo a cada edição)
  exigirTextoPermitido({ ...('nome' in corpo ? { nome } : {}), ...('bio' in corpo ? { bio } : {}) }, { onde: 'perfil', usuarioId: req.usuario.id })

  await usuarioModel.atualizarPerfil(req.usuario.id, { nome, telefone, bio })
  const perfil = await usuarioModel.buscarPerfil(req.usuario.id)
  avisarQuePerfilMudou(perfil)
  res.json(perfil)
}

// PUT /api/perfil/foto: a foto de perfil é independente da imagem da conta Google.
export async function atualizarFoto(req, res) {
  if (!req.file) throw erroHttp(400, 'Selecione uma foto de perfil.')

  const usuarioId = req.usuario.id
  const perfilAtual = await usuarioModel.buscarPerfil(usuarioId)
  if (!perfilAtual) throw erroHttp(404, 'Usuário não encontrado.')

  let formato
  try {
    const metadados = await sharp(req.file.buffer, { limitInputPixels: MAXIMO_DE_PIXELS }).metadata()
    formato = metadados.format
  } catch {
    throw erroHttp(400, 'A foto não é válida. Envie uma imagem JPG, PNG ou WebP.')
  }
  if (!FORMATOS_DE_FOTO.includes(formato)) {
    throw erroHttp(400, 'Envie somente fotos JPG, PNG ou WebP.')
  }
  // a IA confere a foto: nudez ou conteúdo sexual é recusado (422)
  await exigirFotoPermitida(req.file.buffer, { onde: 'perfil', usuarioId })

  let imagem
  try {
    imagem = await sharp(req.file.buffer, { limitInputPixels: MAXIMO_DE_PIXELS })
      .rotate()
      .resize(512, 512, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer()
  } catch {
    throw erroHttp(400, 'A foto não pôde ser processada. Tente outra imagem.')
  }

  const arquivo = `${randomUUID().replaceAll('-', '')}.webp`
  const caminho = caminhoDaFotoDePerfil(usuarioId, arquivo)
  await mkdir(pastaDoPerfil(usuarioId), { recursive: true })
  await writeFile(caminho, imagem)

  const fotoUrl = `/api/uploads/perfis/${usuarioId}/${arquivo}`
  try {
    await usuarioModel.atualizarFotoPerfil(usuarioId, fotoUrl)
  } catch (erro) {
    await rm(caminho, { force: true }).catch((falhaAoLimpar) => {
      console.error('Não foi possível limpar o novo arquivo de foto de perfil após falha no banco.', falhaAoLimpar)
    })
    throw erro
  }

  // a foto de antes sai do disco: o banco já aponta para a nova
  const anterior = /^\/api\/uploads\/perfis\/(\d+)\/([a-f0-9]{32}\.webp)$/.exec(perfilAtual.foto_url ?? '')
  if (anterior && Number(anterior[1]) === Number(usuarioId)) {
    await apagarDoDisco(caminhoDaFotoDePerfil(usuarioId, anterior[2]), { tipo: 'foto_perfil', usuario_id: usuarioId })
  }

  const perfil = await usuarioModel.buscarPerfil(usuarioId)
  avisarQuePerfilMudou(perfil)
  res.json(perfil)
}

// DELETE /api/perfil/foto: volta a exibir as iniciais e apaga uploads próprios.
export async function removerFoto(req, res) {
  const usuarioId = req.usuario.id
  const perfilAtual = await usuarioModel.buscarPerfil(usuarioId)
  if (!perfilAtual) throw erroHttp(404, 'Usuário não encontrado.')

  await usuarioModel.atualizarFotoPerfil(usuarioId, null)

  const anterior = /^\/api\/uploads\/perfis\/(\d+)\/([a-f0-9]{32}\.webp)$/.exec(perfilAtual.foto_url ?? '')
  if (anterior && Number(anterior[1]) === Number(usuarioId)) {
    await apagarDoDisco(caminhoDaFotoDePerfil(usuarioId, anterior[2]), { tipo: 'foto_perfil', usuario_id: usuarioId })
  }

  const perfil = await usuarioModel.buscarPerfil(usuarioId)
  avisarQuePerfilMudou(perfil)
  res.json(perfil)
}

// DELETE /api/perfil  { confirmar: "EXCLUIR" }
// Excluir a conta (LGPD): saem do banco a conta, os anúncios, as fotos, as conversas, as avaliações e
// os avisos da pessoa, e saem do disco a foto de perfil, as fotos dos anúncios e as fotos dos chats.
export async function excluirConta(req, res) {
  if (req.body?.confirmar !== 'EXCLUIR') {
    throw erroHttp(400, 'Para excluir a conta, envie o campo confirmar com o valor EXCLUIR.')
  }

  await excluirContaComFotos(req.usuario.id)
  apagarCookieDeLogin(res)
  res.status(204).end()
}

// guarda só os números (DDD + número)
function lerTelefone(valor) {
  if (valor === undefined || valor === null) return null
  if (typeof valor !== 'string' && typeof valor !== 'number') {
    throw erroHttp(400, 'O campo telefone precisa ser um texto.')
  }
  if (String(valor).trim() === '') return null
  const digitos = String(valor).replace(/\D/g, '')
  if (digitos.length < 10 || digitos.length > 11) {
    throw erroHttp(400, 'O telefone precisa ter DDD e número: 10 ou 11 dígitos.')
  }
  return digitos
}
