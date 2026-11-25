import * as avaliacaoModel from '../models/avaliacaoModel.js'
import { exigirTextoPermitido } from '../services/moderacaoDeTexto.js'
import { avisarAvaliacaoRecebida } from '../services/notificacaoService.js'
import { avisarUsuarios } from '../socket.js'
import { erroHttp } from '../utils/erroHttp.js'
import { lerId, lerTexto } from '../utils/validacao.js'

// Pontos fortes que o comprador pode marcar junto com as estrelas (todos opcionais)
export const QUALIDADES = ['respondeu_rapido', 'como_anunciado', 'pontual', 'educado', 'negociacao_facil']

function lerQualidades(valor) {
  if (valor === undefined || valor === null) return []
  if (!Array.isArray(valor) || valor.some((q) => !QUALIDADES.includes(q))) {
    throw erroHttp(400, `O campo qualidades precisa ser uma lista com: ${QUALIDADES.join(', ')}.`)
  }
  // sem repetidos e sempre na mesma ordem
  return QUALIDADES.filter((q) => valor.includes(q))
}

export async function listarUsuario(req, res) {
  const usuarioId = lerId(req.params.id, 'id do usuário')
  const avaliacoes = await avaliacaoModel.listarPorUsuario(usuarioId)
  res.json({
    avaliacoes: avaliacoes.map((avaliacao) => ({
      id: avaliacao.id,
      avaliado_id: avaliacao.avaliado_id,
      avaliador_id: avaliacao.avaliador_id,
      avaliador_nome: avaliacao.avaliador_nome,
      avaliador_foto: avaliacao.avaliador_foto,
      avaliado_nome: avaliacao.avaliado_nome,
      anuncio_titulo: avaliacao.anuncio_titulo,
      nota: avaliacao.nota,
      qualidades: avaliacao.qualidades,
      comentario: avaliacao.comentario,
      criado_em: avaliacao.criado_em,
      minha: false,
    })),
  })
}

export async function listarMinhas(req, res) {
  const resultado = await avaliacaoModel.listarMinhas(req.usuario.id)
  res.json({
    usuario_id: req.usuario.id,
    recebidas: resultado.recebidas.map((avaliacao) => ({ ...avaliacao, minha: false })),
    feitas: resultado.feitas.map((avaliacao) => ({ ...avaliacao, minha: true })),
  })
}

export async function criar(req, res) {
  const conversaId = lerId(req.params.id, 'id da conversa')
  const nota = req.body?.nota
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    throw erroHttp(400, 'A nota precisa ser um número inteiro de 1 a 5.')
  }

  const qualidades = lerQualidades(req.body?.qualidades)
  const comentario = lerTexto(req.body?.comentario, 'comentário', { max: 300 })
  exigirTextoPermitido({ comentario }, { onde: 'avaliacao', usuarioId: req.usuario.id })
  const resultado = await avaliacaoModel.criar({
    conversaId,
    avaliadorId: req.usuario.id,
    nota,
    qualidades,
    comentario,
  })

  const minha = { ...resultado.avaliacao, minha: true }
  const recebida = { ...resultado.avaliacao, minha: false }
  avisarUsuarios([resultado.avaliacao.avaliador_id], 'nova_avaliacao', minha)
  avisarUsuarios([resultado.avaliacao.avaliado_id], 'nova_avaliacao', recebida)
  avisarAvaliacaoRecebida(resultado.avaliacao) // sininho e push do vendedor (não trava a resposta)
  res.status(201).json({ avaliacao: minha })
}
