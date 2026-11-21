// Apagar arquivo ou pasta de fotos sem derrubar o pedido.
// A regra da API: o registro do banco sai primeiro e o arquivo sai depois. Se o disco falhar, o pedido
// termina bem (a pessoa não vê mais a foto), a falha vai para o log e a conferência de fotos
// (npm run fotos) apaga o que sobrou.
import { rm } from 'node:fs/promises'
import { env } from '../config/env.js'
import { registrar } from './log.js'

let falhaSimulada = false

// só nos testes: faz o apagar falhar, como um disco com problema
export function simularFalhaAoApagar(ativo) {
  if (env.emTeste) falhaSimulada = Boolean(ativo)
}

// Arquivo que já não existe não é erro. Devolve true se saiu e false se o disco falhou.
// contexto: o que vai para o log (tipo e ids), nunca o conteúdo da foto.
export async function apagarDoDisco(caminho, contexto = {}) {
  try {
    if (falhaSimulada) throw Object.assign(new Error('falha simulada'), { code: 'FALHA_SIMULADA' })
    await rm(caminho, { recursive: true, force: true, maxRetries: 2 })
    return true
  } catch (erro) {
    registrar('foto.arquivo_nao_apagado', { ...contexto, motivo: erro.code ?? erro.message })
    return false
  }
}
