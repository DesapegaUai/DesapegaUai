// Comparação com a IA do DesapegaUai: pública (sem login também compara); com login, o coração dos favoritos aparece
import { Router } from 'express'
import * as comparacao from '../controllers/comparacaoController.js'
import { identificarUsuario } from '../middlewares/autenticacao.js'
import { limiteBuscaGeografica } from '../middlewares/limites.js'

export const comparacaoRoutes = Router()

comparacaoRoutes.get('/', identificarUsuario, limiteBuscaGeografica, comparacao.porIds)
comparacaoRoutes.get('/busca', identificarUsuario, limiteBuscaGeografica, comparacao.porBusca)
// sugestão de preço ao anunciar: a faixa de preço dos parecidos perto de onde o produto está
comparacaoRoutes.get('/sugestao-de-preco', identificarUsuario, limiteBuscaGeografica, comparacao.sugestaoDePreco)
