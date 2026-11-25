// A busca (GET /) é do Anthony; o resto é da Marina.
// O exigirLogin vem antes do receberFotos: sem login, a API nem lê os arquivos.
import { Router } from 'express'
import * as anuncio from '../controllers/anuncioController.js'
import * as busca from '../controllers/buscaController.js'
import * as denunciaAnuncio from '../controllers/denunciaAnuncioController.js'
import { exigirLogin, identificarUsuario } from '../middlewares/autenticacao.js'
import { limiteBuscaGeografica, limiteGravacao, limiteMidia, limitePublicar } from '../middlewares/limites.js'
import { receberFotos } from '../middlewares/upload.js'

export const anuncioRoutes = Router()

anuncioRoutes.get('/', identificarUsuario, limiteBuscaGeografica, busca.pesquisar)
anuncioRoutes.get('/:id', identificarUsuario, anuncio.verAnuncio)
anuncioRoutes.post('/', exigirLogin, limitePublicar, receberFotos, anuncio.publicar)
anuncioRoutes.put('/:id', exigirLogin, limiteGravacao, anuncio.editar)
anuncioRoutes.patch('/:id/status', exigirLogin, limiteGravacao, anuncio.mudarStatus)
anuncioRoutes.delete('/:id', exigirLogin, limiteGravacao, anuncio.excluir)
anuncioRoutes.post('/:id/fotos', exigirLogin, limiteMidia, receberFotos, anuncio.adicionarFotos)
anuncioRoutes.patch('/:id/fotos/:fotoId/capa', exigirLogin, limiteGravacao, anuncio.definirCapa)
anuncioRoutes.delete('/:id/fotos/:fotoId', exigirLogin, limiteGravacao, anuncio.removerFoto)
// denunciar (os três pontinhos da página do anúncio): 3 pessoas diferentes tiram o anúncio da busca até a equipe revisar
anuncioRoutes.get('/:id/denuncia', exigirLogin, denunciaAnuncio.ver)
anuncioRoutes.post('/:id/denuncia', exigirLogin, limiteGravacao, denunciaAnuncio.criar)

export const meusAnunciosRoutes = Router()

meusAnunciosRoutes.get('/', exigirLogin, anuncio.meusAnuncios)
