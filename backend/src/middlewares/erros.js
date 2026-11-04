import { env } from '../config/env.js'

// Qualquer rota que não existe cai aqui.
export function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` })
}

// Todo erro lançado nas rotas cai aqui. No Express 5, isso vale também para
// funções async, então os controllers não precisam de try/catch só para isso.
// O Express só reconhece este middleware porque ele tem os 4 parâmetros,
// por isso o "next" fica aqui mesmo sem ser usado.
export function tratarErros(erro, req, res, next) {
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' })
  }

  console.error(erro)
  res.status(erro.status ?? 500).json({
    erro: erro.status ? erro.message : 'Erro interno no servidor.',
    ...(env.producao ? {} : { detalhe: erro.message }),
  })
}
