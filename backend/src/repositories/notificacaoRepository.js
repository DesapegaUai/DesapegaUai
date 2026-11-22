import { createHash } from 'node:crypto'
import { db } from '../config/db.js'
import { formatarFoto } from '../utils/fotos.js'

// foto de capa do anúncio do aviso (a caixinha do sininho e o aviso na tela mostram o que foi publicado)
const FOTO_DO_ANUNCIO = `(SELECT f.arquivo FROM foto_anuncio f WHERE f.anuncio_id = n.anuncio_id ORDER BY f.ordem, f.id LIMIT 1) AS foto_arquivo`
function comFoto({ foto_arquivo: arquivo, ...aviso }) {
  return { ...aviso, lida: Boolean(aviso.lida), foto: aviso.anuncio_id && arquivo ? formatarFoto(aviso.anuncio_id, { arquivo }).pequena : null }
}

export const hashDoEndpoint = (endpoint) => createHash('sha256').update(endpoint).digest('hex')

// ---------------------------------------------------------------- preferências

export async function buscarPreferencias(usuarioId) {
  const [linhas] = await db.query(
    `SELECT u.notificar_anuncios, u.notificar_mensagens, u.notificar_raio_km,
            c.id AS cidade_id, c.nome AS cidade_nome, b.id AS bairro_id, b.nome AS bairro_nome
       FROM usuario u
       LEFT JOIN cidade c ON c.id = u.notificar_cidade_id
       LEFT JOIN bairro b ON b.id = u.notificar_bairro_id
      WHERE u.id = ?`,
    [usuarioId],
  )
  if (!linhas[0]) return null
  const l = linhas[0]
  return {
    anuncios: Boolean(l.notificar_anuncios),
    mensagens: Boolean(l.notificar_mensagens),
    raio_km: l.notificar_raio_km,
    // localidade escolhida para os avisos de anúncio (null = vale a distância)
    cidade: l.cidade_id ? { id: l.cidade_id, nome: l.cidade_nome } : null,
    bairro: l.bairro_id ? { id: l.bairro_id, nome: l.bairro_nome } : null,
  }
}

export async function salvarPreferencias(usuarioId, { anuncios, mensagens, raioKm, cidadeId, bairroId }) {
  await db.query(
    `UPDATE usuario
        SET notificar_anuncios = ?, notificar_mensagens = ?, notificar_raio_km = ?,
            notificar_cidade_id = ?, notificar_bairro_id = ?
      WHERE id = ?`,
    [anuncios, mensagens, raioKm, cidadeId, bairroId, usuarioId],
  )
}

// a cidade existe? e o bairro (se vier) é dela?
export async function conferirLocalidade(cidadeId, bairroId) {
  const [[cidade]] = await db.query('SELECT id FROM cidade WHERE id = ?', [cidadeId])
  if (!cidade) return 'cidade'
  if (bairroId) {
    const [[bairro]] = await db.query('SELECT id FROM bairro WHERE id = ? AND cidade_id = ?', [bairroId, cidadeId])
    if (!bairro) return 'bairro'
  }
  return null
}

// ---------------------------------------------------------------- avisos

// apaga do histórico os avisos de anúncio novo desta pessoa (usado quando ela desliga esses avisos)
export async function apagarAvisosDeAnuncioNovo(usuarioId) {
  const [resultado] = await db.query("DELETE FROM notificacao WHERE usuario_id = ? AND tipo = 'novo_anuncio'", [usuarioId])
  return resultado.affectedRows
}

/**
 * Cria o aviso de anúncio novo para quem ativou: todo mundo que quer, menos o autor.
 * Quem escolheu uma localidade (cidade, com ou sem bairro) só recebe os anúncios de lá.
 * Quem não escolheu localidade mas escolheu um raio só recebe se o anúncio estiver nele (a partir
 * da localização compartilhada ou da cidade/bairro da busca; sem nenhuma referência, recebe de toda a região).
 * Devolve os avisos criados, um por pessoa.
 */
export async function criarAvisosDeAnuncioNovo(anuncio) {
  const conexao = await db.getConnection()
  try {
    await conexao.beginTransaction()
    const [resultado] = await conexao.query(
      `INSERT INTO notificacao (usuario_id, tipo, anuncio_id, titulo, texto)
       SELECT u.id, 'novo_anuncio', ?, ?, ?
         FROM usuario u
         JOIN anuncio an ON an.id = ?
         LEFT JOIN bairro ab ON ab.id = an.bairro_id
         LEFT JOIN localizacao_usuario lu ON lu.usuario_id = u.id AND lu.atualizada_em >= UTC_TIMESTAMP() - INTERVAL 30 DAY
         LEFT JOIN preferencia_localizacao p ON p.usuario_id = u.id
         LEFT JOIN bairro pb ON pb.id = p.bairro_id
         LEFT JOIN cidade pc ON pc.id = p.cidade_id
        WHERE u.notificar_anuncios = TRUE
          AND u.id <> ?
          AND (
            (u.notificar_cidade_id IS NOT NULL
               AND ab.cidade_id = u.notificar_cidade_id
               AND (u.notificar_bairro_id IS NULL OR an.bairro_id = u.notificar_bairro_id))
            OR
            (u.notificar_cidade_id IS NULL
               AND (u.notificar_raio_km IS NULL
                    OR COALESCE(lu.latitude, pb.latitude, pc.latitude) IS NULL
                    OR ST_Distance_Sphere(
                         POINT(?, ?),
                         POINT(COALESCE(lu.longitude, pb.longitude, pc.longitude), COALESCE(lu.latitude, pb.latitude, pc.latitude))
                       ) <= u.notificar_raio_km * 1000))
          )`,
      [anuncio.id, anuncio.titulo, anuncio.texto, anuncio.id, anuncio.usuarioId, anuncio.longitude, anuncio.latitude],
    )
    let avisos = []
    if (resultado.affectedRows > 0) {
      const [linhas] = await conexao.query(
        `SELECT n.id, n.usuario_id, n.tipo, n.anuncio_id, n.titulo, n.texto, n.lida, n.criada_em, ${FOTO_DO_ANUNCIO}
           FROM notificacao n WHERE n.anuncio_id = ? AND n.tipo = 'novo_anuncio' AND n.id >= ?`,
        [anuncio.id, resultado.insertId],
      )
      avisos = linhas
    }
    await conexao.commit()
    return avisos.map(comFoto)
  } catch (erro) {
    await conexao.rollback()
    throw erro
  } finally {
    conexao.release()
  }
}

export async function criarAviso({ usuarioId, tipo, anuncioId = null, titulo, texto }) {
  const [resultado] = await db.query(
    'INSERT INTO notificacao (usuario_id, tipo, anuncio_id, titulo, texto) VALUES (?, ?, ?, ?, ?)',
    [usuarioId, tipo, anuncioId, titulo, texto],
  )
  const [linhas] = await db.query(
    `SELECT n.id, n.usuario_id, n.tipo, n.anuncio_id, n.titulo, n.texto, n.lida, n.criada_em, ${FOTO_DO_ANUNCIO} FROM notificacao n WHERE n.id = ?`,
    [resultado.insertId],
  )
  return comFoto(linhas[0])
}

export async function listar(usuarioId, { pagina, porPagina }) {
  const [[{ total, nao_lidas }]] = await db.query(
    'SELECT COUNT(*) AS total, COALESCE(SUM(lida = FALSE), 0) AS nao_lidas FROM notificacao WHERE usuario_id = ?',
    [usuarioId],
  )
  const [linhas] = await db.query(
    `SELECT n.id, n.tipo, n.anuncio_id, n.titulo, n.texto, n.lida, n.criada_em,
            a.status AS anuncio_status, ${FOTO_DO_ANUNCIO}
       FROM notificacao n
       LEFT JOIN anuncio a ON a.id = n.anuncio_id
      WHERE n.usuario_id = ?
      ORDER BY n.id DESC
      LIMIT ? OFFSET ?`,
    [usuarioId, porPagina, (pagina - 1) * porPagina],
  )
  return {
    total: Number(total),
    nao_lidas: Number(nao_lidas),
    itens: linhas.map(comFoto),
  }
}

export async function contarNaoLidas(usuarioId) {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM notificacao WHERE usuario_id = ? AND lida = FALSE', [usuarioId])
  return Number(total)
}

// marca como lidas (todas, ou só os ids que forem da pessoa)
export async function marcarLidas(usuarioId, ids = null) {
  if (ids?.length) {
    await db.query('UPDATE notificacao SET lida = TRUE WHERE usuario_id = ? AND id IN (?)', [usuarioId, ids])
  } else {
    await db.query('UPDATE notificacao SET lida = TRUE WHERE usuario_id = ? AND lida = FALSE', [usuarioId])
  }
}

// ---------------------------------------------------------------- push (aparelhos)

export async function salvarInscricao(usuarioId, { endpoint, p256dh, auth }) {
  // o mesmo aparelho com outra conta: a inscrição passa para a conta atual
  await db.query(
    `INSERT INTO inscricao_push (usuario_id, endpoint, endpoint_hash, p256dh, auth)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), endpoint = VALUES(endpoint),
                             p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [usuarioId, endpoint, hashDoEndpoint(endpoint), p256dh, auth],
  )
}

export async function apagarInscricao(usuarioId, endpoint) {
  const [resultado] = await db.query(
    'DELETE FROM inscricao_push WHERE usuario_id = ? AND endpoint_hash = ?',
    [usuarioId, hashDoEndpoint(endpoint)],
  )
  return resultado.affectedRows > 0
}

export async function apagarInscricaoPorHash(hash) {
  await db.query('DELETE FROM inscricao_push WHERE endpoint_hash = ?', [hash])
}

export async function inscricoesDe(usuarioIds) {
  if (!usuarioIds.length) return []
  const [linhas] = await db.query(
    'SELECT usuario_id, endpoint, endpoint_hash, p256dh, auth FROM inscricao_push WHERE usuario_id IN (?)',
    [usuarioIds],
  )
  return linhas
}

export async function contarInscricoes(usuarioId) {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM inscricao_push WHERE usuario_id = ?', [usuarioId])
  return Number(total)
}
