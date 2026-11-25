import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

import { MAXIMO_DE_FOTOS } from '../middlewares/upload.js'
import * as anuncioModel from '../models/anuncioModel.js'
import * as favoritoModel from '../models/favoritoModel.js'
import * as fotoModel from '../models/fotoModel.js'
import { idsDasConversasDoAnuncio } from '../models/mensagemModel.js'
import * as localizacao from '../services/localizacaoService.js'
import { avisarQuedaDePreco, historicoDoAnuncio, registrarMudancaDePreco } from '../services/historicoDePrecoService.js'
import { exigirFotoPermitida } from '../services/moderacaoDeImagem.js'
import { exigirTextoPermitido } from '../services/moderacaoDeTexto.js'
import { avisarAnuncioNovo } from '../services/notificacaoService.js'
import { avisarListasDeCompras } from '../services/listaDeComprasService.js'
import { avisarProcurasAtendidas } from '../services/procuraService.js'
import { apagarDoDisco } from '../utils/arquivos.js'
import { publicarParaTodos } from '../socket.js'
import { registrar } from '../utils/log.js'

import { erroHttp } from '../utils/erroHttp.js'
import { lerId, lerTexto, lerOpcao } from '../utils/validacao.js'

import {
  pastaDoAnuncio,
  pastaDaConversa,
  caminhoDaFoto,
  LARGURAS_FOTO,
  formatarFoto,
} from '../utils/fotos.js'

const CONDICOES = ['novo', 'seminovo', 'usado']
const FORMAS_DE_ENTREGA = ['retirada', 'combinar']
// como levar: cabe na mochila (ou a pé), cabe em carro de aplicativo ou precisa de carreto
const TRANSPORTES = ['mochila', 'carro', 'carreto']
const STATUS_VISIVEIS = anuncioModel.STATUS_VISIVEIS
const CAMPOS_DO_ANUNCIO = [
  'titulo',
  'descricao',
  'preco',
  'categoria_id',
  'subcategoria_id',
  'bairro_id',
  'condicao',
  'forma_entrega',
  'transporte',
  'localizacao',
]
// campos de localização que também podem vir no corpo do anúncio (veja localizacaoService)
const CAMPOS_DE_LOCALIZACAO = ['latitude', 'longitude', 'origem_localizacao', 'rua', 'cep', 'precisao_m']
const MAIOR_PRECO = 99_999_999.99 // DECIMAL(10,2) do banco
const FORMATOS_ACEITOS = ['jpeg', 'png', 'webp']
const MAXIMO_DE_PIXELS = 40_000_000 // foto maior que isso derruba o servidor ao abrir (bomba de descompressão)

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

  // só número decimal com ponto: 250 ou 250.50 (recusa 1e3 e 0x10)
  if (typeof valor === 'string' && !/^\d{1,8}(\.\d{1,2})?$/.test(valor.trim())) {
    throw erroHttp(400, 'O preço precisa ser um número maior que zero e até 99999999.99.')
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
// A moderação recusa (422) texto com o que não pode na plataforma (armas, drogas, conteúdo sexual, ameaça).
async function validarAnuncio(corpo, usuarioId = null) {
  const dados = {
    titulo: lerTexto(corpo.titulo, 'titulo', { obrigatorio: true, min: 3, max: 80 }),
    descricao: lerTexto(corpo.descricao, 'descricao', { max: 1000 }),
    preco: validarPreco(corpo.preco),
    categoria_id: lerId(corpo.categoria_id, 'categoria_id'),
    subcategoria_id: vazio(corpo.subcategoria_id) ? null : lerId(corpo.subcategoria_id, 'subcategoria_id'),
    bairro_id: lerId(corpo.bairro_id, 'bairro_id'),
    condicao: null,
    forma_entrega: lerOpcao(corpo.forma_entrega, 'forma_entrega', FORMAS_DE_ENTREGA),
    // o site pede sempre; a API aceita sem, para os anúncios de antes da tag continuarem editáveis
    transporte: lerOpcao(corpo.transporte, 'transporte', TRANSPORTES, { obrigatorio: false }),
    localizacao: lerTexto(corpo.localizacao, 'localizacao', { max: 120 }),
  }
  exigirTextoPermitido({ titulo: dados.titulo, descricao: dados.descricao, localizacao: dados.localizacao }, { onde: 'anuncio', usuarioId })

  const categoria = await anuncioModel.buscarCategoria(dados.categoria_id)

  if (!categoria) {
    throw erroHttp(400, 'Categoria não encontrada.')
  }

  // a condição é obrigatória, menos em Serviços, que nunca têm condição (nem transporte)
  dados.condicao = categoria.slug === 'servicos' ? null : lerOpcao(corpo.condicao, 'condicao', CONDICOES)
  if (categoria.slug === 'servicos') dados.transporte = null

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

// Rascunho: confere só o que já foi preenchido. As regras completas valem ao publicar.
// A moderação vale desde o rascunho: o que não pode na plataforma não fica guardado nem escondido.
async function validarRascunho(corpo, usuarioId = null) {
  const dados = {
    titulo: lerTexto(corpo.titulo, 'titulo', { max: 80 }),
    descricao: lerTexto(corpo.descricao, 'descricao', { max: 1000 }),
    preco: vazio(corpo.preco) || Number(corpo.preco) === 0 ? null : validarPreco(corpo.preco),
    categoria_id: vazio(corpo.categoria_id) ? null : lerId(corpo.categoria_id, 'categoria_id'),
    subcategoria_id: vazio(corpo.subcategoria_id) ? null : lerId(corpo.subcategoria_id, 'subcategoria_id'),
    bairro_id: vazio(corpo.bairro_id) ? null : lerId(corpo.bairro_id, 'bairro_id'),
    condicao: lerOpcao(corpo.condicao, 'condicao', CONDICOES, { obrigatorio: false }),
    forma_entrega: lerOpcao(corpo.forma_entrega, 'forma_entrega', FORMAS_DE_ENTREGA, { obrigatorio: false }),
    transporte: lerOpcao(corpo.transporte, 'transporte', TRANSPORTES, { obrigatorio: false }),
    localizacao: lerTexto(corpo.localizacao, 'localizacao', { max: 120 }),
  }
  exigirTextoPermitido({ titulo: dados.titulo, descricao: dados.descricao, localizacao: dados.localizacao }, { onde: 'anuncio', usuarioId })

  if (dados.subcategoria_id && !dados.categoria_id) {
    throw erroHttp(400, 'Escolha a categoria antes da subcategoria.')
  }

  if (dados.categoria_id) {
    const categoria = await anuncioModel.buscarCategoria(dados.categoria_id)
    if (!categoria) throw erroHttp(400, 'Categoria não encontrada.')
    if (categoria.slug === 'servicos') { dados.condicao = null; dados.transporte = null }
  }

  if (
    dados.subcategoria_id &&
    !(await anuncioModel.subcategoriaEhDaCategoria(dados.subcategoria_id, dados.categoria_id))
  ) {
    throw erroHttp(400, 'Essa subcategoria não é da categoria escolhida.')
  }

  if (dados.bairro_id && !(await anuncioModel.bairroExiste(dados.bairro_id))) {
    throw erroHttp(400, 'Bairro não encontrado.')
  }

  return dados
}

// O que falta para o rascunho poder ser publicado
async function camposFaltando(anuncio, totalFotos) {
  const categoria = anuncio.categoria_id ? await anuncioModel.buscarCategoria(anuncio.categoria_id) : null
  const faltando = []

  if (totalFotos === 0) faltando.push('fotos')
  if ([...(anuncio.titulo ?? '')].length < 3) faltando.push('titulo')
  if (!anuncio.categoria_id) faltando.push('categoria_id')
  if (categoria?.slug !== 'servicos' && !anuncio.condicao) faltando.push('condicao')
  if (!anuncio.preco) faltando.push('preco')
  if (!anuncio.bairro_id) faltando.push('bairro_id')
  if (!anuncio.forma_entrega) faltando.push('forma_entrega')

  return faltando
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
  const ehMeu = Number(usuarioId) === anuncio.vendedor.id
  // aproximada para todo mundo; o dono vê também o ponto exato, a rua e o CEP
  const { localizacao: localizacaoDoAnuncio } = await localizacao.localizacaoDoAnuncio(anuncioId, usuarioId)
  // o preço é público: o histórico (gráfico) e quanto baixou nos últimos 30 dias também
  const { historico, baixou } = await historicoDoAnuncio(anuncio)

  return {
    ...anuncio,
    fotos: fotos.map((foto) => formatarFoto(anuncioId, foto)),
    favoritado: usuarioId ? await favoritoModel.existe(usuarioId, anuncioId) : false,
    eh_meu: ehMeu,
    localizacao_anuncio: localizacaoDoAnuncio,
    historico_preco: historico,
    baixou,
  }
}

// O que o feed em tempo real recebe: só o necessário para cada tela decidir se o anúncio entra
// (categoria, preço e o ponto aproximado), nunca o ponto exato.
function resumoParaFeed(anuncio) {
  const local = anuncio.localizacao_anuncio
  return {
    id: anuncio.id,
    titulo: anuncio.titulo,
    preco: anuncio.preco,
    status: anuncio.status,
    categoria_id: anuncio.categoria_id,
    subcategoria_id: anuncio.subcategoria_id,
    condicao: anuncio.condicao,
    cidade_id: local?.cidade.id ?? null,
    bairro_id: local?.bairro.id ?? null,
    latitude: local?.latitude ?? null,
    longitude: local?.longitude ?? null,
  }
}

function avisarAnuncioPublicado(anuncio) {
  publicarParaTodos('anuncio_publicado', resumoParaFeed(anuncio))
  avisarAnuncioNovo({ ...anuncio, localizacao_aproximada: anuncio.localizacao_anuncio })
  avisarProcurasAtendidas(anuncio) // Procura-se: avisa quem pediu algo parecido
  avisarListasDeCompras(anuncio) // lista de compras: avisa quem tem um item que combina
  registrar('anuncio.publicado', { anuncio_id: anuncio.id, usuario_id: anuncio.vendedor.id, cidade_id: anuncio.localizacao_anuncio?.cidade.id })
}

// Converte tudo antes de gravar: foto que não abre vira 400 antes de criar qualquer coisa.
// O tipo que o navegador manda pode mentir, então o sharp confere o formato de verdade.
// Cada foto vira 3 WebP (400, 800 e 1600 px), sem aumentar foto pequena. O sharp descarta
// o EXIF (inclusive o GPS), por isso o .rotate() vem antes, senão foto de celular sai deitada.
// Antes de converter, a IA confere cada foto: nudez ou conteúdo sexual é recusado (422), biquíni pode.
async function converterFotos(arquivos, { usuarioId = null } = {}) {
  const fotos = []

  for (const [i, arquivo] of arquivos.entries()) {
    let formato
    try {
      formato = (await sharp(arquivo.buffer, { limitInputPixels: MAXIMO_DE_PIXELS }).metadata()).format
    } catch {
      formato = null
    }
    if (!FORMATOS_ACEITOS.includes(formato)) {
      throw erroHttp(400, 'Uma das fotos não abriu. Envie fotos JPG, PNG ou WebP.')
    }
    await exigirFotoPermitida(arquivo.buffer, { onde: 'anuncio', usuarioId, posicao: i + 1, total: arquivos.length })

    try {
      const tamanhos = []

      for (const largura of LARGURAS_FOTO) {
        const webp = await sharp(arquivo.buffer, { limitInputPixels: MAXIMO_DE_PIXELS })
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

// os 3 tamanhos da foto. O registro já saiu do banco: se o disco falhar, fica no log e a
// conferência de fotos (npm run fotos) apaga depois
async function apagarArquivosFoto(anuncioId, arquivo) {
  for (const largura of LARGURAS_FOTO) {
    await apagarDoDisco(caminhoDaFoto(anuncioId, arquivo, largura), { tipo: 'foto_anuncio', anuncio_id: anuncioId })
  }
}

// GET /api/anuncios/:id
export async function verAnuncio(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')
  const usuarioId = req.usuario?.id ?? null
  const atual = await anuncioModel.buscarPorId(id)

  // rascunho e anúncio em análise (denunciado) só existem para o dono
  if (anuncioModel.STATUS_SO_DO_DONO.includes(atual?.status) && Number(atual.usuario_id) !== Number(usuarioId)) {
    throw erroHttp(404, 'Anúncio não encontrado.')
  }

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
  const corpo = req.body ?? {}
  const status = lerOpcao(corpo.status, 'status', ['ativo', 'rascunho'], { obrigatorio: false }) ?? 'ativo'
  const rascunho = status === 'rascunho'

  if (!rascunho && arquivos.length === 0) {
    throw erroHttp(400, 'Envie pelo menos uma foto do anúncio.')
  }

  const dados = rascunho ? await validarRascunho(corpo, req.usuario.id) : await validarAnuncio(corpo, req.usuario.id)

  if (rascunho && arquivos.length === 0 && Object.values(dados).every((valor) => valor === null)) {
    throw erroHttp(400, 'Preencha algum campo para salvar o rascunho.')
  }

  dados.status = status

  // localização própria do anúncio: GPS/mapa (validada na cidade do bairro) ou o centro do bairro
  let local = null
  if (dados.bairro_id) {
    const preparada = await localizacao.prepararLocalizacaoDoAnuncio(corpo, { bairroIdAtual: dados.bairro_id })
    local = preparada?.dados ?? (await localizacao.localizacaoPeloBairro(dados.bairro_id))
  } else if (CAMPOS_DE_LOCALIZACAO.some((campo) => !vazio(corpo[campo]))) {
    // rascunho com GPS e sem bairro: o bairro sai do ponto
    const preparada = await localizacao.prepararLocalizacaoDoAnuncio(corpo, {})
    dados.bairro_id = preparada.bairroId
    local = preparada.dados
  }

  const fotos = await converterFotos(arquivos, { usuarioId: req.usuario.id })

  // anúncio, localização e fotos numa transação: se algo falhar, não sobra nada pela metade
  let id

  try {
    await anuncioModel.emTransacao(async (conexao) => {
      id = await anuncioModel.criar({ ...dados, usuario_id: req.usuario.id }, conexao)
      if (local) await localizacao.gravarLocalizacaoDoAnuncio(conexao, id, local)
      await gravarFotos(conexao, id, fotos, 0)
    })
  } catch (erro) {
    if (id) {
      await rm(pastaDoAnuncio(id), { recursive: true, force: true })
    }

    throw erro
  }

  const anuncio = await montarDetalhe(id, req.usuario.id)
  if (status === 'ativo') avisarAnuncioPublicado(anuncio)
  res.status(201).json(anuncio)
}

// PUT /api/anuncios/:id
export async function editar(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')
  const atual = await exigirDono(id, req.usuario.id)
  const corpo = lerCorpo(req.body)

  const enviados = CAMPOS_DO_ANUNCIO.filter((campo) => Object.hasOwn(corpo, campo))
  const enviouLocal = CAMPOS_DE_LOCALIZACAO.some((campo) => Object.hasOwn(corpo, campo))

  if (enviados.length === 0 && !enviouLocal) {
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

  const dados = atual.status === 'rascunho' ? await validarRascunho(novo, req.usuario.id) : await validarAnuncio(novo, req.usuario.id)

  // localização nova (GPS ou mapa) só se o dono mandou; o GPS dele nunca muda o anúncio sozinho
  let local = null
  if (enviouLocal) {
    const preparada = await localizacao.prepararLocalizacaoDoAnuncio(corpo, { bairroIdAtual: dados.bairro_id })
    if (preparada) {
      local = preparada.dados
      dados.bairro_id = preparada.bairroId
    }
  }

  let mudancaDePreco = null
  await anuncioModel.emTransacao(async (conexao) => {
    await anuncioModel.atualizar(id, req.usuario.id, dados, conexao)
    if (local) await localizacao.gravarLocalizacaoDoAnuncio(conexao, id, local)
    else await localizacao.ajustarLocalizacaoAoBairro(conexao, id, dados.bairro_id)
    // preço novo em anúncio publicado: vai para o histórico junto com a edição
    mudancaDePreco = await registrarMudancaDePreco(atual, dados.preco, conexao)
  })

  const anuncio = await montarDetalhe(id, req.usuario.id)
  if (STATUS_VISIVEIS.includes(anuncio.status)) {
    publicarParaTodos('anuncio_atualizado', resumoParaFeed(anuncio))
    avisarListasDeCompras(anuncio, { antes: atual }) // passou a combinar com a lista de alguém (preço baixou, por exemplo)
    if (mudancaDePreco?.avisar) avisarQuedaDePreco(anuncio, mudancaDePreco.precoAntes) // "Baixou!" para quem favoritou
  }
  res.json(anuncio)
}

// PATCH /api/anuncios/:id/status
// ativo (disponível), reservado (combinado com alguém, mas ainda aparece) ou vendido (sai da busca)
export async function mudarStatus(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')

  const atual = await exigirDono(id, req.usuario.id)
  const status = lerOpcao(lerCorpo(req.body).status, 'status', ['ativo', 'reservado', 'vendido'])

  if (atual.status === 'em_analise') {
    throw erroHttp(409, 'Este anúncio está em análise pela equipe do DesapegaUai por causa de denúncias. Ele volta para a busca se a equipe liberar.')
  }

  if (atual.status !== 'rascunho') {
    await anuncioModel.mudarStatus(id, req.usuario.id, status)
    const anuncio = await montarDetalhe(id, req.usuario.id)
    if (status !== atual.status) {
      // vendido sai das buscas na hora; reservado e reativado continuam nelas, com o status novo
      if (status === 'vendido') publicarParaTodos('anuncio_removido', { id, motivo: 'vendido' })
      else publicarParaTodos('anuncio_atualizado', resumoParaFeed(anuncio))
    }
    return res.json(anuncio)
  }

  if (status !== 'ativo') {
    throw erroHttp(409, `Publique o rascunho antes de marcar como ${status}.`)
  }

  // publicar: as regras completas valem aqui; a trava impede remover a última foto ao mesmo tempo
  await anuncioModel.emTransacao(async (conexao) => {
    await anuncioModel.travar(id, conexao)
    const fotos = await fotoModel.listarPorAnuncio(id, conexao)
    const campos = await camposFaltando(atual, fotos.length)

    if (campos.length > 0) {
      const erro = erroHttp(400, 'Complete o anúncio antes de publicar.')
      erro.campos = campos
      throw erro
    }

    await validarAnuncio(atual, req.usuario.id)
    // todo anúncio publicado tem localização: se o rascunho não tinha, vale o centro do bairro
    await localizacao.ajustarLocalizacaoAoBairro(conexao, id, atual.bairro_id)
    await anuncioModel.publicarRascunho(id, req.usuario.id, conexao)
  })

  const publicado = await montarDetalhe(id, req.usuario.id)
  avisarAnuncioPublicado(publicado)
  res.json(publicado)
}

// DELETE /api/anuncios/:id
export async function excluir(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')

  await exigirDono(id, req.usuario.id)

  // as conversas do anúncio somem junto com ele (ON DELETE CASCADE); guarda os ids para apagar as fotos delas
  const conversas = await idsDasConversasDoAnuncio(id)
  const removido = await anuncioModel.excluir(id, req.usuario.id)

  if (!removido) {
    throw erroHttp(404, 'Anúncio não encontrado.')
  }

  // o anúncio já saiu do banco (com as fotos e as conversas dele): agora saem os arquivos
  await apagarDoDisco(pastaDoAnuncio(id), { tipo: 'pasta_anuncio', anuncio_id: id })
  for (const conversaId of conversas) {
    await apagarDoDisco(pastaDaConversa(conversaId), { tipo: 'pasta_conversa', conversa_id: conversaId })
  }

  publicarParaTodos('anuncio_removido', { id, motivo: 'excluido' })
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

  const fotos = await converterFotos(arquivos, { usuarioId: req.usuario.id })

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

  const atual = await exigirDono(id, req.usuario.id)

  const removida = await anuncioModel.emTransacao(async (conexao) => {
    if (!(await anuncioModel.travar(id, conexao))) {
      throw erroHttp(404, 'Anúncio não encontrado.')
    }

    const fotos = await fotoModel.listarPorAnuncio(id, conexao)
    const foto = fotos.find((item) => item.id === fotoId)

    if (!foto) {
      throw erroHttp(404, 'Foto não encontrada neste anúncio.')
    }

    if (fotos.length === 1 && atual.status !== 'rascunho') {
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

// PATCH /api/anuncios/:id/fotos/:fotoId/capa
export async function definirCapa(req, res) {
  const id = lerId(req.params.id, 'id do anúncio')
  const fotoId = lerId(req.params.fotoId, 'id da foto')

  await exigirDono(id, req.usuario.id)

  await anuncioModel.emTransacao(async (conexao) => {
    await anuncioModel.travar(id, conexao)

    const fotos = await fotoModel.listarPorAnuncio(id, conexao)
    const escolhida = fotos.find((foto) => foto.id === fotoId)

    if (!escolhida) {
      throw erroHttp(404, 'Foto não encontrada neste anúncio.')
    }

    const novaOrdem = [escolhida, ...fotos.filter((foto) => foto.id !== fotoId)]

    for (const [ordem, foto] of novaOrdem.entries()) {
      if (foto.ordem !== ordem) {
        await fotoModel.mudarOrdem(foto.id, ordem, conexao)
      }
    }
  })

  res.json(await montarDetalhe(id, req.usuario.id))
}

// GET /api/meus-anuncios
export async function meusAnuncios(req, res) {
  const cards = await anuncioModel.listarCardsDoUsuario(req.usuario.id)

  res.json(
    await Promise.all(
      cards.map(async ({ total_fotos, bairro_id, forma_entrega, ...card }) => ({
        ...card,
        campos_faltando:
          card.status === 'rascunho'
            ? await camposFaltando({ ...card, bairro_id, forma_entrega }, total_fotos)
            : [],
      })),
    ),
  )
}
