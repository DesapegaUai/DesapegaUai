import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

import { MAXIMO_DE_FOTOS } from '../middlewares/upload.js'
import * as anuncioModel from '../models/anuncioModel.js'
import * as favoritoModel from '../models/favoritoModel.js'
import * as fotoModel from '../models/fotoModel.js'

import { erroHttp } from '../utils/erroHttp.js'
import { lerId, lerTexto, lerOpcao } from '../utils/validacao.js'

import {
  pastaDoAnuncio,
  caminhoDaFoto,
  LARGURAS_FOTO,
  formatarFoto,
} from '../utils/fotos.js'

const CONDICOES = ['novo', 'seminovo', 'usado']
const FORMAS_DE_ENTREGA = ['retirada', 'combinar']
const CAMPOS_DO_ANUNCIO = [
  'titulo',
  'descricao',
  'preco',
  'categoria_id',
  'subcategoria_id',
  'bairro_id',
  'condicao',
  'forma_entrega',
  'localizacao',
]
const MAIOR_PRECO = 99_999_999.99 // DECIMAL(10,2) do banco
const FORMATOS_ACEITOS = ['jpeg', 'png', 'webp']

function vazio(valor) {
  return valor === undefined || valor === null || valor === ''
}

// No Express 5, sem corpo o req.body fica undefined
function lerCorpo(corpo) {
  if (corpo === undefined || corpo === null) return {}

  if (typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw erroHttp(400, 'Envie os dados do anúncio em JSON.')
  }

  return corpo
}

function validarPreco(valor) {
  if (vazio(valor) || (typeof valor === 'string' && valor.trim() === '')) {
    throw erroHttp(400, 'O preço é obrigatório.')
  }

  if (typeof valor !== 'string' && typeof valor !== 'number') {
    throw erroHttp(400, 'O preço precisa ser um número.')
  }

  // arredonda em centavos como o banco; 0.001 viraria 0,00
  const preco = Math.round(Number(valor) * 100) / 100

  if (!Number.isFinite(preco) || preco <= 0 || preco > MAIOR_PRECO) {
    throw erroHttp(400, 'O preço precisa ser um número maior que zero e até 99999999.99.')
  }

  return preco
}

// As regras do M1, iguais na publicação e na edição. Confere no banco se a categoria, a
// subcategoria e o bairro existem: sem isso, o MySQL recusa e a API responde 500.
async function validarAnuncio(corpo) {
  const dados = {
    titulo: lerTexto(corpo.titulo, 'titulo', { obrigatorio: true, min: 3, max: 80 }),
    descricao: lerTexto(corpo.descricao, 'descricao', { max: 1000 }),
    preco: validarPreco(corpo.preco),
    categoria_id: lerId(corpo.categoria_id, 'categoria_id'),
    subcategoria_id: vazio(corpo.subcategoria_id) ? null : lerId(corpo.subcategoria_id, 'subcategoria_id'),
    bairro_id: lerId(corpo.bairro_id, 'bairro_id'),
    condicao: null,
    forma_entrega: lerOpcao(corpo.forma_entrega, 'forma_entrega', FORMAS_DE_ENTREGA),
    localizacao: lerTexto(corpo.localizacao, 'localizacao', { max: 120 }),
  }

  const categoria = await anuncioModel.buscarCategoria(dados.categoria_id)

  if (!categoria) {
    throw erroHttp(400, 'Categoria não encontrada.')
  }

  // a condição é obrigatória, menos em Serviços
  dados.condicao = lerOpcao(corpo.condicao, 'condicao', CONDICOES, {
    obrigatorio: categoria.slug !== 'servicos',
  })

  if (
    dados.subcategoria_id &&
    !(await anuncioModel.subcategoriaEhDaCategoria(dados.subcategoria_id, dados.categoria_id))
  ) {
    throw erroHttp(400, 'Essa subcategoria não é da categoria escolhida.')
  }

  if (!(await anuncioModel.bairroExiste(dados.bairro_id))) {
    throw erroHttp(400, 'Bairro não encontrado.')
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

// Formato do M2. Sem login, favoritado e eh_meu vêm false.
async function montarDetalhe(anuncioId, usuarioId) {
  const anuncio = await anuncioModel.buscarDetalhe(anuncioId)

  if (!anuncio) {
    return null
  }

  const fotos = await fotoModel.listarPorAnuncio(anuncioId)

  return {
    ...anuncio,
    fotos: fotos.map((foto) => formatarFoto(anuncioId, foto)),
    favoritado: usuarioId ? await favoritoModel.existe(usuarioId, anuncioId) : false,
    eh_meu: Number(usuarioId) === anuncio.vendedor.id,
  }
}

// Converte tudo antes de gravar: foto que não abre vira 400 antes de criar qualquer coisa.
// O tipo que o navegador manda pode mentir, então o sharp confere o formato de verdade.
// Cada foto vira 3 WebP (400, 800 e 1600 px), sem aumentar foto pequena. O sharp descarta
// o EXIF (inclusive o GPS), por isso o .rotate() vem antes, senão foto de celular sai deitada.
async function converterFotos(arquivos) {
  const fotos = []

  for (const arquivo of arquivos) {
    try {
      const { format } = await sharp(arquivo.buffer).metadata()

      if (!FORMATOS_ACEITOS.includes(format)) {
        throw new Error(`formato ${format}`)
      }

      const tamanhos = []

      for (const largura of LARGURAS_FOTO) {
        const webp = await sharp(arquivo.buffer)
          .rotate()
          .resize({ width: largura, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer()

        tamanhos.push({ largura, webp })
      }

      fotos.push({ arquivo: randomUUID().replaceAll('-', ''), tamanhos })
    } catch {
      throw erroHttp(400, 'Uma das fotos não abriu. Envie fotos JPG, PNG ou WebP.')
    }
  }

  return fotos
}

async function gravarFotos(conexao, anuncioId, fotos, ordemInicial) {
  await mkdir(pastaDoAnuncio(anuncioId), { recursive: true })

  for (const [i, foto] of fotos.entries()) {
    for (const { largura, webp } of foto.tamanhos) {
      await writeFile(caminhoDaFoto(anuncioId, foto.arquivo, largura), webp)
    }

    await fotoModel.criar(
      { anuncio_id: anuncioId, arquivo: foto.arquivo, ordem: ordemInicial + i },
      conexao,
    )
  }
}

async function apagarArquivosFoto(anuncioId, arquivo) {
  for (const largura of LARGURAS_FOTO) {
    await rm(caminhoDaFoto(anuncioId, arquivo, largura), { force: true })
  }
}

// GET /api/anuncios/:id
export async function verAnuncio(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')
  const usuarioId = req.usuario?.id ?? null

  await anuncioModel.somarVisualizacao(id, usuarioId)

  const anuncio = await montarDetalhe(id, usuarioId)

  if (!anuncio) {
    throw erroHttp(404, 'Anúncio não encontrado.')
  }

  res.json(anuncio)
}

// POST /api/anuncios
export async function publicar(req, res) {
  const arquivos = req.files ?? []

  if (arquivos.length === 0) {
    throw erroHttp(400, 'Envie pelo menos uma foto do anúncio.')
  }

  const dados = await validarAnuncio(req.body ?? {})
  const fotos = await converterFotos(arquivos)

  // anúncio e fotos numa transação: se algo falhar, não fica anúncio sem foto nem pasta perdida
  let id

  try {
    await anuncioModel.emTransacao(async (conexao) => {
      id = await anuncioModel.criar({ ...dados, usuario_id: req.usuario.id }, conexao)
      await gravarFotos(conexao, id, fotos, 0)
    })
  } catch (erro) {
    if (id) {
      await rm(pastaDoAnuncio(id), { recursive: true, force: true })
    }

    throw erro
  }

  res.status(201).json(await montarDetalhe(id, req.usuario.id))
}

// PUT /api/anuncios/:id
export async function editar(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')
  const atual = await exigirDono(id, req.usuario.id)
  const corpo = lerCorpo(req.body)

  const enviados = CAMPOS_DO_ANUNCIO.filter((campo) => Object.hasOwn(corpo, campo))

  if (enviados.length === 0) {
    throw erroHttp(400, 'Informe pelo menos um campo para editar.')
  }

  // junta o que veio com o que já estava e valida o anúncio inteiro, com as regras do M1
  const novo = { ...atual }

  for (const campo of enviados) {
    novo[campo] = corpo[campo]
  }

  // trocou a categoria sem mandar subcategoria: a antiga é de outra categoria
  if (
    enviados.includes('categoria_id') &&
    !enviados.includes('subcategoria_id') &&
    String(corpo.categoria_id) !== String(atual.categoria_id)
  ) {
    novo.subcategoria_id = null
  }

  const dados = await validarAnuncio(novo)

  await anuncioModel.atualizar(id, req.usuario.id, dados)

  res.json(await montarDetalhe(id, req.usuario.id))
}

// PATCH /api/anuncios/:id/status
export async function mudarStatus(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')

  await exigirDono(id, req.usuario.id)

  const status = lerOpcao(lerCorpo(req.body).status, 'status', ['ativo', 'vendido'])

  await anuncioModel.mudarStatus(id, req.usuario.id, status)

  res.json(await montarDetalhe(id, req.usuario.id))
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

  res.status(204).end()
}

// POST /api/anuncios/:id/fotos
export async function adicionarFotos(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')

  await exigirDono(id, req.usuario.id)

  const arquivos = req.files ?? []

  if (arquivos.length === 0) {
    throw erroHttp(400, 'Envie pelo menos uma foto.')
  }

  const fotos = await converterFotos(arquivos)

  try {
    await anuncioModel.emTransacao(async (conexao) => {
      if (!(await anuncioModel.travar(id, conexao))) {
        throw erroHttp(404, 'Anúncio não encontrado.')
      }

      const atuais = await fotoModel.listarPorAnuncio(id, conexao)

      if (atuais.length + fotos.length > MAXIMO_DE_FOTOS) {
        throw erroHttp(
          400,
          `O anúncio pode ter no máximo ${MAXIMO_DE_FOTOS} fotos e já tem ${atuais.length}.`,
        )
      }

      const proximaOrdem = atuais.length > 0 ? atuais.at(-1).ordem + 1 : 0

      await gravarFotos(conexao, id, fotos, proximaOrdem)
    })
  } catch (erro) {
    for (const foto of fotos) {
      await apagarArquivosFoto(id, foto.arquivo)
    }

    throw erro
  }

  res.json(await montarDetalhe(id, req.usuario.id))
}

// DELETE /api/anuncios/:id/fotos/:fotoId
export async function removerFoto(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')
  const fotoId = lerId(req.params.fotoId, 'id da foto')

  await exigirDono(id, req.usuario.id)

  const removida = await anuncioModel.emTransacao(async (conexao) => {
    if (!(await anuncioModel.travar(id, conexao))) {
      throw erroHttp(404, 'Anúncio não encontrado.')
    }

    const fotos = await fotoModel.listarPorAnuncio(id, conexao)
    const foto = fotos.find((item) => item.id === fotoId)

    if (!foto) {
      throw erroHttp(404, 'Foto não encontrada neste anúncio.')
    }

    if (fotos.length === 1) {
      throw erroHttp(400, 'O anúncio precisa ter pelo menos 1 foto.')
    }

    await fotoModel.excluir(fotoId, id, conexao)

    // renumera 0, 1, 2...: se a capa (ordem 0) saiu, a próxima vira capa
    const restantes = fotos.filter((item) => item.id !== fotoId)

    for (const [ordem, item] of restantes.entries()) {
      if (item.ordem !== ordem) {
        await fotoModel.mudarOrdem(item.id, ordem, conexao)
      }
    }

    return foto
  })

  await apagarArquivosFoto(id, removida.arquivo)

  res.json(await montarDetalhe(id, req.usuario.id))
}

// GET /api/meus-anuncios
export async function meusAnuncios(req, res) {
  res.json(await anuncioModel.listarCardsDoUsuario(req.usuario.id))
}
