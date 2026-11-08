import { Router } from 'express'
import * as local from '../controllers/localController.js'

export const localRoutes = Router()

localRoutes.get('/', local.listarCidades)
localRoutes.get('/:id/bairros', local.listarBairros)
