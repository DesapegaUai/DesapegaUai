import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js'
import { exigirOrigemDoFront, recusarLinkDeOutroSite, registrarRequisicoes } from './middlewares/seguranca.js'
import { rotas } from './routes/index.js'
import { entregarSite } from './site.js'
import { aplicarMetas, metasDaPagina, rotasDoGoogle } from './seo.js'
import { PASTA_UPLOADS } from './utils/fotos.js'

export const app = express()

// atrás do proxy da hospedagem, o IP real vem no X-Forwarded-For
if (env.producao) app.set('trust proxy', 1)

app.use(helmet())

// em produção, tudo o que não é /api é o site (frontend/dist); fica antes das travas da API
// para que o link do site possa ser aberto a partir de qualquer lugar (WhatsApp, Instagram...)
const site = env.producao ? entregarSite({ metas: { daPagina: metasDaPagina, aplicar: aplicarMetas } }) : null
// robots.txt, sitemap.xml e a imagem de prévia dos anúncios vêm antes do site
if (site) app.use(rotasDoGoogle())
if (site) app.use(site)

app.use(cors({ origin: env.origensDoFront, credentials: true })) // só o front pode chamar a API
app.use(registrarRequisicoes)
app.use(exigirOrigemDoFront)
app.use(recusarLinkDeOutroSite)
app.use(express.json({ limit: '100kb' }))

// fotos dos anúncios; o helmet bloqueia imagem de outra origem, então aqui libera
app.use(
  '/api/uploads',
  (req, res, next) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin')
    next()
  },
  express.static(PASTA_UPLOADS, { index: false, maxAge: '30d', immutable: true }),
)

app.use('/api', rotas)

app.use(rotaNaoEncontrada)
app.use(tratarErros)
