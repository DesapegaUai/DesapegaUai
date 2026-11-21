import { env } from '../config/env.js'

// Formato padrão de erro da API:
//   { "erro": "mensagem em português", "codigo": "NAO_ENCONTRADO", "status": 404, "campos": ["..."] }
// O front mostra o "erro"; o "codigo" serve para tratar casos específicos (ex.: FORA_DA_AREA).
const CODIGO_PADRAO = {
  400: 'DADOS_INVALIDOS',
  401: 'NAO_AUTENTICADO',
  403: 'SEM_PERMISSAO',
  404: 'NAO_ENCONTRADO',
  409: 'CONFLITO',
  413: 'CONTEUDO_GRANDE_DEMAIS',
  422: 'NAO_PROCESSAVEL',
  429: 'MUITAS_REQUISICOES',
  500: 'ERRO_INTERNO',
  503: 'SERVICO_INDISPONIVEL',
}

function responder(res, status, mensagem, extras = {}) {
  res.status(status).json({ erro: mensagem, codigo: extras.codigo ?? CODIGO_PADRAO[status] ?? 'ERRO', status, ...extras })
}

export function rotaNaoEncontrada(req, res) {
  responder(res, 404, `Rota não encontrada: ${req.method} ${req.path}`, { codigo: 'ROTA_NAO_ENCONTRADA' })
}

// Todo erro das rotas cai aqui, até de função async: no controller é só dar throw erroHttp(...).
// Precisa dos 4 parâmetros (mesmo sem usar o next) para o Express saber que é tratador de erro.
export function tratarErros(erro, req, res, next) {
  if (erro.type === 'entity.parse.failed') return responder(res, 400, 'JSON inválido no corpo da requisição.', { codigo: 'JSON_INVALIDO' })
  if (erro.type === 'entity.too.large') return responder(res, 413, 'O conteúdo enviado é grande demais.')
  if (erro instanceof URIError) return responder(res, 400, 'Endereço inválido.')

  const status = Number.isInteger(erro.status) && erro.status >= 400 && erro.status < 600 ? erro.status : 500
  // 4xx não vai para o terminal; o 500 vai sem o corpo da requisição (pode ter dado pessoal)
  if (status >= 500) console.error(`[${req.method} ${req.path}]`, erro)
  if (erro.tentarDeNovoEm) res.set('Retry-After', String(erro.tentarDeNovoEm))

  responder(res, status, status < 500 ? erro.message : 'Erro interno no servidor.', {
    ...(erro.codigo ? { codigo: erro.codigo } : {}),
    ...(erro.campos ? { campos: erro.campos } : {}),
    ...(!env.producao && status >= 500 ? { detalhe: erro.message } : {}),
  })
}
