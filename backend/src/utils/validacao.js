// Validação do que chega do usuário. Dado inválido vira erro 400 com a mensagem em português.
import { erroHttp } from './erroHttp.js'

const MAIOR_ID = 4_294_967_295 // maior INT UNSIGNED do MySQL

// lerId(req.params.id, 'id do anúncio'): devolve o número ou dá 400
export function lerId(valor, nome = 'id') {
  const texto = typeof valor === 'number' ? String(valor) : valor
  const numero = Number(texto)
  if (typeof texto !== 'string' || !/^\d{1,10}$/.test(texto) || numero < 1 || numero > MAIOR_ID) {
    throw erroHttp(400, `O ${nome} precisa ser um número inteiro positivo.`)
  }
  return numero
}

// lerTexto(corpo.titulo, 'titulo', { obrigatorio: true, min: 3, max: 80 })
// Tira os espaços das pontas; vazio vira null (ou 400 se for obrigatório).
export function lerTexto(valor, nome, { obrigatorio = false, min = 0, max = Infinity } = {}) {
  if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
    if (obrigatorio) throw erroHttp(400, `O campo ${nome} é obrigatório.`)
    return null
  }
  if (typeof valor !== 'string') throw erroHttp(400, `O campo ${nome} precisa ser um texto.`)

  const texto = valor.trim().normalize('NFC')
  const tamanho = [...texto].length // conta igual ao MySQL (emoji vale 1)
  if (tamanho < min) throw erroHttp(400, `O campo ${nome} precisa ter pelo menos ${min} caracteres.`)
  if (tamanho > max) throw erroHttp(400, `O campo ${nome} pode ter no máximo ${max} caracteres.`)
  return texto
}

// lerOpcao(corpo.status, 'status', ['ativo', 'vendido']); com { obrigatorio: false }, vazio vira null
export function lerOpcao(valor, nome, opcoes, { obrigatorio = true } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (!obrigatorio) return null
    throw erroHttp(400, `O campo ${nome} é obrigatório: ${opcoes.join(', ')}.`)
  }
  if (!opcoes.includes(valor)) {
    throw erroHttp(400, `O campo ${nome} precisa ser: ${opcoes.join(', ')}.`)
  }
  return valor
}
