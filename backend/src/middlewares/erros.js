import { env } from '../config/env.js'

export function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` })
}

// Todo erro das rotas cai aqui, até de função async: no controller é só dar throw erroHttp(...).
// Precisa dos 4 parâmetros (mesmo sem usar o next) para o Express saber que é tratador de erro.
export function tratarErros(erro, req, res, next) {
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' })
  }

  if (!erro.status || erro.status >= 500) console.error(erro) // 4xx não precisa ir pro terminal
  res.status(erro.status ?? 500).json({
    erro: erro.status ? erro.message : 'Erro interno no servidor.',
    ...(env.producao ? {} : { detalhe: erro.message }),
  })
}
