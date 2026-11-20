import { db } from '../config/db.js'
import { erroHttp } from '../utils/erroHttp.js'
import { lerId, lerTexto } from '../utils/validacao.js'

export async function buscarMensagens(conversaId, usuarioId) {
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
      'SELECT id, nome, foto_url FROM usuario WHERE id = ?',
      [outroUsuarioId],
    )

    const [mensagens] = await conexao.query(
      `SELECT id, conversa_id, remetente_id, texto, enviada_em, lida
       FROM mensagem
       WHERE conversa_id = ?
       ORDER BY enviada_em ASC, id ASC
       FOR UPDATE`,
      [conversaId],
    )

    // Marca como lidas somente as mensagens recebidas.
    await conexao.query(
      `UPDATE mensagem
       SET lida = TRUE
       WHERE conversa_id = ?
         AND remetente_id <> ?
         AND lida = FALSE`,
      [conversaId, usuarioId],
    )

    const itens = []

    for (const mensagem of mensagens) {
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
    }
  } catch (erro) {
    await conexao.rollback()
    throw erro
  } finally {
    conexao.release()
  }
}

export async function salvarMensagem(conversaId, usuarioId, texto) {
  // Essas validações também serão usadas pelo Socket.IO no A4.
  conversaId = lerId(conversaId, 'id da conversa')

  texto = lerTexto(texto, 'texto', {
    obrigatorio: true,
    min: 1,
    max: 1000,
  })

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
      `INSERT INTO mensagem (conversa_id, remetente_id, texto)
       VALUES (?, ?, ?)`,
      [conversaId, usuarioId, texto],
    )

    const [mensagens] = await conexao.query(
      `SELECT id, conversa_id, remetente_id, texto, enviada_em, lida
       FROM mensagem
       WHERE id = ?`,
      [resultado.insertId],
    )

    const mensagem = mensagens[0]
    mensagem.lida = Boolean(mensagem.lida)

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