// Log de operações sem dado sensível (LGPD): coordenadas, endereço, CEP, e-mail, telefone,
// tokens, chaves de push e texto de mensagem nunca vão para o terminal.
import { env } from '../config/env.js'

const SENSIVEIS = new Set([
  'lat', 'lng', 'latitude', 'longitude', 'latitude_publica', 'longitude_publica',
  'email', 'telefone', 'token', 'cookie', 'credential', 'texto', 'mensagem_texto', 'endereco', 'street', 'rua',
  'postal_code', 'cep', 'senha', 'p256dh', 'auth', 'endpoint', 'bbox',
])

export function limparDados(valor, profundidade = 0) {
  if (valor === null || typeof valor !== 'object' || profundidade > 3) return valor
  if (Array.isArray(valor)) return valor.map((item) => limparDados(item, profundidade + 1))
  const limpo = {}
  for (const [chave, conteudo] of Object.entries(valor)) {
    limpo[chave] = SENSIVEIS.has(chave.toLowerCase()) ? '[omitido]' : limparDados(conteudo, profundidade + 1)
  }
  return limpo
}

// registrar('localizacao.atualizada', { usuario_id: 3, cidade_id: 1, precisao_m: 12 })
export function registrar(evento, dados = {}) {
  if (env.silenciarLogs) return
  console.log(JSON.stringify({ em: new Date().toISOString(), evento, ...limparDados(dados) }))
}
