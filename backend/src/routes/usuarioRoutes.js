import { Router } from 'express'
import * as usuario from '../controllers/usuarioController.js'

export const usuarioRoutes = Router()

// público: quem não está logado também vê o perfil do vendedor
usuarioRoutes.get('/:id', usuario.verPerfilPublico)
