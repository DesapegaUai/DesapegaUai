import { db } from '../config/db.js'
import { erroHttp } from '../utils/erroHttp.js'

const COLUNAS = `
  av.id,
  av.conversa_id,
  av.avaliador_id,
  av.avaliado_id,
  avaliador.nome AS avaliador_nome,
  avaliador.foto_url AS avaliador_foto,
  avaliado.nome AS avaliado_nome,
  av.anuncio_titulo,
  av.nota,
  av.qualidades,
  av.comentario,
  av.criado_em
`

// no banco as qualidades ficam num texto só ("respondeu_rapido,pontual"); para fora saem como lista
const comLista = (avaliacao) => ({ ...avaliacao, qualidades: avaliacao.qualidades ? avaliacao.qualidades.split(',') : [] })

const JUNCOES = `
  JOIN usuario avaliador ON avaliador.id = av.avaliador_id
  JOIN usuario avaliado ON avaliado.id = av.avaliado_id
`

export async function listarPorUsuario(usuarioId) {
  const [usuarios] = await db.query('SELECT id FROM usuario WHERE id = ?', [usuarioId])
  if (usuarios.length === 0) throw erroHttp(404, 'Usuário não encontrado.')

  const [avaliacoes] = await db.query(
    `SELECT ${COLUNAS}
       FROM avaliacao av
       ${JUNCOES}
      WHERE av.avaliado_id = ?
      ORDER BY av.criado_em DESC, av.id DESC`,
    [usuarioId],
  )

  return avaliacoes.map(comLista)
}

export async function listarMinhas(usuarioId) {
  let [avaliacoes] = await db.query(
    `SELECT ${COLUNAS}
       FROM avaliacao av
       ${JUNCOES}
      WHERE av.avaliado_id = ? OR av.avaliador_id = ?
      ORDER BY av.criado_em DESC, av.id DESC`,
    [usuarioId, usuarioId],
  )
  avaliacoes = avaliacoes.map(comLista)

  return {
    recebidas: avaliacoes.filter((avaliacao) => Number(avaliacao.avaliado_id) === Number(usuarioId)),
    feitas: avaliacoes.filter((avaliacao) => Number(avaliacao.avaliador_id) === Number(usuarioId)),
  }
}

export async function criar({ conversaId, avaliadorId, nota, qualidades = [], comentario }) {
  const conexao = await db.getConnection()

  try {
    await conexao.beginTransaction()

    const [conversas] = await conexao.query(
      `SELECT c.id, c.comprador_id, a.usuario_id AS avaliado_id, a.titulo, a.status
         FROM conversa c
         JOIN anuncio a ON a.id = c.anuncio_id
        WHERE c.id = ?
        FOR UPDATE`,
      [conversaId],
    )

    if (conversas.length === 0) throw erroHttp(404, 'Conversa não encontrada.')

    const conversa = conversas[0]
    if (Number(conversa.comprador_id) !== Number(avaliadorId)) {
      throw erroHttp(403, 'Somente quem comprou pode avaliar esta negociação.')
    }
    if (conversa.status !== 'vendido') {
      throw erroHttp(409, 'A avaliação só pode ser enviada depois de o anúncio ser marcado como vendido.')
    }
    if (Number(conversa.avaliado_id) === Number(avaliadorId)) {
      throw erroHttp(400, 'Você não pode avaliar a si mesmo.')
    }

    // só quem negociou de verdade avalia: os dois precisam ter mandado mensagem na conversa
    const [[{ falaram }]] = await conexao.query(
      'SELECT COUNT(DISTINCT remetente_id) AS falaram FROM mensagem WHERE conversa_id = ?',
      [conversa.id],
    )
    if (Number(falaram) < 2) {
      throw erroHttp(409, 'A avaliação fica disponível depois que você e o vendedor conversarem pelo chat.')
    }

    const [resultado] = await conexao.query(
      `INSERT INTO avaliacao
         (conversa_id, avaliador_id, avaliado_id, anuncio_titulo, nota, qualidades, comentario)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [conversa.id, avaliadorId, conversa.avaliado_id, conversa.titulo, nota, qualidades.length ? qualidades.join(',') : null, comentario],
    )

    const [avaliacoes] = await conexao.query(
      `SELECT ${COLUNAS}
         FROM avaliacao av
         ${JUNCOES}
        WHERE av.id = ?`,
      [resultado.insertId],
    )

    await conexao.commit()

    return {
      avaliacao: comLista(avaliacoes[0]),
    }
  } catch (erro) {
    await conexao.rollback()
    if (erro.code === 'ER_DUP_ENTRY') {
      throw erroHttp(409, 'Você já enviou uma avaliação para esta negociação.')
    }
    throw erro
  } finally {
    conexao.release()
  }
}
