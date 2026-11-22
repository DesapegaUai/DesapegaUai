// Conferência das fotos (e dos vídeos do chat): compara o que está no disco com o que está no banco.
// - arquivo sem registro (órfão): sobrou de uma exclusão em que o disco falhou, ou de um envio interrompido;
// - registro sem arquivo: a foto apareceria quebrada no site.
// Sem { corrigir: true } só conta e lista. Com ele, apaga os órfãos e acerta os registros.
// Roda pelo comando npm run fotos (database/conferir-fotos.js). Não roda sozinha ao ligar a API,
// porque apagar arquivo com o banco errado no .env apagaria fotos de verdade.
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { db } from '../config/db.js'
import { apagarDoDisco } from '../utils/arquivos.js'
import { LARGURAS_FOTO, LARGURAS_FOTO_DO_CHAT, PASTA_PRIVADA, PASTA_UPLOADS } from '../utils/fotos.js'
import { registrar } from '../utils/log.js'

const FOTO_DO_ANUNCIO = new RegExp(`^([a-f0-9]{32})-(${LARGURAS_FOTO.join('|')})\\.webp$`)
const FOTO_DO_CHAT = new RegExp(`^([a-f0-9]{32})-(${LARGURAS_FOTO_DO_CHAT.join('|')})\\.webp$`)
const FOTO_DE_PERFIL = /^[a-f0-9]{32}\.webp$/
const VIDEO_DO_CHAT = /^[a-f0-9]{32}\.(mp4|webm|mov)$/
const URL_DO_PERFIL = /^\/api\/uploads\/perfis\/(\d+)\/([a-f0-9]{32}\.webp)$/

const listar = (pasta) => readdir(pasta, { withFileTypes: true }).catch(() => [])
const existe = (caminho) => stat(caminho).then(() => true, () => false)
// arquivo novo demais pode ser de um envio que ainda não gravou o registro: fica para a próxima
const velho = async (caminho, idadeMinimaMs) => Date.now() - (await stat(caminho)).mtimeMs >= idadeMinimaMs

/**
 * @returns {{ arquivos: number, registros: number, orfaos: object[], semArquivo: object[] }}
 * orfaos: { caminho, motivo, apagado }   semArquivo: { tipo, id, corrigido }
 */
export async function conferirFotos({ corrigir = false, idadeMinimaMs = 60 * 60 * 1000 } = {}) {
  const relatorio = { arquivos: 0, registros: 0, orfaos: [], semArquivo: [] }

  async function orfao(caminho, motivo, raiz) {
    if (!(await velho(caminho, idadeMinimaMs))) return
    const apagado = corrigir ? await apagarDoDisco(caminho, { tipo: 'orfao', motivo }) : false
    relatorio.orfaos.push({ caminho: path.relative(raiz, caminho).replaceAll('\\', '/'), motivo, apagado })
  }

  // percorre uma pasta de fotos: pasta/<id>/<arquivos>. donos: Map id -> Set dos arquivos esperados
  async function conferirPasta(raiz, pasta, donos, nomeValido, oQue) {
    for (const item of await listar(pasta)) {
      const caminhoDoItem = path.join(pasta, item.name)
      const id = /^\d+$/.test(item.name) ? Number(item.name) : null
      if (!item.isDirectory() || id === null || !donos.has(id)) {
        await orfao(caminhoDoItem, `${oQue} que não existe mais no banco`, raiz)
        continue
      }
      for (const arquivo of await listar(caminhoDoItem)) {
        relatorio.arquivos += 1
        if (!arquivo.isFile() || !nomeValido(arquivo.name) || !donos.get(id).has(arquivo.name)) {
          await orfao(path.join(caminhoDoItem, arquivo.name), 'arquivo sem registro no banco', raiz)
        }
      }
    }
  }

  // ---------------------------------------------------------------- fotos dos anúncios
  const [anuncios] = await db.query('SELECT id FROM anuncio')
  const [fotos] = await db.query('SELECT id, anuncio_id, arquivo FROM foto_anuncio')
  const doAnuncio = new Map(anuncios.map((a) => [a.id, new Set()]))
  for (const foto of fotos) {
    relatorio.registros += 1
    const nomes = LARGURAS_FOTO.map((largura) => `${foto.arquivo}-${largura}.webp`)
    nomes.forEach((nome) => doAnuncio.get(foto.anuncio_id)?.add(nome))
    const faltando = []
    for (const nome of nomes) if (!(await existe(path.join(PASTA_UPLOADS, 'anuncios', String(foto.anuncio_id), nome)))) faltando.push(nome)
    if (faltando.length === 0) continue
    // foto incompleta apareceria quebrada: o registro sai e o que restou dela no disco também
    if (corrigir) {
      await db.query('DELETE FROM foto_anuncio WHERE id = ?', [foto.id])
      for (const nome of nomes) await apagarDoDisco(path.join(PASTA_UPLOADS, 'anuncios', String(foto.anuncio_id), nome), { tipo: 'foto_anuncio', foto_id: foto.id })
      nomes.forEach((nome) => doAnuncio.get(foto.anuncio_id)?.delete(nome))
    }
    relatorio.semArquivo.push({ tipo: 'foto_anuncio', id: foto.id, anuncio_id: foto.anuncio_id, corrigido: corrigir })
  }
  await conferirPasta(PASTA_UPLOADS, path.join(PASTA_UPLOADS, 'anuncios'), doAnuncio, (nome) => FOTO_DO_ANUNCIO.test(nome), 'pasta de anúncio')

  // ---------------------------------------------------------------- fotos de perfil
  const [usuarios] = await db.query('SELECT id, foto_url FROM usuario')
  const doPerfil = new Map(usuarios.map((u) => [u.id, new Set()]))
  for (const usuario of usuarios) {
    const partes = URL_DO_PERFIL.exec(usuario.foto_url ?? '')
    if (!partes || Number(partes[1]) !== usuario.id) continue // sem foto própria (ou a do Google)
    relatorio.registros += 1
    doPerfil.get(usuario.id).add(partes[2])
    if (await existe(path.join(PASTA_UPLOADS, 'perfis', String(usuario.id), partes[2]))) continue
    if (corrigir) await db.query('UPDATE usuario SET foto_url = NULL WHERE id = ? AND foto_url = ?', [usuario.id, usuario.foto_url])
    relatorio.semArquivo.push({ tipo: 'foto_perfil', id: usuario.id, corrigido: corrigir })
  }
  await conferirPasta(PASTA_UPLOADS, path.join(PASTA_UPLOADS, 'perfis'), doPerfil, (nome) => FOTO_DE_PERFIL.test(nome), 'pasta de perfil')

  // ---------------------------------------------------------------- fotos do chat
  const [conversas] = await db.query('SELECT id FROM conversa')
  const [mensagens] = await db.query('SELECT id, conversa_id, foto, texto FROM mensagem WHERE foto IS NOT NULL')
  const daConversa = new Map(conversas.map((c) => [c.id, new Set()]))
  for (const mensagem of mensagens) {
    relatorio.registros += 1
    const nomes = LARGURAS_FOTO_DO_CHAT.map((largura) => `${mensagem.foto}-${largura}.webp`)
    nomes.forEach((nome) => daConversa.get(mensagem.conversa_id)?.add(nome))
    const faltando = []
    for (const nome of nomes) if (!(await existe(path.join(PASTA_PRIVADA, 'conversas', String(mensagem.conversa_id), nome)))) faltando.push(nome)
    if (faltando.length === 0) continue
    if (corrigir) {
      // mensagem só com a foto some; com texto, fica o texto
      if (mensagem.texto.trim() === '') await db.query('DELETE FROM mensagem WHERE id = ?', [mensagem.id])
      else await db.query('UPDATE mensagem SET foto = NULL WHERE id = ?', [mensagem.id])
      for (const nome of nomes) await apagarDoDisco(path.join(PASTA_PRIVADA, 'conversas', String(mensagem.conversa_id), nome), { tipo: 'foto_chat', mensagem_id: mensagem.id })
      nomes.forEach((nome) => daConversa.get(mensagem.conversa_id)?.delete(nome))
    }
    relatorio.semArquivo.push({ tipo: 'foto_chat', id: mensagem.id, conversa_id: mensagem.conversa_id, corrigido: corrigir })
  }
  // vídeos do chat (um arquivo por mensagem, com a extensão)
  const [comVideo] = await db.query('SELECT id, conversa_id, video, texto FROM mensagem WHERE video IS NOT NULL')
  for (const mensagem of comVideo) {
    relatorio.registros += 1
    daConversa.get(mensagem.conversa_id)?.add(mensagem.video)
    if (await existe(path.join(PASTA_PRIVADA, 'conversas', String(mensagem.conversa_id), mensagem.video))) continue
    if (corrigir) {
      // mensagem só com o vídeo some; com texto, fica o texto
      if (mensagem.texto.trim() === '') await db.query('DELETE FROM mensagem WHERE id = ?', [mensagem.id])
      else await db.query('UPDATE mensagem SET video = NULL WHERE id = ?', [mensagem.id])
      daConversa.get(mensagem.conversa_id)?.delete(mensagem.video)
    }
    relatorio.semArquivo.push({ tipo: 'video_chat', id: mensagem.id, conversa_id: mensagem.conversa_id, corrigido: corrigir })
  }
  await conferirPasta(PASTA_PRIVADA, path.join(PASTA_PRIVADA, 'conversas'), daConversa, (nome) => FOTO_DO_CHAT.test(nome) || VIDEO_DO_CHAT.test(nome), 'pasta de conversa')

  registrar('fotos.conferencia', { arquivos: relatorio.arquivos, registros: relatorio.registros, orfaos: relatorio.orfaos.length, sem_arquivo: relatorio.semArquivo.length, corrigir })
  return relatorio
}
