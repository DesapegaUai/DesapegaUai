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
