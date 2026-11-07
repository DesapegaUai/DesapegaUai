import { db } from '../config/db.js'
import { erroHttp } from '../utils/erroHttp.js'

// sem telefone: ele só aparece no perfil do próprio dono
const CAMPOS_DA_SESSAO = 'id, nome, email, foto_url'

export async function buscarPorId(id) {
  const [linhas] = await db.query(`SELECT ${CAMPOS_DA_SESSAO} FROM usuario WHERE id = ?`, [id])
  return linhas[0] ?? null
}

// só os usuários do seed (google_id "teste-..."), nunca uma conta real
export async function buscarUsuarioDeTeste(id) {
  const [linhas] = await db.query(
    `SELECT ${CAMPOS_DA_SESSAO} FROM usuario WHERE id = ? AND google_id LIKE 'teste-%'`,
    [id],
  )
  return linhas[0] ?? null
}

export async function registrarAcesso(id) {
  await db.query('UPDATE usuario SET ultimo_acesso = NOW() WHERE id = ?', [id])
}

// acha pelo google_id ou cria o usuário
export async function entrarComGoogle({ googleId, nome, email, fotoUrl }) {
  let id = await idPeloGoogleId(googleId)

  if (!id) {
    try {
      const [resultado] = await db.query(
        'INSERT INTO usuario (google_id, nome, email, foto_url) VALUES (?, ?, ?, ?)',
        [googleId, nome, email, fotoUrl],
      )
      id = resultado.insertId
    } catch (erro) {
      if (erro.code !== 'ER_DUP_ENTRY') throw erro
      // outro login da mesma conta ao mesmo tempo já criou; se não achar, o e-mail é de outra conta
      id = await idPeloGoogleId(googleId)
      if (!id) throw erroHttp(409, 'Este e-mail já está ligado a outra conta Google.')
    }
  }

  await registrarAcesso(id)
  return buscarPorId(id)
}

async function idPeloGoogleId(googleId) {
  const [linhas] = await db.query('SELECT id FROM usuario WHERE google_id = ?', [googleId])
  return linhas[0]?.id ?? null
}

export async function buscarPerfil(id) {
  const [linhas] = await db.query(
    `SELECT u.id, u.nome, u.email, u.foto_url, u.telefone, u.bio, u.criado_em, u.ultimo_acesso,
            (SELECT COUNT(*) FROM anuncio a
              WHERE a.usuario_id = u.id AND a.status = 'ativo') AS total_anuncios_ativos,
            (SELECT COUNT(*) FROM favorito f
              WHERE f.usuario_id = u.id) AS total_favoritos,
            (SELECT COUNT(*) FROM conversa c JOIN anuncio a ON a.id = c.anuncio_id
              WHERE c.comprador_id = u.id OR a.usuario_id = u.id) AS total_conversas
       FROM usuario u
      WHERE u.id = ?`,
    [id],
  )
  return linhas[0] ?? null
}

export async function atualizarPerfil(id, { nome, telefone, bio }) {
  await db.query('UPDATE usuario SET nome = ?, telefone = ?, bio = ? WHERE id = ?', [
    nome,
    telefone,
    bio,
    id,
  ])
}
