import { env } from '../config/env.js'
import { erroHttp } from '../utils/erroHttp.js'
import { registrar } from '../utils/log.js'

const METODOS_QUE_ALTERAM = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Proteção extra contra CSRF: quem altera dados precisa vir do front (FRONTEND_URL).
// O navegador sempre manda o Origin nesses pedidos; ferramentas como o Postman e os testes não
// mandam, e seguem funcionando (o cookie sameSite=lax já barra os sites de fora).
export function exigirOrigemDoFront(req, res, next) {
  const origem = req.headers.origin
  if (!METODOS_QUE_ALTERAM.has(req.method) || !origem) return next()
  if (env.origensDoFront.includes(origem)) return next()
  const erro = erroHttp(403, 'Pedido de outra origem recusado.')
  erro.codigo = 'ORIGEM_NAO_PERMITIDA'
  next(erro)
}

// O cookie de login (sameSite lax) vai junto quando alguém clica em um link de outro site.
// A API só é chamada pelo site (fetch), então um link de fora apontando para ela é recusado.
// Ficam livres as fotos, a documentação e a rota de saúde, que podem ser abertas em uma aba.
const NAVEGACAO_LIVRE = /^\/api\/(uploads\/|docs(\/|$)|saude$|conversas\/\d+\/fotos\/)/
export function recusarLinkDeOutroSite(req, res, next) {
  const deOutroSite = req.headers['sec-fetch-site'] === 'cross-site' && req.headers['sec-fetch-mode'] === 'navigate'
  if (!deOutroSite || NAVEGACAO_LIVRE.test(req.path)) return next()
  const erro = erroHttp(403, 'Pedido de outra origem recusado.')
  erro.codigo = 'ORIGEM_NAO_PERMITIDA'
  next(erro)
}

// Log de acesso sem dado sensível: rota (sem a query, que pode ter coordenadas), status e tempo.
// Ligue com LOG_REQUISICOES=true no .env.
export function registrarRequisicoes(req, res, next) {
  if (!env.logRequisicoes) return next()
  const inicio = process.hrtime.bigint()
  res.on('finish', () => {
    registrar('http', {
      metodo: req.method,
      rota: (req.baseUrl ?? '') + (req.route?.path ?? req.path),
      status: res.statusCode,
      ms: Number((process.hrtime.bigint() - inicio) / 1_000_000n),
      usuario_id: req.usuario?.id ?? null,
    })
  })
  next()
}
