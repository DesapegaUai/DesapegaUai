// Notificação push (Web Push): chega no celular ou no computador mesmo com o site fechado,
// enquanto a pessoa não sair da conta naquele aparelho. Precisa das chaves VAPID no .env.
import webpush from 'web-push'
import { env } from '../config/env.js'
import * as notificacaoRepository from '../repositories/notificacaoRepository.js'
import { registrar } from '../utils/log.js'

export const pushConfigurado = Boolean(env.vapid.publica && env.vapid.privada)

if (pushConfigurado) {
  webpush.setVapidDetails(env.vapid.contato, env.vapid.publica, env.vapid.privada)
} else if (!env.emTeste) {
  console.warn('Push desligado: faltam VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no backend/.env (gere com: npx web-push generate-vapid-keys).')
}

export const chavePublica = () => (pushConfigurado ? env.vapid.publica : null)

// ---------------------------------------------------------------- conteúdo dos avisos no celular
// No padrão dos apps grandes (Mercado Livre, OLX, WhatsApp): título curto, porque no Android ele divide a
// linha com o nome do app e a hora (título comprido corta: "Novo anúncio: Ca..."); o resto vai no texto; e
// a imagem do próprio aviso à direita. O sininho do site tem espaço e continua com os textos completos.
// O aparelho (public/sw.js) põe a carinha do Uai no lugar do sino e troca imagem que não carregar pela logo.

const formatarPreco = (preco) => Number(preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// as mesmas iniciais do avatar sem foto do site (primeira letra de até dois nomes)
export const iniciaisDe = (nome) => String(nome ?? '').split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()

// ★★★★☆
export const estrelas = (nota) => {
  const cheias = Math.max(0, Math.min(5, Math.round(Number(nota) || 0)))
  return '★'.repeat(cheias) + '☆'.repeat(5 - cheias)
}

/**
 * Aviso sobre um anúncio: "título curto" + "anúncio · preço · bairro, cidade", a foto pequena à direita e
 * a foto média quando a pessoa puxa a notificação para baixo. detalhe troca o preço (ex.: "de R$ 900 por
 * R$ 750"); chamada vem antes do nome do anúncio (ex.: "Achamos: ").
 */
export function avisoDeAnuncio(anuncio, { titulo, detalhe = null, chamada = '', tag }) {
  const foto = anuncio.fotos?.[0] ?? null
  const local = [anuncio.bairro, anuncio.cidade].filter(Boolean).join(', ')
  return {
    titulo,
    texto: [`${chamada}${anuncio.titulo}`, detalhe ?? formatarPreco(anuncio.preco), local].filter(Boolean).join(' · ').slice(0, 255),
    url: `/anuncio/${anuncio.id}`,
    icone: foto?.pequena ?? null,
    imagem: foto?.media ?? null,
    tag,
  }
}

/** Avaliação recebida: as estrelas e quem avaliou, com a foto (ou as iniciais) dessa pessoa à direita */
export function avisoDeAvaliacao(avaliacao) {
  const quem = avaliacao.avaliador_nome ?? 'Alguém'
  return {
    titulo: 'Nova avaliação',
    texto: `${estrelas(avaliacao.nota)} ${quem} avaliou a negociação de ${avaliacao.anuncio_titulo}.`.slice(0, 255),
    url: '/perfil',
    icone: avaliacao.avaliador_foto ?? null,
    iniciais: avaliacao.avaliador_foto ? null : iniciaisDe(quem),
    tag: `avaliacao-${avaliacao.id}`,
  }
}

/**
 * Envia o mesmo conteúdo para todos os aparelhos das pessoas. Não espera a entrega: quem chama
 * segue em frente. Aparelho que não existe mais (404/410) sai do banco.
 */
export async function enviarPara(usuarioIds, conteudo) {
  if (!pushConfigurado || !usuarioIds.length) return { enviados: 0 }
  const inscricoes = await notificacaoRepository.inscricoesDe([...new Set(usuarioIds)])
  const corpo = JSON.stringify(conteudo)
  let enviados = 0
  await Promise.all(inscricoes.map(async (i) => {
    try {
      await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, corpo, { TTL: 60 * 60 * 24, urgency: 'normal' })
      enviados++
    } catch (erro) {
      if (erro.statusCode === 404 || erro.statusCode === 410) {
        await notificacaoRepository.apagarInscricaoPorHash(i.endpoint_hash)
      } else {
        registrar('push.falhou', { usuario_id: i.usuario_id, status: erro.statusCode ?? null })
      }
    }
  }))
  return { enviados }
}
