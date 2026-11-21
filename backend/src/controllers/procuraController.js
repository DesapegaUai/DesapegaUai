// Procura-se: o comprador registra o que quer, o bairro e até quanto paga.
import * as anuncioModel from '../models/anuncioModel.js'
import * as procuraModel from '../models/procuraModel.js'
import { erroHttp } from '../utils/erroHttp.js'
import { registrar } from '../utils/log.js'
import { lerId, lerTexto } from '../utils/validacao.js'

const MAXIMO_POR_PESSOA = 10
const MAIOR_PRECO = 99_999_999.99
const vazio = (valor) => valor === undefined || valor === null || valor === ''

function lerPrecoMaximo(valor) {
  if (vazio(valor)) return null
  if ((typeof valor !== 'string' && typeof valor !== 'number') || !/^\d{1,8}(\.\d{1,2})?$/.test(String(valor).trim())) {
    throw erroHttp(400, 'O valor máximo precisa ser um número maior que zero.')
  }
  const preco = Math.round(Number(valor) * 100) / 100
  if (!(preco > 0) || preco > MAIOR_PRECO) throw erroHttp(400, 'O valor máximo precisa ser um número maior que zero.')
  return preco
}

// GET /api/procuras?cidade_id=  (qualquer pessoa vê; os mais novos primeiro)
export async function listar(req, res) {
  const cidadeId = vazio(req.query.cidade_id) ? null : lerId(req.query.cidade_id, 'id da cidade')
  res.json({ itens: await procuraModel.listar({ cidadeId }, req.usuario?.id ?? null) })
}

// POST /api/procuras  { titulo, bairro_id, categoria_id?, preco_max? }
export async function criar(req, res) {
  const corpo = req.body ?? {}
  const titulo = lerTexto(corpo.titulo, 'titulo', { obrigatorio: true, min: 3, max: 80 })
  const bairroId = lerId(corpo.bairro_id, 'bairro_id')
  const categoriaId = vazio(corpo.categoria_id) ? null : lerId(corpo.categoria_id, 'categoria_id')
  const precoMax = lerPrecoMaximo(corpo.preco_max)

  if (!(await anuncioModel.bairroExiste(bairroId))) throw erroHttp(400, 'Bairro não encontrado.')
  if (categoriaId && !(await anuncioModel.buscarCategoria(categoriaId))) throw erroHttp(400, 'Categoria não encontrada.')
  if ((await procuraModel.contarDoUsuario(req.usuario.id)) >= MAXIMO_POR_PESSOA) {
    throw erroHttp(409, `Você já tem ${MAXIMO_POR_PESSOA} pedidos no Procura-se. Exclua um para publicar outro.`)
  }

  const id = await procuraModel.criar({ usuarioId: req.usuario.id, titulo, categoriaId, bairroId, precoMax })
  registrar('procura.criada', { procura_id: id, usuario_id: req.usuario.id })
  res.status(201).json(await procuraModel.buscar(id, req.usuario.id))
}

// DELETE /api/procuras/:id  (só quem publicou)
export async function excluir(req, res) {
  const id = lerId(req.params.id, 'id do pedido')
  const pedido = await procuraModel.buscar(id, req.usuario.id)
  if (!pedido) throw erroHttp(404, 'Pedido não encontrado.')
  if (!pedido.eh_minha) throw erroHttp(403, 'Só quem publicou pode excluir este pedido.')
  await procuraModel.excluir(id, req.usuario.id)
  res.status(204).end()
}
