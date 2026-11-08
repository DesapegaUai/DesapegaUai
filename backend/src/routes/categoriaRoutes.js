import { Router } from 'express'
import * as categoria from '../controllers/categoriaController.js'

export const categoriaRoutes = Router()

categoriaRoutes.get('/', categoria.listar)
