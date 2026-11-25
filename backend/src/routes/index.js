// Todas as rotas da API. A documentação (Swagger/OpenAPI) fica em /api/docs.
import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import * as saude from '../controllers/saudeController.js'
import { especificacao } from '../docs/openapi.js'
import { anuncioRoutes, meusAnunciosRoutes } from './anuncioRoutes.js'
import { avaliacaoRoutes } from './avaliacaoRoutes.js'
import { authRoutes } from './authRoutes.js'
import { categoriaRoutes } from './categoriaRoutes.js'
import { comparacaoRoutes } from './comparacaoRoutes.js'
import { conversaRoutes } from './conversaRoutes.js'
import { favoritoRoutes } from './favoritoRoutes.js'
import { listaDeComprasRoutes } from './listaDeComprasRoutes.js'
import { localRoutes } from './localRoutes.js'
import { localizacaoRoutes } from './localizacaoRoutes.js'
import { notificacaoRoutes } from './notificacaoRoutes.js'
import { perfilRoutes } from './perfilRoutes.js'
import { procuraRoutes } from './procuraRoutes.js'
import { usuarioRoutes } from './usuarioRoutes.js'

export const rotas = Router()

rotas.get('/saude', saude.verificar)
rotas.get('/docs/openapi.json', (req, res) => res.json(especificacao))
rotas.use('/docs', swaggerUi.serve, swaggerUi.setup(especificacao, { customSiteTitle: 'API do DesapegaUai' }))
rotas.use('/auth', authRoutes)
rotas.use('/perfil', perfilRoutes)
rotas.use('/usuarios', usuarioRoutes)
rotas.use('/categorias', categoriaRoutes)
rotas.use('/cidades', localRoutes)
rotas.use('/localizacao', localizacaoRoutes)
rotas.use('/anuncios', anuncioRoutes)
rotas.use('/meus-anuncios', meusAnunciosRoutes)
rotas.use('/favoritos', favoritoRoutes)
rotas.use('/conversas', conversaRoutes)
rotas.use('/avaliacoes', avaliacaoRoutes)
rotas.use('/notificacoes', notificacaoRoutes)
rotas.use('/procuras', procuraRoutes)
rotas.use('/comparacao', comparacaoRoutes)
rotas.use('/lista-compras', listaDeComprasRoutes)
