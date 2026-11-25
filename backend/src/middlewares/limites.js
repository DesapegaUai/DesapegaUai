// Limites de requisições (rate limiting). Resposta 429 no formato padrão de erro da API.
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { env } from '../config/env.js'

function criarLimite({ minutos, maximo, mensagem, porUsuario = false, sempre = false }) {
  return rateLimit({
    windowMs: minutos * 60 * 1000,
    limit: maximo,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // os limites antigos só valem em produção; os de localização valem sempre (menos nos testes,
    // a não ser no teste de segurança, que liga com TESTAR_LIMITES=true)
    skip: () => (env.emTeste && process.env.TESTAR_LIMITES !== 'true') || (!sempre && !env.producao),
    handler: (req, res, next, opcoes) => {
      res.status(opcoes.statusCode).json({ erro: mensagem, codigo: 'MUITAS_REQUISICOES', status: opcoes.statusCode })
    },
    ...(porUsuario ? { keyGenerator: (req) => (req.usuario ? `usuario-${req.usuario.id}` : `ip-${ipKeyGenerator(req.ip)}`) } : {}),
  })
}

// por IP e folgado: no workshop, muita gente entra pelo mesmo Wi-Fi
export const limiteLogin = criarLimite({
  minutos: 15,
  maximo: 100,
  mensagem: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
})

export const limitePublicar = criarLimite({
  minutos: 60,
  maximo: 30,
  porUsuario: true,
  mensagem: 'Você salvou muitos anúncios em pouco tempo. Aguarde um pouco e tente de novo.',
})

// gravar a localização: o front manda no máximo a cada 15 s; 60 por minuto já é abuso
export const limiteLocalizacao = criarLimite({
  minutos: 1,
  maximo: 60,
  porUsuario: true,
  sempre: true,
  mensagem: 'Muitas atualizações de localização em pouco tempo. Aguarde um pouco.',
})

// buscas por proximidade e marcadores do mapa (o mapa pede a cada movimento)
export const limiteBuscaGeografica = criarLimite({
  minutos: 1,
  maximo: 240,
  porUsuario: true,
  sempre: true,
  mensagem: 'Muitas buscas em pouco tempo. Aguarde alguns segundos.',
})

// mensagens e fotos do chat mandadas pela API: o tempo real já limita, este fecha o outro caminho
export const limiteMensagens = criarLimite({
  minutos: 1,
  maximo: 60,
  porUsuario: true,
  sempre: true,
  mensagem: 'Muitas mensagens em pouco tempo. Aguarde alguns segundos.',
})

// fotos, vídeos e áudios (chat, foto de perfil e fotos novas de anúncio): cada um passa pela IA da
// moderação, e o vídeo e o áudio pelo ffmpeg. Folgado para quem conversa, mas segura quem manda em massa
export const limiteMidia = criarLimite({
  minutos: 10,
  maximo: 60,
  porUsuario: true,
  sempre: true,
  mensagem: 'Muitas fotos, vídeos ou áudios em pouco tempo. Aguarde alguns minutos e tente de novo.',
})

// o resto do que grava (favoritar, abrir conversa, pedido do Procura-se, perfil, avaliação, denúncia)
export const limiteGravacao = criarLimite({
  minutos: 1,
  maximo: 120,
  porUsuario: true,
  sempre: true,
  mensagem: 'Muitas ações em pouco tempo. Aguarde alguns segundos.',
})

// endereço de um ponto (usa o OpenStreetMap, que pede no máximo 1 por segundo)
export const limiteGeocodificacao = criarLimite({
  minutos: 1,
  maximo: 30,
  porUsuario: true,
  sempre: true,
  mensagem: 'Muitas consultas de endereço em pouco tempo. Aguarde um pouco.',
})
