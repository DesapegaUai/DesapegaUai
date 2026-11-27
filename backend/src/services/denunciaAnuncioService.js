// Denúncia de anúncio (os três pontinhos da página do anúncio). Cada pessoa denuncia um anúncio uma vez.
// Com 3 pessoas diferentes, o anúncio sai da busca (status em_analise) até a equipe revisar com
// npm run denuncias, que libera (volta como estava) ou remove (apaga, com fotos e conversas). O vendedor é
// avisado no sininho e no celular, sem saber quem denunciou.
import * as anuncioModel from '../models/anuncioModel.js'
import * as denunciaModel from '../models/denunciaAnuncioModel.js'
import * as fotoModel from '../models/fotoModel.js'
import { idsDasConversasDoAnuncio } from '../models/mensagemModel.js'
import * as repo from '../repositories/notificacaoRepository.js'
import { avisarUsuarios, publicarParaTodos } from '../socket.js'
import { apagarDoDisco } from '../utils/arquivos.js'
import { erroHttp } from '../utils/erroHttp.js'
import { formatarFoto, pastaDaConversa, pastaDoAnuncio } from '../utils/fotos.js'
import { registrar } from '../utils/log.js'
import { lerId, lerOpcao, lerTexto } from '../utils/validacao.js'
import * as push from './pushService.js'

export const MOTIVOS = ['proibido', 'golpe', 'improprio', 'falso', 'outro']
export const PESSOAS_PARA_ANALISE = 3

// no celular o título é curto (no Android ele divide a linha com o nome do app e a hora) e o nome do anúncio
// vai no texto, com a foto dele à direita enquanto ele existir
const TITULO_NO_CELULAR = { anuncio_em_analise: 'Anúncio em análise', anuncio_liberado: 'Anúncio liberado', anuncio_removido: 'Anúncio removido' }

async function avisarVendedor(vendedorId, { tipo, anuncioId = null, anuncioTitulo, titulo, texto, url }) {
  try {
    const aviso = await repo.criarAviso({ usuarioId: vendedorId, tipo, anuncioId, titulo: titulo.slice(0, 120), texto: texto.slice(0, 255) })
    avisarUsuarios([vendedorId], 'nova_notificacao', aviso)
    const capa = anuncioId ? formatarFoto(anuncioId, (await fotoModel.listarPorAnuncio(anuncioId))[0]) : null
    await push.enviarPara([vendedorId], {
      titulo: TITULO_NO_CELULAR[tipo] ?? titulo.slice(0, 120),
      texto: `${anuncioTitulo} · ${texto}`.slice(0, 255),
      url,
      icone: capa?.pequena ?? null,
      tag: `denuncia-${anuncioId ?? 'removido'}`,
    }).catch(() => {})
  } catch (erro) {
    console.error('Não foi possível avisar o vendedor sobre a denúncia:', erro.message)
  }
}

/** POST: denuncia o anúncio; a terceira pessoa diferente tira o anúncio da busca até a equipe revisar */
export async function denunciar(anuncioIdBruto, usuarioId, corpo) {
  const anuncioId = lerId(anuncioIdBruto, 'id do anúncio')
  const motivo = lerOpcao(corpo?.motivo, 'motivo', MOTIVOS)
  const descricao = lerTexto(corpo?.descricao, 'descricao', { max: 500 })
  if (motivo === 'outro' && !descricao) throw erroHttp(400, 'Conte o que há de errado no anúncio no campo descricao.')

  const anuncio = await anuncioModel.buscarPorId(anuncioId)
  const ehDono = Boolean(anuncio) && Number(anuncio.usuario_id) === Number(usuarioId)
  if (!anuncio || (anuncioModel.STATUS_SO_DO_DONO.includes(anuncio.status) && !ehDono)) throw erroHttp(404, 'Anúncio não encontrado.')
  if (ehDono) throw erroHttp(400, 'Você não pode denunciar o próprio anúncio.')

  const denuncia = await denunciaModel.criar({ anuncioId, denuncianteId: usuarioId, motivo, descricao })
  registrar('denuncia_anuncio.criada', { denuncia_id: denuncia.id, anuncio_id: anuncioId, motivo })

  // só quem faz a troca agora avisa (duas denúncias ao mesmo tempo não avisam duas vezes)
  if ((await denunciaModel.contarAbertas(anuncioId)) >= PESSOAS_PARA_ANALISE && (await denunciaModel.colocarEmAnalise(anuncioId))) {
    registrar('denuncia_anuncio.em_analise', { anuncio_id: anuncioId, vendedor_id: anuncio.usuario_id })
    publicarParaTodos('anuncio_removido', { id: anuncioId, motivo: 'em_analise' })
    await avisarVendedor(anuncio.usuario_id, {
      tipo: 'anuncio_em_analise',
      anuncioId,
      anuncioTitulo: anuncio.titulo,
      titulo: `Seu anúncio saiu da busca: ${anuncio.titulo}`,
      texto: 'Ele recebeu denúncias e a equipe do DesapegaUai vai revisar. Se estiver tudo certo, ele volta para a busca.',
      url: '/meus-anuncios',
    })
  }
  // quem denunciou não fica sabendo quantas denúncias o anúncio tem
  return { denuncia: { id: denuncia.id, motivo: denuncia.motivo, criada_em: denuncia.criada_em } }
}

/** GET: a denúncia que eu fiz neste anúncio (ou null) */
export async function minhaDenuncia(anuncioIdBruto, usuarioId) {
  const anuncioId = lerId(anuncioIdBruto, 'id do anúncio')
  const denuncia = await denunciaModel.minha(anuncioId, usuarioId)
  return { denuncia: denuncia ? { id: denuncia.id, motivo: denuncia.motivo, criada_em: denuncia.criada_em } : null }
}

/** Equipe: está tudo certo. Volta para como estava (se estava em análise) e fecha as denúncias. */
export async function liberarAnuncio(anuncioId) {
  const anuncio = await anuncioModel.buscarPorId(anuncioId)
  if (!anuncio) throw erroHttp(404, 'Anúncio não encontrado.')
  const estavaEmAnalise = await denunciaModel.liberar(anuncioId)
  await denunciaModel.fechar(anuncioId, 'improcedente')
  registrar('denuncia_anuncio.liberado', { anuncio_id: anuncioId, estava_em_analise: estavaEmAnalise })
  if (estavaEmAnalise) {
    await avisarVendedor(anuncio.usuario_id, {
      tipo: 'anuncio_liberado',
      anuncioId,
      anuncioTitulo: anuncio.titulo,
      titulo: `Seu anúncio voltou para a busca: ${anuncio.titulo}`,
      texto: 'A equipe do DesapegaUai revisou as denúncias e está tudo certo com ele.',
      url: `/anuncio/${anuncioId}`,
    })
  }
  return { estavaEmAnalise }
}

/** Equipe: não segue as regras. Apaga o anúncio (com as fotos e as conversas dele) e avisa o vendedor. */
export async function removerAnuncio(anuncioId) {
  const anuncio = await anuncioModel.buscarPorId(anuncioId)
  if (!anuncio) throw erroHttp(404, 'Anúncio não encontrado.')
  const conversas = await idsDasConversasDoAnuncio(anuncioId)
  await denunciaModel.fechar(anuncioId, 'procedente')
  if (!(await anuncioModel.excluir(anuncioId, anuncio.usuario_id))) throw erroHttp(404, 'Anúncio não encontrado.')

  await apagarDoDisco(pastaDoAnuncio(anuncioId), { tipo: 'pasta_anuncio', anuncio_id: anuncioId })
  for (const conversaId of conversas) await apagarDoDisco(pastaDaConversa(conversaId), { tipo: 'pasta_conversa', conversa_id: conversaId })
  publicarParaTodos('anuncio_removido', { id: anuncioId, motivo: 'excluido' })
  registrar('denuncia_anuncio.removido', { anuncio_id: anuncioId, vendedor_id: anuncio.usuario_id })
  // o anúncio não existe mais: o aviso vai sem ele (anuncio_id vazio)
  await avisarVendedor(anuncio.usuario_id, {
    tipo: 'anuncio_removido',
    anuncioTitulo: anuncio.titulo,
    titulo: `Seu anúncio foi removido: ${anuncio.titulo}`,
    texto: 'A equipe do DesapegaUai revisou as denúncias e o anúncio não segue as regras da plataforma.',
    url: '/meus-anuncios',
  })
}
