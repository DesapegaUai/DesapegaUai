import { db } from '../config/db.js'
import { erroHttp } from '../utils/erroHttp.js'
import { formatarFoto } from '../utils/fotos.js'

export async function abrirConversa(anuncioId, compradorId) {
  const conexao = await db.getConnection()

  try {
    await conexao.beginTransaction()

    // Bloqueia o anúncio durante a operação para evitar duplicações.
    const [anuncios] = await conexao.query(
      'SELECT id, usuario_id, status FROM anuncio WHERE id = ? FOR UPDATE',
      [anuncioId],
    )

    // rascunho só existe para o dono: para os outros, nem existe
    if (anuncios.length === 0 || anuncios[0].status === 'rascunho') {
      throw erroHttp(404, 'Anúncio não encontrado.')
    }

    const anuncio = anuncios[0]

    if (anuncio.usuario_id === compradorId) {
      throw erroHttp(400, 'Você não pode abrir conversa no próprio anúncio.')
    }

    if (anuncio.status === 'vendido') {
      throw erroHttp(409, 'Este anúncio já foi vendido.')
    }

    const [conversas] = await conexao.query(
      `SELECT id, anuncio_id, comprador_id, criada_em, atualizada_em
       FROM conversa
       WHERE anuncio_id = ? AND comprador_id = ?`,
      [anuncioId, compradorId],
    )

    if (conversas.length > 0) {
      // se quem está comprando tinha excluído essa conversa, ela volta para a lista dele (sem o histórico antigo)
      await conexao.query(
        'UPDATE conversa SET atualizada_em = NOW() WHERE id = ? AND oculta_comprador_em IS NOT NULL AND atualizada_em <= oculta_comprador_em',
        [conversas[0].id],
      )
      await conexao.commit()

      return {
        conversa: conversas[0],
        criada: false,
        participantes: [compradorId, anuncio.usuario_id],
      }
    }

    const [resultado] = await conexao.query(
      'INSERT INTO conversa (anuncio_id, comprador_id) VALUES (?, ?)',
      [anuncioId, compradorId],
    )

    const [novaConversa] = await conexao.query(
      `SELECT id, anuncio_id, comprador_id, criada_em, atualizada_em
       FROM conversa
       WHERE id = ?`,
      [resultado.insertId],
    )

    await conexao.commit()

    return {
      conversa: novaConversa[0],
      criada: true,
      participantes: [compradorId, anuncio.usuario_id],
    }
  } catch (erro) {
    await conexao.rollback()
    throw erro
  } finally {
    conexao.release()
  }
}

export async function listarConversas(usuarioId, filtro) {
  const [resultados] = await db.query(
    `SELECT
       c.id,
       c.atualizada_em,
       c.comprador_id,
       c.oculta_comprador_em,
       c.oculta_vendedor_em,
       a.id AS anuncio_id,
       a.usuario_id AS vendedor_id,
       a.titulo,
       a.preco,
       a.status,
       comprador.nome AS comprador_nome,
       comprador.foto_url AS comprador_foto,
       comprador.ultimo_acesso AS comprador_acesso,
       vendedor.nome AS vendedor_nome,
       vendedor.foto_url AS vendedor_foto,
       vendedor.ultimo_acesso AS vendedor_acesso,
       capa.id AS capa_id,
       capa.ordem AS capa_ordem,
       capa.arquivo AS capa_arquivo,
       ultima.id AS mensagem_id,
       ultima.texto AS mensagem_texto,
       ultima.foto AS mensagem_foto,
       ultima.video AS mensagem_video,
       ultima.audio_segundos AS mensagem_audio_segundos,
       ultima.remetente_id AS mensagem_remetente_id,
       ultima.enviada_em AS mensagem_enviada_em,
       ultima.apagada_em AS mensagem_apagada_em,
       (
         SELECT COUNT(*)
         FROM mensagem m
         WHERE m.conversa_id = c.id
           AND m.remetente_id <> ?
           AND m.lida = FALSE
       ) AS nao_lidas
     FROM conversa c
     JOIN anuncio a ON a.id = c.anuncio_id
     JOIN usuario comprador ON comprador.id = c.comprador_id
     JOIN usuario vendedor ON vendedor.id = a.usuario_id
     LEFT JOIN foto_anuncio capa ON capa.id = (
       SELECT f.id
       FROM foto_anuncio f
       WHERE f.anuncio_id = a.id
       ORDER BY f.ordem, f.id
       LIMIT 1
     )
     LEFT JOIN mensagem ultima ON ultima.id = (
       SELECT m.id
       FROM mensagem m
       WHERE m.conversa_id = c.id
         AND NOT EXISTS (SELECT 1 FROM mensagem_oculta o WHERE o.mensagem_id = m.id AND o.usuario_id = ?)
       ORDER BY m.enviada_em DESC, m.id DESC
       LIMIT 1
     )
     WHERE c.comprador_id = ? OR a.usuario_id = ?
     ORDER BY c.atualizada_em DESC, c.id DESC`,
    [usuarioId, usuarioId, usuarioId, usuarioId],
  )

  const conversas = []
  let totalNaoLidas = 0
  let totalVisiveis = 0

  for (const resultado of resultados) {
    // conversa que esta pessoa excluiu: só volta a aparecer se houve movimento depois (mensagem nova ou reabertura)
    const excluidaEm = resultado.vendedor_id === usuarioId ? resultado.oculta_vendedor_em : resultado.oculta_comprador_em
    if (excluidaEm && new Date(resultado.atualizada_em) <= new Date(excluidaEm)) continue
    totalVisiveis += 1

    let papel = 'comprando'

    let outroUsuario = {
      id: resultado.vendedor_id,
      nome: resultado.vendedor_nome,
      foto_url: resultado.vendedor_foto,
      ultimo_acesso: resultado.vendedor_acesso,
    }

    if (resultado.vendedor_id === usuarioId) {
      papel = 'vendendo'

      outroUsuario = {
        id: resultado.comprador_id,
        nome: resultado.comprador_nome,
        foto_url: resultado.comprador_foto,
        ultimo_acesso: resultado.comprador_acesso,
      }
    }

    const naoLidas = Number(resultado.nao_lidas)

    // No topo, contamos quantas conversas têm mensagens não lidas.
    if (naoLidas > 0) {
      totalNaoLidas += 1
    }

    let ultimaMensagem = null

    // a última mensagem só aparece na prévia se for de depois da exclusão
    const ultimaVisivel = resultado.mensagem_id !== null
      && (!excluidaEm || new Date(resultado.mensagem_enviada_em) > new Date(excluidaEm))
    if (ultimaVisivel) {
      ultimaMensagem = {
        id: resultado.mensagem_id,
        texto: resultado.mensagem_apagada_em ? '' : resultado.mensagem_texto,
        tem_foto: resultado.mensagem_foto !== null,
        tem_video: resultado.mensagem_video !== null && resultado.mensagem_video !== undefined,
        // duração do áudio, para a lista mostrar "🎤 Áudio (0:12)"; null quando não é áudio
        audio_segundos: resultado.mensagem_audio_segundos ?? null,
        apagada: resultado.mensagem_apagada_em !== null,
        remetente_id: resultado.mensagem_remetente_id,
        enviada_em: resultado.mensagem_enviada_em,
        minha: resultado.mensagem_remetente_id === usuarioId,
      }
    }

    const fotoCapa = formatarFoto(resultado.anuncio_id, {
      id: resultado.capa_id,
      ordem: resultado.capa_ordem,
      arquivo: resultado.capa_arquivo,
    })

    const conversa = {
      id: resultado.id,
      anuncio: {
        id: resultado.anuncio_id,
        titulo: resultado.titulo,
        preco: resultado.preco,
        status: resultado.status,
        foto_capa: fotoCapa,
      },
      outro_usuario: outroUsuario,
      ultima_mensagem: ultimaMensagem,
      nao_lidas: naoLidas,
      papel: papel,
      atualizada_em: resultado.atualizada_em,
    }

    let incluir = false

    if (filtro === 'todas') {
      incluir = true
    } else if (filtro === 'nao_lidas' && naoLidas > 0) {
      incluir = true
    } else if (filtro === papel) {
      incluir = true
    }

    if (incluir) {
      conversas.push(conversa)
    }
  }

  return {
    itens: conversas,
    nao_lidas: totalNaoLidas,
    total: totalVisiveis,
  }
}

export async function contarConversasNaoLidas(usuarioId) {
  const [resultado] = await db.query(
    `SELECT COUNT(*) AS total
     FROM conversa c
     JOIN anuncio a ON a.id = c.anuncio_id
     WHERE (c.comprador_id = ? OR a.usuario_id = ?)
       AND EXISTS (
         SELECT 1
         FROM mensagem m
         WHERE m.conversa_id = c.id
           AND m.remetente_id <> ?
           AND m.lida = FALSE
       )`,
    [usuarioId, usuarioId, usuarioId],
  )

  return Number(resultado[0].total)
}


// "Excluir conversa": some só para quem pediu. As mensagens recebidas ficam como lidas (não sobra
// contador), a outra pessoa continua com a conversa dela, e avaliações e denúncias não são afetadas.
export async function ocultarConversa(conversaId, usuarioId) {
  const [linhas] = await db.query(
    `SELECT c.comprador_id, a.usuario_id AS vendedor_id
       FROM conversa c JOIN anuncio a ON a.id = c.anuncio_id
      WHERE c.id = ?`,
    [conversaId],
  )
  if (linhas.length === 0) throw erroHttp(404, 'Conversa não encontrada.')

  const { comprador_id: compradorId, vendedor_id: vendedorId } = linhas[0]
  if (usuarioId !== compradorId && usuarioId !== vendedorId) {
    throw erroHttp(403, 'Você não participa desta conversa.')
  }

  const coluna = usuarioId === vendedorId ? 'oculta_vendedor_em' : 'oculta_comprador_em'
  // a hora da exclusão nunca fica antes da última mensagem (relógio do servidor x hora gravada na mensagem)
  await db.query(`UPDATE conversa SET ${coluna} = GREATEST(NOW(), atualizada_em) WHERE id = ?`, [conversaId])
  await db.query('UPDATE mensagem SET lida = TRUE WHERE conversa_id = ? AND remetente_id <> ? AND lida = FALSE', [conversaId, usuarioId])
}
