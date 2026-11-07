// Todas as rotas já estão ligadas aqui: ninguém precisa mexer neste arquivo.
import { Router } from 'express'
import * as saude from '../controllers/saudeController.js'
import { anuncioRoutes, meusAnunciosRoutes } from './anuncioRoutes.js'
import { authRoutes } from './authRoutes.js'
import { categoriaRoutes } from './categoriaRoutes.js'
import { conversaRoutes } from './conversaRoutes.js'
import { favoritoRoutes } from './favoritoRoutes.js'
import { localRoutes } from './localRoutes.js'
import { perfilRoutes } from './perfilRoutes.js'

export const rotas = Router()

rotas.get('/saude', saude.verificar)
rotas.use('/auth', authRoutes)
rotas.use('/perfil', perfilRoutes)
rotas.use('/categorias', categoriaRoutes)
rotas.use('/cidades', localRoutes)
rotas.use('/anuncios', anuncioRoutes)
rotas.use('/meus-anuncios', meusAnunciosRoutes)
rotas.use('/favoritos', favoritoRoutes)
rotas.use('/conversas', conversaRoutes)
