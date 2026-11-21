import { db } from '../config/db.js'
import { temVinculoAcademico } from '../utils/vinculo.js'
import { resumoDoUsuario } from './comparecimentoModel.js'
import { erroHttp } from '../utils/erroHttp.js'

// sem telefone: ele só aparece no perfil do próprio dono
const CAMPOS_DA_SESSAO = 'id, nome, email, foto_url'

export async function buscarPorId(id) {
  const [linhas] = await db.query(`SELECT ${CAMPOS_DA_SESSAO} FROM usuario WHERE id = ?`, [id])
  return linhas[0] ?? null
}

// só os usuários do seed (google_id "teste-..."), nunca uma conta real
// Versão das sessões da conta: o token só vale se tiver a mesma. Devolve null se a conta não existe.
export async function versaoDaSessao(id) {
  const [linhas] = await db.query('SELECT versao_sessao FROM usuario WHERE id = ?', [id])
  return linhas[0] ? Number(linhas[0].versao_sessao) : null
}

// sair da conta: os tokens emitidos até agora deixam de valer, em todos os aparelhos
export async function encerrarSessoes(id) {
  await db.query('UPDATE usuario SET versao_sessao = versao_sessao + 1 WHERE id = ?', [id])
}

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
              WHERE a.usuario_id = u.id AND a.status IN ('ativo', 'reservado')) AS total_anuncios_ativos,
            (SELECT COUNT(*) FROM favorito f
              WHERE f.usuario_id = u.id) AS total_favoritos,
            (SELECT COUNT(*) FROM conversa c JOIN anuncio a ON a.id = c.anuncio_id
              WHERE c.comprador_id = u.id OR a.usuario_id = u.id) AS total_conversas
       FROM usuario u
      WHERE u.id = ?`,
    [id],
  )
  if (!linhas[0]) return null
  return { ...linhas[0], vinculo_academico: temVinculoAcademico(linhas[0].email), compromisso: await resumoDoUsuario(id) }
}

// Perfil que os outros veem: só o que é público. Telefone e e-mail nunca saem daqui (LGPD).
export async function buscarPerfilPublico(id) {
  const [linhas] = await db.query(
    `SELECT u.id, u.nome, u.email, u.foto_url, u.bio, u.criado_em, u.ultimo_acesso,
            (SELECT COUNT(*) FROM anuncio a
              WHERE a.usuario_id = u.id AND a.status IN ('ativo', 'reservado')) AS total_anuncios_ativos,
            (SELECT COUNT(*) FROM anuncio a
              WHERE a.usuario_id = u.id AND a.status = 'vendido') AS total_vendidos
       FROM usuario u
      WHERE u.id = ?`,
    [id],
  )
  if (!linhas[0]) return null
  // o e-mail só serve para calcular o selo: não sai daqui
  const { email, ...publico } = linhas[0]
  return { ...publico, vinculo_academico: temVinculoAcademico(email) }
}

// pastas de fotos ligadas à conta: os anúncios dela e as conversas em que ela compra ou vende
export async function pastasDaConta(id) {
  const [anuncios] = await db.query('SELECT id FROM anuncio WHERE usuario_id = ?', [id])
  const [conversas] = await db.query(
    `SELECT c.id FROM conversa c JOIN anuncio a ON a.id = c.anuncio_id
      WHERE c.comprador_id = ? OR a.usuario_id = ?`,
    [id, id],
  )
  return { anuncios: anuncios.map((a) => a.id), conversas: conversas.map((c) => c.id) }
}

// anúncios, fotos, conversas, mensagens, avaliações, pedidos e avisos saem junto (ON DELETE CASCADE)
export async function excluirConta(id) {
  const [resultado] = await db.query('DELETE FROM usuario WHERE id = ?', [id])
  return resultado.affectedRows > 0
}

export async function atualizarPerfil(id, { nome, telefone, bio }) {
  await db.query('UPDATE usuario SET nome = ?, telefone = ?, bio = ? WHERE id = ?', [
    nome,
    telefone,
    bio,
    id,
  ])
}

export async function atualizarFotoPerfil(id, fotoUrl) {
  await db.query('UPDATE usuario SET foto_url = ? WHERE id = ?', [fotoUrl, id])
}

export async function buscarUltimoAcesso(id) {
  const [linhas] = await db.query('SELECT id AS usuario_id, ultimo_acesso FROM usuario WHERE id = ?', [id])
  return linhas[0] ?? null
}
