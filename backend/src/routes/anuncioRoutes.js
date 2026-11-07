// A busca (GET /) é do Anthony; o resto é da Marina.
// O exigirLogin vem antes do receberFotos: sem login, a API nem lê os arquivos.
import { Router } from 'express'
import * as anuncio from '../controllers/anuncioController.js'
import * as busca from '../controllers/buscaController.js'
import { exigirLogin, identificarUsuario } from '../middlewares/autenticacao.js'
import { receberFotos } from '../middlewares/upload.js'

export const anuncioRoutes = Router()

anuncioRoutes.get('/', identificarUsuario, busca.pesquisar)
anuncioRoutes.get('/:id', identificarUsuario, anuncio.verAnuncio)
anuncioRoutes.post('/', exigirLogin, receberFotos, anuncio.publicar)
anuncioRoutes.put('/:id', exigirLogin, anuncio.editar)
anuncioRoutes.patch('/:id/status', exigirLogin, anuncio.mudarStatus)
anuncioRoutes.delete('/:id', exigirLogin, anuncio.excluir)
anuncioRoutes.post('/:id/fotos', exigirLogin, receberFotos, anuncio.adicionarFotos)
anuncioRoutes.delete('/:id/fotos/:fotoId', exigirLogin, anuncio.removerFoto)

export const meusAnunciosRoutes = Router()

meusAnunciosRoutes.get('/', exigirLogin, anuncio.meusAnuncios)
