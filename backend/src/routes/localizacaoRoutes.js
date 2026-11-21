// /api/localizacao (documentação em /api/docs)
import { Router } from 'express'
import * as localizacao from '../controllers/localizacaoController.js'
import { exigirLogin, identificarUsuario } from '../middlewares/autenticacao.js'
import { limiteBuscaGeografica, limiteGeocodificacao, limiteLocalizacao } from '../middlewares/limites.js'

export const localizacaoRoutes = Router()

// localização de quem está logado: o id vem do login, nunca da URL
localizacaoRoutes.post('/atual', exigirLogin, limiteLocalizacao, localizacao.registrarAtual)
localizacaoRoutes.get('/atual', exigirLogin, localizacao.consultarAtual)
localizacaoRoutes.patch('/atual', exigirLogin, limiteLocalizacao, localizacao.atualizarAtual)
localizacaoRoutes.delete('/atual', exigirLogin, localizacao.removerAtual)

localizacaoRoutes.get('/preferencias', exigirLogin, localizacao.consultarPreferencias)
localizacaoRoutes.put('/preferencias', exigirLogin, localizacao.salvarPreferencias)

// visitante também usa, informando a localização
localizacaoRoutes.get('/proximos', identificarUsuario, limiteBuscaGeografica, localizacao.proximos)
localizacaoRoutes.get('/mapa', identificarUsuario, limiteBuscaGeografica, localizacao.mapa)
localizacaoRoutes.get('/distancia', identificarUsuario, localizacao.distancia)
localizacaoRoutes.get('/endereco', identificarUsuario, limiteGeocodificacao, localizacao.enderecoDoPonto)
localizacaoRoutes.get('/sugestoes', identificarUsuario, localizacao.sugestoes)
localizacaoRoutes.get('/raios', localizacao.raios)
localizacaoRoutes.get('/cep/:cep', limiteGeocodificacao, localizacao.cep)

// localização do anúncio: as mesmas permissões do anúncio
localizacaoRoutes.get('/anuncios/:id', identificarUsuario, localizacao.localDoAnuncio)
localizacaoRoutes.post('/anuncios/:id', exigirLogin, localizacao.registrarLocalDoAnuncio)
localizacaoRoutes.patch('/anuncios/:id', exigirLogin, localizacao.atualizarLocalDoAnuncio)
