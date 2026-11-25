// Comparação de anúncios com a IA do DesapegaUai (pública: quem não entrou também compara).
// A referência de local é a mesma da busca por proximidade: latitude e longitude, bairro_id ou cidade_id, e raio_km.
import * as comparacao from '../services/comparacaoService.js'
import { sugerirPreco } from '../services/sugestaoDePrecoService.js'
import { erroHttp } from '../utils/erroHttp.js'
import { lerId, lerTexto } from '../utils/validacao.js'

// GET /api/comparacao/busca?busca=bicicleta&cidade_id=1&raio_km=5 (os mesmos filtros e o mesmo raio da busca)
export async function porBusca(req, res) {
  res.json(await comparacao.compararBusca(req.query, req.usuario?.id ?? null))
}

// GET /api/comparacao?ids=3,7,9 (de 2 a 4 anúncios), com a referência da distância
export async function porIds(req, res) {
  const texto = lerTexto(req.query.ids, 'ids', { obrigatorio: true, max: 60 })
  const ids = [...new Set(texto.split(',').map((parte) => lerId(parte.trim(), 'id do anúncio')))]
  if (ids.length < 2 || ids.length > comparacao.MAXIMO_PARA_COMPARAR) {
    throw erroHttp(400, `Escolha de 2 a ${comparacao.MAXIMO_PARA_COMPARAR} anúncios para comparar.`)
  }
  res.json(await comparacao.compararIds(ids, req.query, req.usuario?.id ?? null))
}

// GET /api/comparacao/sugestao-de-preco?titulo=Bicicleta aro 29&condicao=usado&bairro_id=1 (ao anunciar)
export async function sugestaoDePreco(req, res) {
  res.json(await sugerirPreco(req.query, req.usuario?.id ?? null))
}
