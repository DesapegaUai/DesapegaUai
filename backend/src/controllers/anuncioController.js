import { randomUUID } from 'node:crypto'
import { mkdir, unlink, rm } from 'node:fs/promises'
import sharp from 'sharp'

import * as anuncioModel from '../models/anuncioModel.js'
import * as fotoModel from '../models/fotoModel.js'

import { erroHttp } from '../utils/erroHttp.js'
import { lerId, lerTexto, lerOpcao } from '../utils/validacao.js'

import {
  pastaDoAnuncio,
  caminhoDaFoto,
  LARGURAS_FOTO,
  formatarFoto,
} from '../utils/fotos.js'

function validarPreco(valor) {
  if (valor === undefined || valor === null || valor === '') {
    throw erroHttp(400, 'O preço é obrigatório.')
  }

  const preco = Number(valor)

  if (!Number.isFinite(preco) || preco <= 0) {
    throw erroHttp(400, 'O preço precisa ser um número maior que zero.')
  }

  return preco
}

function lerSubcategoria(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return null
  }

  return lerId(valor, 'subcategoria_id')
}

function montarDadosPublicacao(body, usuarioId) {
  return {
    usuario_id: usuarioId,
    titulo: lerTexto(body.titulo, 'titulo', {
      obrigatorio: true,
      min: 3,
      max: 80,
    }),
    descricao: lerTexto(body.descricao, 'descricao', {
      max: 1000,
    }),
    preco: validarPreco(body.preco),
    categoria_id: lerId(body.categoria_id, 'categoria_id'),
    subcategoria_id: lerSubcategoria(body.subcategoria_id),
    bairro_id: lerId(body.bairro_id, 'bairro_id'),
    condicao: lerOpcao(
      body.condicao,
      'condicao',
      ['novo', 'seminovo', 'usado'],
      { obrigatorio: false }
    ),
    forma_entrega: lerOpcao(
      body.forma_entrega,
      'forma_entrega',
      ['retirada', 'combinar']
    ),
    localizacao: lerTexto(body.localizacao, 'localizacao', {
      max: 120,
    }),
  }
}

function montarDadosEdicao(body) {
  const dados = {}

  if (body.titulo !== undefined) {
    dados.titulo = lerTexto(body.titulo, 'titulo', {
      obrigatorio: true,
      min: 3,
      max: 80,
    })
  }

  if (body.descricao !== undefined) {
    dados.descricao = lerTexto(body.descricao, 'descricao', {
      max: 1000,
    })
  }

  if (body.preco !== undefined) {
    dados.preco = validarPreco(body.preco)
  }

  if (body.categoria_id !== undefined) {
    dados.categoria_id = lerId(body.categoria_id, 'categoria_id')
  }

  if (body.subcategoria_id !== undefined) {
    dados.subcategoria_id = lerSubcategoria(body.subcategoria_id)
  }

  if (body.bairro_id !== undefined) {
    dados.bairro_id = lerId(body.bairro_id, 'bairro_id')
  }

  if (body.condicao !== undefined) {
    dados.condicao = lerOpcao(
      body.condicao,
      'condicao',
      ['novo', 'seminovo', 'usado'],
      { obrigatorio: false }
    )
  }

  if (body.forma_entrega !== undefined) {
    dados.forma_entrega = lerOpcao(
      body.forma_entrega,
      'forma_entrega',
      ['retirada', 'combinar']
    )
  }

  if (body.localizacao !== undefined) {
    dados.localizacao = lerTexto(body.localizacao, 'localizacao', {
      max: 120,
    })
  }

  if (Object.keys(dados).length === 0) {
    throw erroHttp(400, 'Informe pelo menos um campo para editar.')
  }

  return dados
}

async function exigirDono(anuncioId, usuarioId) {
  const anuncio = await anuncioModel.buscarPorId(anuncioId)

  if (!anuncio) {
    throw erroHttp(404, 'Anúncio não encontrado.')
  }

  if (Number(anuncio.usuario_id) !== Number(usuarioId)) {
    throw erroHttp(403, 'Você não tem permissão para alterar este anúncio.')
  }

  return anuncio
}

async function formatarAnuncio(anuncio) {
  const fotos = await fotoModel.listarPorAnuncio(anuncio.id)

  return {
    ...anuncio,
    fotos: fotos.map((foto) => formatarFoto(anuncio.id, foto)),
  }
}

async function apagarArquivosFoto(anuncioId, arquivo) {
  for (const largura of LARGURAS_FOTO) {
    try {
      await unlink(caminhoDaFoto(anuncioId, arquivo, largura))
    } catch (erro) {
      if (erro.code !== 'ENOENT') {
        throw erro
      }
    }
  }
}

async function salvarFotos(anuncioId, arquivos, ordemInicial = 0) {
  const pasta = pastaDoAnuncio(anuncioId)
  await mkdir(pasta, { recursive: true })

  const fotosCriadas = []
  const arquivosGerados = []

  try {
    for (let i = 0; i < arquivos.length; i++) {
      const arquivo = randomUUID().replaceAll('-', '')
      const ordem = ordemInicial + i

      arquivosGerados.push(arquivo)

      for (const largura of LARGURAS_FOTO) {
        await sharp(arquivos[i].buffer)
          .rotate()
          .resize({
            width: largura,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toFile(caminhoDaFoto(anuncioId, arquivo, largura))
      }

      const fotoId = await fotoModel.criar({
        anuncio_id: anuncioId,
        arquivo,
        ordem,
      })

      fotosCriadas.push({ id: fotoId, arquivo })
    }

    return fotosCriadas
  } catch (erro) {
    for (const foto of fotosCriadas) {
      try {
        await fotoModel.excluir(foto.id, anuncioId)
      } catch {}
    }

    for (const arquivo of arquivosGerados) {
      try {
        await apagarArquivosFoto(anuncioId, arquivo)
      } catch {}
    }

    throw erro
  }
}

// GET /api/anuncios/:id
export async function verAnuncio(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')
  const anuncio = await anuncioModel.buscarPorId(id)

  if (!anuncio) {
    throw erroHttp(404, 'Anúncio não encontrado.')
  }

  res.json(await formatarAnuncio(anuncio))
}

// POST /api/anuncios
export async function publicar(req, res) {
  const arquivos = req.files ?? []

  if (arquivos.length === 0) {
    throw erroHttp(400, 'Envie pelo menos uma foto do anúncio.')
  }

  const dados = montarDadosPublicacao(req.body, req.usuario.id)
  const id = await anuncioModel.criar(dados)

  try {
    await salvarFotos(id, arquivos)
  } catch (erro) {
    await anuncioModel.excluir(id, req.usuario.id)
    throw erro
  }

  const anuncio = await anuncioModel.buscarPorId(id)

  res.status(201).json(await formatarAnuncio(anuncio))
}

// PUT /api/anuncios/:id
export async function editar(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')

  await exigirDono(id, req.usuario.id)

  const dados = montarDadosEdicao(req.body)

  await anuncioModel.atualizar(id, req.usuario.id, dados)

  const anuncio = await anuncioModel.buscarPorId(id)

  res.json(await formatarAnuncio(anuncio))
}

// PATCH /api/anuncios/:id/status
export async function mudarStatus(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')

  await exigirDono(id, req.usuario.id)

  const status = lerOpcao(
    req.body.status,
    'status',
    ['ativo', 'vendido']
  )

  await anuncioModel.mudarStatus(id, req.usuario.id, status)

  const anuncio = await anuncioModel.buscarPorId(id)

  res.json(await formatarAnuncio(anuncio))
}

// DELETE /api/anuncios/:id
export async function excluir(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')

  await exigirDono(id, req.usuario.id)

  const removido = await anuncioModel.excluir(id, req.usuario.id)

  if (!removido) {
    throw erroHttp(404, 'Anúncio não encontrado.')
  }

  await rm(pastaDoAnuncio(id), { recursive: true, force: true })

  res.json({ mensagem: 'Anúncio excluído com sucesso.' })
}

// POST /api/anuncios/:id/fotos
export async function adicionarFotos(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')

  await exigirDono(id, req.usuario.id)

  const arquivos = req.files ?? []

  if (arquivos.length === 0) {
    throw erroHttp(400, 'Envie pelo menos uma foto.')
  }

  const ordem = await fotoModel.proximaOrdem(id)

  await salvarFotos(id, arquivos, ordem)

  const anuncio = await anuncioModel.buscarPorId(id)

  res.json(await formatarAnuncio(anuncio))
}

// DELETE /api/anuncios/:id/fotos/:fotoId
export async function removerFoto(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')
  const fotoId = lerId(req.params.fotoId, 'id da foto')

  await exigirDono(id, req.usuario.id)

  const foto = await fotoModel.buscarPorId(fotoId, id)

  if (!foto) {
    throw erroHttp(404, 'Foto não encontrada neste anúncio.')
  }

  await fotoModel.excluir(fotoId, id)
  await apagarArquivosFoto(id, foto.arquivo)

  const anuncio = await anuncioModel.buscarPorId(id)

  res.json(await formatarAnuncio(anuncio))
}

// GET /api/meus-anuncios
export async function meusAnuncios(req, res) {
  const anuncios = await anuncioModel.listarPorUsuario(req.usuario.id)

  const resultado = await Promise.all(
    anuncios.map((anuncio) => formatarAnuncio(anuncio))
  )

  res.json(resultado)
}