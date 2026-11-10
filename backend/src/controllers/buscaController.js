// Anthony. Já pronto para usar: req.usuario (null sem login), lerId/lerTexto/lerOpcao
// (utils/validacao) e formatarFoto (utils/fotos) para a foto_capa do card.
import { listarAnunciosAtivos } from '../models/buscaModel.js'

export async function pesquisar(req, res) {
  const anuncios = await listarAnunciosAtivos()

  res.json({ itens: anuncios })
}