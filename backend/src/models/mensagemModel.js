import { db } from '../config/db.js'
import { erroHttp } from '../utils/erroHttp.js'
import { formatarFotoDoChat } from '../utils/fotos.js'
import { lerId, lerTexto } from '../utils/validacao.js'

export async function buscarMensagens(conversaId, usuarioId) {
  const conexao = await db.getConnection()

  try {
    await conexao.beginTransaction()

    const [conversas] = await conexao.query(
      `SELECT id, anuncio_id, comprador_id, oculta_comprador_em, oculta_vendedor_em
       FROM conversa
       WHERE id = ?
       FOR UPDATE`,
      [conversaId],
    )

    if (conversas.length === 0) {
      throw erroHttp(404, 'Conversa não encontrada.')
    }

    const conversa = conversas[0]

    const [anuncios] = await conexao.query(
      `SELECT id, usuario_id, titulo, preco, status
       FROM anuncio
       WHERE id = ?`,
      [conversa.anuncio_id],
    )

    const anuncio = anuncios[0]

    const comprador = conversa.comprador_id === usuarioId
    const vendedor = anuncio.usuario_id === usuarioId

    if (!comprador && !vendedor) {
      throw erroHttp(403, 'Você não participa desta conversa.')
    }

    let outroUsuarioId = anuncio.usuario_id

    if (vendedor) {
      outroUsuarioId = conversa.comprador_id
    }

    const [usuarios] = await conexao.query(
      'SELECT id, nome, foto_url, ultimo_acesso FROM usuario WHERE id = ?',
      [outroUsuarioId],
    )

    const [mensagens] = await conexao.query(
      `SELECT id, conversa_id, remetente_id, texto, foto, enviada_em, lida
       FROM mensagem
       WHERE conversa_id = ?
       ORDER BY enviada_em ASC, id ASC
       FOR UPDATE`,
      [conversaId],
    )

    // Marca como lidas somente as mensagens recebidas.
    const [marcacao] = await conexao.query(
      `UPDATE mensagem
       SET lida = TRUE
       WHERE conversa_id = ?
         AND remetente_id <> ?
         AND lida = FALSE`,
      [conversaId, usuarioId],
    )

    const itens = []
    // quem excluiu a conversa não volta a ver o que foi trocado antes da exclusão
    const excluidaEm = vendedor ? conversa.oculta_vendedor_em : conversa.oculta_comprador_em

    for (const mensagem of mensagens) {
      if (excluidaEm && new Date(mensagem.enviada_em) <= new Date(excluidaEm)) continue
      const minha = mensagem.remetente_id === usuarioId
      let lida = Boolean(mensagem.lida)

      if (!minha) {
        lida = true
      }

      itens.push({
        id: mensagem.id,
        conversa_id: mensagem.conversa_id,
        remetente_id: mensagem.remetente_id,
        texto: mensagem.texto,
        foto: formatarFotoDoChat(mensagem.conversa_id, mensagem.foto),
        enviada_em: mensagem.enviada_em,
        lida: lida,
        minha: minha,
      })
    }

    await conexao.commit()

    return {
      conversa_id: conversa.id,
      anuncio: {
        id: anuncio.id,
        titulo: anuncio.titulo,
        preco: anuncio.preco,
        status: anuncio.status,
      },
      outro_usuario: usuarios[0],
      mensagens: itens,
      // só para o controller avisar o outro lado (não vai na resposta)
      marcadas: marcacao.affectedRows,
      participantes: [conversa.comprador_id, anuncio.usuario_id],
    }
  } catch (erro) {
    await conexao.rollback()
    throw erro
  } finally {
    conexao.release()
  }
}

// `foto` é o nome do arquivo já gravado em disco (só o envio de fotos passa). Com foto, o texto é
// opcional e vira a legenda; sem foto, o texto é obrigatório.
export async function salvarMensagem(conversaId, usuarioId, texto, foto = null) {
  // Essas validações também são usadas pelo Socket.IO.
  conversaId = lerId(conversaId, 'id da conversa')

  texto = lerTexto(texto, 'texto', {
    obrigatorio: !foto,
    min: foto ? 0 : 1,
    max: 1000,
  }) ?? ''

  const conexao = await db.getConnection()

  try {
    await conexao.beginTransaction()

    const [conversas] = await conexao.query(
      `SELECT id, anuncio_id, comprador_id
       FROM conversa
       WHERE id = ?
       FOR UPDATE`,
      [conversaId],
    )

    if (conversas.length === 0) {
      throw erroHttp(404, 'Conversa não encontrada.')
    }

    const conversa = conversas[0]

    const [anuncios] = await conexao.query(
      'SELECT usuario_id FROM anuncio WHERE id = ?',
      [conversa.anuncio_id],
    )

    const vendedorId = anuncios[0].usuario_id

    const comprador = conversa.comprador_id === usuarioId
    const vendedor = vendedorId === usuarioId

    if (!comprador && !vendedor) {
      throw erroHttp(403, 'Você não participa desta conversa.')
    }

    const [resultado] = await conexao.query(
      `INSERT INTO mensagem (conversa_id, remetente_id, texto, foto)
       VALUES (?, ?, ?, ?)`,
      [conversaId, usuarioId, texto, foto],
    )

    const [mensagens] = await conexao.query(
      `SELECT id, conversa_id, remetente_id, texto, foto, enviada_em, lida
       FROM mensagem
       WHERE id = ?`,
      [resultado.insertId],
    )

    const mensagem = mensagens[0]
    mensagem.lida = Boolean(mensagem.lida)
    mensagem.foto = formatarFotoDoChat(conversaId, mensagem.foto)

    await conexao.query(
      'UPDATE conversa SET atualizada_em = ? WHERE id = ?',
      [mensagem.enviada_em, conversaId],
    )

    await conexao.commit()

    return {
      mensagem: mensagem,
      participantes: [conversa.comprador_id, vendedorId],
    }
  } catch (erro) {
    await conexao.rollback()
    throw erro
  } finally {
    conexao.release()
  }
}
// ids do comprador e do vendedor da conversa (vazio se ela não existe)
export async function participantesDaConversa(conversaId) {
  const [linhas] = await db.query(
    `SELECT c.comprador_id, a.usuario_id AS vendedor_id
       FROM conversa c JOIN anuncio a ON a.id = c.anuncio_id
      WHERE c.id = ?`,
    [conversaId],
  )
  return linhas[0] ? [linhas[0].comprador_id, linhas[0].vendedor_id] : []
}

// quem conversa com essa pessoa (para avisar quando ela entra ou sai)
export async function listarParceirosDeConversa(usuarioId) {
  const [linhas] = await db.query(
    `SELECT DISTINCT IF(c.comprador_id = ?, a.usuario_id, c.comprador_id) AS parceiro_id
       FROM conversa c JOIN anuncio a ON a.id = c.anuncio_id
      WHERE c.comprador_id = ? OR a.usuario_id = ?`,
    [usuarioId, usuarioId, usuarioId],
  )
  return linhas.map((linha) => linha.parceiro_id)
}

// marca como lidas as mensagens recebidas na conversa (só quem participa pode)
export async function marcarComoLidas(conversaId, usuarioId) {
  conversaId = lerId(conversaId, 'id da conversa')
  const participantes = await participantesDaConversa(conversaId)
  if (!participantes.length) throw erroHttp(404, 'Conversa não encontrada.')
  if (!participantes.includes(usuarioId)) throw erroHttp(403, 'Você não participa desta conversa.')

  const [[{ ateId }]] = await db.query(
    'SELECT MAX(id) AS ateId FROM mensagem WHERE conversa_id = ? AND remetente_id <> ? AND lida = FALSE',
    [conversaId, usuarioId],
  )
  const [resultado] = await db.query(
    'UPDATE mensagem SET lida = TRUE WHERE conversa_id = ? AND remetente_id <> ? AND lida = FALSE',
    [conversaId, usuarioId],
  )
  return { conversaId, marcadas: resultado.affectedRows, ateId, participantes }
}

// ids das conversas de um anúncio (para apagar as fotos delas quando o anúncio é excluído)
export async function idsDasConversasDoAnuncio(anuncioId) {
  const [linhas] = await db.query('SELECT id FROM conversa WHERE anuncio_id = ?', [anuncioId])
  return linhas.map((linha) => linha.id)
}
