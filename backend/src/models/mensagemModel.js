import { db } from '../config/db.js'
import { erroHttp } from '../utils/erroHttp.js'
import { formatarFotoDoChat, formatarVideoDoChat } from '../utils/fotos.js'
import { lerId, lerTexto } from '../utils/validacao.js'

// Editar e "apagar para todos" seguem os prazos do WhatsApp
export const PRAZO_PARA_EDITAR_S = 15 * 60
export const PRAZO_PARA_APAGAR_PARA_TODOS_S = 2 * 24 * 60 * 60

// formato de uma mensagem na API: a apagada para todos chega sem texto e sem foto
export function formatarMensagem(m) {
  const apagada = m.apagada_em !== null && m.apagada_em !== undefined
  return {
    id: m.id,
    conversa_id: m.conversa_id,
    remetente_id: m.remetente_id,
    texto: apagada ? '' : m.texto,
    foto: apagada ? null : formatarFotoDoChat(m.conversa_id, m.foto),
    video: apagada ? null : formatarVideoDoChat(m.conversa_id, m.video),
    enviada_em: m.enviada_em,
    lida: Boolean(m.lida),
    // dois tiques cinza: chegou no aparelho da outra pessoa; lida também conta como entregue
    entregue: Boolean(m.entregue_em) || Boolean(m.lida),
    editada: Boolean(m.editada_em) && !apagada,
    apagada: apagada,
  }
}

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

    // as que a pessoa apagou só para ela não voltam
    const [mensagens] = await conexao.query(
      `SELECT m.id, m.conversa_id, m.remetente_id, m.texto, m.foto, m.video, m.enviada_em, m.lida, m.entregue_em, m.editada_em, m.apagada_em
       FROM mensagem m
       WHERE m.conversa_id = ?
         AND NOT EXISTS (SELECT 1 FROM mensagem_oculta o WHERE o.mensagem_id = m.id AND o.usuario_id = ?)
       ORDER BY m.enviada_em ASC, m.id ASC
       FOR UPDATE`,
      [conversaId, usuarioId],
    )

    // Marca como lidas somente as mensagens recebidas.
    const [marcacao] = await conexao.query(
      `UPDATE mensagem
       SET lida = TRUE, entregue_em = COALESCE(entregue_em, NOW())
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

      itens.push({ ...formatarMensagem(mensagem), lida: lida, minha: minha })
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
export async function salvarMensagem(conversaId, usuarioId, texto, foto = null, video = null) {
  // Essas validações também são usadas pelo Socket.IO.
  conversaId = lerId(conversaId, 'id da conversa')

  texto = lerTexto(texto, 'texto', {
    obrigatorio: !foto && !video,
    min: foto || video ? 0 : 1,
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
      `INSERT INTO mensagem (conversa_id, remetente_id, texto, foto, video)
       VALUES (?, ?, ?, ?, ?)`,
      [conversaId, usuarioId, texto, foto, video],
    )

    const [mensagens] = await conexao.query(
      `SELECT id, conversa_id, remetente_id, texto, foto, video, enviada_em, lida, entregue_em, editada_em, apagada_em
       FROM mensagem
       WHERE id = ?`,
      [resultado.insertId],
    )

    const mensagem = formatarMensagem(mensagens[0])
    // quem mandou: o aviso de mensagem nova mostra a foto e o nome (sem foto, as iniciais, como no perfil)
    const [[remetente]] = await conexao.query('SELECT id, nome, foto_url FROM usuario WHERE id = ?', [usuarioId])
    mensagem.remetente = { id: remetente.id, nome: remetente.nome, foto_url: remetente.foto_url ?? null }

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
    'UPDATE mensagem SET lida = TRUE, entregue_em = COALESCE(entregue_em, NOW()) WHERE conversa_id = ? AND remetente_id <> ? AND lida = FALSE',
    [conversaId, usuarioId],
  )
  return { conversaId, marcadas: resultado.affectedRows, ateId, participantes }
}

// ids das conversas de um anúncio (para apagar as fotos delas quando o anúncio é excluído)
export async function idsDasConversasDoAnuncio(anuncioId) {
  const [linhas] = await db.query('SELECT id FROM conversa WHERE anuncio_id = ?', [anuncioId])
  return linhas.map((linha) => linha.id)
}

// A mensagem, a conversa e quem participa. 404 se a mensagem não é dessa conversa, 403 se a pessoa não
// participa. Bloqueia a linha (FOR UPDATE) para dois pedidos não mexerem na mesma mensagem ao mesmo tempo.
async function mensagemDaConversa(conexao, conversaId, mensagemId, usuarioId) {
  const [linhas] = await conexao.query(
    `SELECT m.id, m.conversa_id, m.remetente_id, m.texto, m.foto, m.video, m.enviada_em, m.lida, m.entregue_em, m.editada_em, m.apagada_em,
            TIMESTAMPDIFF(SECOND, m.enviada_em, NOW()) AS idade_s, c.comprador_id, a.usuario_id AS vendedor_id
       FROM conversa c
       JOIN anuncio a ON a.id = c.anuncio_id
       LEFT JOIN mensagem m ON m.id = ? AND m.conversa_id = c.id
      WHERE c.id = ?
      FOR UPDATE`,
    [mensagemId, conversaId],
  )
  if (linhas.length === 0) throw erroHttp(404, 'Conversa não encontrada.')
  const linha = linhas[0]
  const participantes = [linha.comprador_id, linha.vendedor_id]
  if (!participantes.includes(usuarioId)) throw erroHttp(403, 'Você não participa desta conversa.')
  if (linha.id === null) throw erroHttp(404, 'Mensagem não encontrada.')
  return { mensagem: linha, participantes }
}

async function naTransacao(trabalho) {
  const conexao = await db.getConnection()
  try {
    await conexao.beginTransaction()
    const resultado = await trabalho(conexao)
    await conexao.commit()
    return resultado
  } catch (erro) {
    await conexao.rollback()
    throw erro
  } finally {
    conexao.release()
  }
}

const SELECIONAR_MENSAGEM = 'SELECT id, conversa_id, remetente_id, texto, foto, video, enviada_em, lida, entregue_em, editada_em, apagada_em FROM mensagem WHERE id = ?'

// PATCH: só quem enviou, até 15 minutos depois. Mensagem com foto pode ficar sem legenda.
export async function editarMensagem(conversaId, mensagemId, usuarioId, texto) {
  conversaId = lerId(conversaId, 'id da conversa')
  mensagemId = lerId(mensagemId, 'id da mensagem')
  return naTransacao(async (conexao) => {
    const { mensagem, participantes } = await mensagemDaConversa(conexao, conversaId, mensagemId, usuarioId)
    if (mensagem.remetente_id !== usuarioId) throw erroHttp(403, 'Só quem enviou pode editar a mensagem.')
    if (mensagem.apagada_em) throw erroHttp(409, 'Esta mensagem foi apagada.')
    if (mensagem.idade_s > PRAZO_PARA_EDITAR_S) throw erroHttp(409, 'Só dá para editar até 15 minutos depois de enviar.')
    const novo = lerTexto(texto, 'texto', { obrigatorio: !mensagem.foto && !mensagem.video, min: mensagem.foto || mensagem.video ? 0 : 1, max: 1000 }) ?? ''
    if (novo !== mensagem.texto) {
      await conexao.query('UPDATE mensagem SET texto = ?, editada_em = NOW() WHERE id = ?', [novo, mensagemId])
    }
    const [[atual]] = await conexao.query(SELECIONAR_MENSAGEM, [mensagemId])
    return { mensagem: formatarMensagem(atual), participantes }
  })
}

// DELETE ?para=todos: só quem enviou, até 2 dias depois. O texto e a foto saem do banco; o controller
// apaga o arquivo da foto. Apagar de novo uma mensagem já apagada não é erro.
export async function apagarParaTodos(conversaId, mensagemId, usuarioId) {
  conversaId = lerId(conversaId, 'id da conversa')
  mensagemId = lerId(mensagemId, 'id da mensagem')
  return naTransacao(async (conexao) => {
    const { mensagem, participantes } = await mensagemDaConversa(conexao, conversaId, mensagemId, usuarioId)
    if (mensagem.remetente_id !== usuarioId) throw erroHttp(403, 'Só quem enviou pode apagar a mensagem para todos.')
    const jaApagada = Boolean(mensagem.apagada_em)
    if (!jaApagada) {
      if (mensagem.idade_s > PRAZO_PARA_APAGAR_PARA_TODOS_S) {
        throw erroHttp(409, 'Só dá para apagar para todos até 2 dias depois de enviar. Você ainda pode apagar só para você.')
      }
      await conexao.query("UPDATE mensagem SET texto = '', foto = NULL, video = NULL, apagada_em = NOW() WHERE id = ?", [mensagemId])
    }
    const [[atual]] = await conexao.query(SELECIONAR_MENSAGEM, [mensagemId])
    return { mensagem: formatarMensagem(atual), participantes, fotoAntiga: jaApagada ? null : mensagem.foto, videoAntigo: jaApagada ? null : mensagem.video }
  })
}

// DELETE ?para=mim: qualquer participante, em qualquer mensagem da conversa (sua ou da outra pessoa)
export async function apagarParaMim(conversaId, mensagemId, usuarioId) {
  conversaId = lerId(conversaId, 'id da conversa')
  mensagemId = lerId(mensagemId, 'id da mensagem')
  return naTransacao(async (conexao) => {
    await mensagemDaConversa(conexao, conversaId, mensagemId, usuarioId)
    await conexao.query('INSERT IGNORE INTO mensagem_oculta (mensagem_id, usuario_id) VALUES (?, ?)', [mensagemId, usuarioId])
    return { conversaId, mensagemId }
  })
}

// Fotos e vídeos da conversa que nenhuma das duas pessoas vê mais: cada uma apagou "para mim" ou excluiu a
// conversa depois que a mensagem chegou (as mesmas regras que escondem a mensagem na tela). A mensagem fica
// sem a foto e sem o vídeo (e marcada como apagada, porque ninguém a vê); devolve os nomes dos arquivos para
// o controller apagar do disco.
export async function liberarMidiasQueNinguemVe(conversaId) {
  const [mensagens] = await db.query(
    `SELECT m.id, m.foto, m.video
       FROM mensagem m
       JOIN conversa c ON c.id = m.conversa_id
       JOIN anuncio a ON a.id = c.anuncio_id
      WHERE m.conversa_id = ? AND (m.foto IS NOT NULL OR m.video IS NOT NULL)
        AND (EXISTS (SELECT 1 FROM mensagem_oculta o WHERE o.mensagem_id = m.id AND o.usuario_id = c.comprador_id)
             OR (c.oculta_comprador_em IS NOT NULL AND m.enviada_em <= c.oculta_comprador_em))
        AND (EXISTS (SELECT 1 FROM mensagem_oculta o WHERE o.mensagem_id = m.id AND o.usuario_id = a.usuario_id)
             OR (c.oculta_vendedor_em IS NOT NULL AND m.enviada_em <= c.oculta_vendedor_em))`,
    [conversaId],
  )
  if (mensagens.length === 0) return []
  await db.query(
    'UPDATE mensagem SET foto = NULL, video = NULL, apagada_em = COALESCE(apagada_em, NOW()) WHERE id IN (?)',
    [mensagens.map((m) => m.id)],
  )
  return mensagens
}

// "Entregue" (dois tiques cinza, como no WhatsApp): a mensagem chegou no aparelho de quem recebe, ou seja,
// o site dessa pessoa estava aberto com o tempo real ligado. Marca as mensagens recebidas por essa pessoa
// que ainda não estavam entregues (só uma, se vier mensagemId) e devolve, por conversa, quem enviou e até
// qual mensagem, para o socket avisar quem enviou.
export async function marcarComoEntregues(usuarioId, { mensagemId = null } = {}) {
  const soUma = mensagemId ? 'AND m.id = ?' : ''
  const parametros = [usuarioId, usuarioId, usuarioId, ...(mensagemId ? [mensagemId] : [])]
  const [pendentes] = await db.query(
    `SELECT m.conversa_id, m.remetente_id, MAX(m.id) AS ate_id
       FROM mensagem m
       JOIN conversa c ON c.id = m.conversa_id
       JOIN anuncio a ON a.id = c.anuncio_id
      WHERE m.entregue_em IS NULL AND m.lida = FALSE AND m.remetente_id <> ?
        AND (c.comprador_id = ? OR a.usuario_id = ?) ${soUma}
      GROUP BY m.conversa_id, m.remetente_id`,
    parametros,
  )
  if (pendentes.length === 0) return []
  // só até a última mensagem que entrou na lista (a que chegar agora é avisada na próxima vez)
  const ateId = Math.max(...pendentes.map((p) => p.ate_id))
  await db.query(
    `UPDATE mensagem m
       JOIN conversa c ON c.id = m.conversa_id
       JOIN anuncio a ON a.id = c.anuncio_id
        SET m.entregue_em = NOW()
      WHERE m.entregue_em IS NULL AND m.lida = FALSE AND m.remetente_id <> ?
        AND (c.comprador_id = ? OR a.usuario_id = ?) ${soUma} AND m.id <= ?`,
    [...parametros, ateId],
  )
  return pendentes.map((p) => ({ conversaId: p.conversa_id, remetenteId: p.remetente_id, ateId: p.ate_id }))
}
