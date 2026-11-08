import { db } from '../config/db.js'
import { formatarFoto } from '../utils/fotos.js'

// Tudo o que roda dentro do fn grava junto, ou nada grava (M1: anúncio e fotos numa transação).
export async function emTransacao(fn) {
  const conexao = await db.getConnection()

  try {
    await conexao.beginTransaction()
    const resultado = await fn(conexao)
    await conexao.commit()
    return resultado
  } catch (erro) {
    await conexao.rollback().catch(() => {})
    throw erro
  } finally {
    conexao.release()
  }
}

// --- validação: o que o anúncio aponta tem que existir ---

export async function buscarCategoria(id) {
  const [linhas] = await db.query('SELECT id, slug FROM categoria WHERE id = ?', [id])
  return linhas[0] ?? null
}

export async function subcategoriaEhDaCategoria(subcategoriaId, categoriaId) {
  const [linhas] = await db.query(
    'SELECT 1 FROM subcategoria WHERE id = ? AND categoria_id = ?',
    [subcategoriaId, categoriaId],
  )
  return linhas.length > 0
}

export async function bairroExiste(id) {
  const [linhas] = await db.query('SELECT 1 FROM bairro WHERE id = ?', [id])
  return linhas.length > 0
}

// --- card do Contrato: o mesmo na busca, nos favoritos e em Meus anúncios ---

// a capa é a foto de menor ordem; anúncio sem foto fica com foto_capa null
export function sqlDoCard(colunasExtras = '') {
  return `SELECT a.id, a.titulo, a.preco, a.condicao, a.status, a.data_publicacao,
                 b.nome AS bairro, c.nome AS cidade, c.uf${colunasExtras},
                 capa.id AS capa_id, capa.ordem AS capa_ordem, capa.arquivo AS capa_arquivo
            FROM anuncio a
            JOIN bairro b ON b.id = a.bairro_id
            JOIN cidade c ON c.id = b.cidade_id
            LEFT JOIN foto_anuncio capa ON capa.id = (
              SELECT f.id FROM foto_anuncio f WHERE f.anuncio_id = a.id ORDER BY f.ordem, f.id LIMIT 1
            )`
}

export function montarCard({ capa_id, capa_ordem, capa_arquivo, ...card }, favoritado) {
  return {
    ...card,
    foto_capa: formatarFoto(card.id, { id: capa_id, ordem: capa_ordem, arquivo: capa_arquivo }),
    favoritado,
  }
}

// M3: ativos e vendidos, mais novos primeiro, com os números da tela de perfil
export async function listarCardsDoUsuario(usuarioId) {
  const [linhas] = await db.query(
    `${sqlDoCard(`, a.visualizacoes,
                 (SELECT COUNT(*) FROM favorito fav WHERE fav.anuncio_id = a.id) AS total_favoritos`)}
      WHERE a.usuario_id = ?
      ORDER BY a.data_publicacao DESC, a.id DESC`,
    [usuarioId],
  )

  // ninguém favorita o próprio anúncio
  return linhas.map((linha) => montarCard(linha, false))
}

// --- um anúncio ---

export async function buscarPorId(id) {
  const [linhas] = await db.query('SELECT * FROM anuncio WHERE id = ?', [id])
  return linhas[0] ?? null
}

// M2: com os nomes de categoria, bairro e cidade, e o vendedor sem telefone e e-mail (LGPD)
export async function buscarDetalhe(id) {
  const [linhas] = await db.query(
    `SELECT a.id, a.titulo, a.descricao, a.preco, a.condicao, a.forma_entrega, a.localizacao,
            a.status, a.visualizacoes, a.data_publicacao, a.atualizado_em,
            a.categoria_id, cat.nome AS categoria,
            a.subcategoria_id, sub.nome AS subcategoria,
            a.bairro_id, b.nome AS bairro, b.cidade_id, c.nome AS cidade, c.uf,
            u.id AS vendedor_id, u.nome AS vendedor_nome, u.foto_url AS vendedor_foto_url,
            u.criado_em AS vendedor_criado_em
       FROM anuncio a
       JOIN categoria cat ON cat.id = a.categoria_id
       LEFT JOIN subcategoria sub ON sub.id = a.subcategoria_id
       JOIN bairro b ON b.id = a.bairro_id
       JOIN cidade c ON c.id = b.cidade_id
       JOIN usuario u ON u.id = a.usuario_id
      WHERE a.id = ?`,
    [id],
  )

  if (!linhas[0]) return null

  const { vendedor_id, vendedor_nome, vendedor_foto_url, vendedor_criado_em, ...anuncio } = linhas[0]
  return {
    ...anuncio,
    vendedor: {
      id: vendedor_id,
      nome: vendedor_nome,
      foto_url: vendedor_foto_url,
      criado_em: vendedor_criado_em,
    },
  }
}

// o dono vendo o próprio anúncio não conta (sem login, usuarioId é null)
export async function somarVisualizacao(id, usuarioId) {
  await db.query(
    'UPDATE anuncio SET visualizacoes = visualizacoes + 1 WHERE id = ? AND usuario_id <> ?',
    [id, usuarioId ?? 0],
  )
}

// segura o anúncio até o fim da transação: dois pedidos de foto ao mesmo tempo não furam o limite
export async function travar(id, conexao) {
  const [linhas] = await conexao.query('SELECT id FROM anuncio WHERE id = ? FOR UPDATE', [id])
  return linhas.length > 0
}

// --- gravação ---

export async function criar(dados, conexao = db) {
  const [resultado] = await conexao.query(
    `INSERT INTO anuncio
       (usuario_id, categoria_id, subcategoria_id, bairro_id,
        titulo, descricao, preco, condicao, forma_entrega, localizacao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dados.usuario_id,
      dados.categoria_id,
      dados.subcategoria_id,
      dados.bairro_id,
      dados.titulo,
      dados.descricao,
      dados.preco,
      dados.condicao,
      dados.forma_entrega,
      dados.localizacao,
    ],
  )

  return resultado.insertId
}

// recebe o anúncio inteiro já validado (o controller junta o que veio com o que já estava)
export async function atualizar(id, usuarioId, dados) {
  const [resultado] = await db.query(
    `UPDATE anuncio
        SET categoria_id = ?, subcategoria_id = ?, bairro_id = ?, titulo = ?, descricao = ?,
            preco = ?, condicao = ?, forma_entrega = ?, localizacao = ?, atualizado_em = NOW()
      WHERE id = ? AND usuario_id = ?`,
    [
      dados.categoria_id,
      dados.subcategoria_id,
      dados.bairro_id,
      dados.titulo,
      dados.descricao,
      dados.preco,
      dados.condicao,
      dados.forma_entrega,
      dados.localizacao,
      id,
      usuarioId,
    ],
  )

  return resultado.affectedRows > 0
}

export async function mudarStatus(id, usuarioId, status) {
  const [resultado] = await db.query(
    'UPDATE anuncio SET status = ?, atualizado_em = NOW() WHERE id = ? AND usuario_id = ?',
    [status, id, usuarioId],
  )

  return resultado.affectedRows > 0
}

// fotos, favoritos e conversas saem junto (ON DELETE CASCADE)
export async function excluir(id, usuarioId) {
  const [resultado] = await db.query('DELETE FROM anuncio WHERE id = ? AND usuario_id = ?', [
    id,
    usuarioId,
  ])

  return resultado.affectedRows > 0
}
