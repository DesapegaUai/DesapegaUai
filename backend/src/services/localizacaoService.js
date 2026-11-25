// Regras do módulo de localização.
// Coordenada exata do anúncio, rua e CEP: só o dono. Para os outros, o ponto aproximado.
// Coordenada nunca vai para o log.
import { db } from '../config/db.js'
import * as anuncioModel from '../models/anuncioModel.js'
import * as localRepository from '../repositories/localRepository.js'
import * as repo from '../repositories/localizacaoRepository.js'
import { avisarUsuarios, publicarParaTodos } from '../socket.js'
import { erroHttp } from '../utils/erroHttp.js'
import { formatarFoto } from '../utils/fotos.js'
import {
  distanciaKm, pontoAproximado, pontoNoMunicipio, RAIO_APROXIMACAO_M, RAIO_MAXIMO_KM, RAIO_MINIMO_KM, RAIO_PADRAO_KM, RAIOS,
} from '../utils/geo.js'
import { registrar } from '../utils/log.js'
import {
  decidirAtualizacao, localizacaoDesatualizada, localizacaoVisivel, metrosParaKm, ordenarPorDistancia,
} from '../utils/regrasLocalizacao.js'
import { lerId, lerOpcao, lerTexto } from '../utils/validacao.js'
import * as v from '../validations/localizacaoValidation.js'

function erro(status, mensagem, codigo, campos = null) {
  const e = erroHttp(status, mensagem)
  e.codigo = codigo
  if (campos) e.campos = campos
  return e
}

const numeroOuNull = (valor) => (valor === null || valor === undefined ? null : Number(valor))
const vazio = (valor) => valor === undefined || valor === null || valor === ''

function exigirObjeto(corpo, oQue) {
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
    throw erro(400, `Envie ${oQue} em JSON.`, 'DADOS_INVALIDOS')
  }
}

// ---------------------------------------------------------------- formatos de resposta

function formatarLocalizacaoDoUsuario(l) {
  if (!l) return null
  const idadeMs = Date.now() - new Date(l.capturada_em).getTime()
  return {
    latitude: Number(l.latitude),
    longitude: Number(l.longitude),
    precisao_m: numeroOuNull(l.precisao_m),
    origem: l.origem,
    capturada_em: l.capturada_em,
    atualizada_em: l.atualizada_em,
    expira_em: new Date(new Date(l.atualizada_em).getTime() + repo.RETENCAO_DIAS * 86_400_000),
    desatualizada: localizacaoDesatualizada(l),
    idade_min: Math.max(0, Math.floor(idadeMs / 60000)),
    cidade: { id: l.cidade_id, nome: l.cidade, uf: l.uf },
    bairro: l.bairro_id ? { id: l.bairro_id, nome: l.bairro } : null,
  }
}

function formatarPreferencias(p) {
  return {
    raio_km: Number(p.raio_km),
    modo: p.modo,
    compartilhar_localizacao: Boolean(p.compartilhar),
    cidade_manual: p.cidade_id ? { id: p.cidade_id, nome: p.cidade } : null,
    bairro_manual: p.bairro_id ? { id: p.bairro_id, nome: p.bairro } : null,
    atualizada_em: p.atualizada_em,
  }
}

// ---------------------------------------------------------------- cidade e bairro

async function cidadeEBairroDoPonto({ latitude, longitude, codigoIbge }) {
  let cidade = codigoIbge ? await localRepository.buscarCidadePorIbge(codigoIbge) : null
  if (!cidade) {
    // perto da divisa (erro do GPS): fica com a cidade de sede mais próxima
    const cidades = await localRepository.listarCidades()
    cidade = cidades.reduce((perto, c) => {
      const d = distanciaKm(latitude, longitude, Number(c.latitude), Number(c.longitude))
      return !perto || d < perto.d ? { ...c, d } : perto
    }, null)
  }
  const bairro = await localRepository.bairroMaisProximo(cidade.id, latitude, longitude)
  return { cidade, bairro }
}

async function cidadeEBairroEscolhidos(corpo) {
  const cidadeId = v.lerIdOpcional(corpo.cidade_id, 'cidade_id')
  const bairroId = v.lerIdOpcional(corpo.bairro_id, 'bairro_id')
  if (!cidadeId && !bairroId) {
    throw erro(400, 'Escolha a cidade (cidade_id) e, se quiser, o bairro (bairro_id).', 'DADOS_INVALIDOS', ['cidade_id'])
  }
  const bairro = bairroId ? await localRepository.buscarBairro(bairroId) : null
  if (bairroId && !bairro) throw erro(404, 'Bairro não encontrado.', 'BAIRRO_NAO_ENCONTRADO', ['bairro_id'])
  if (bairro && cidadeId && Number(bairro.cidade_id) !== Number(cidadeId)) {
    throw erro(400, 'Esse bairro não é da cidade escolhida.', 'DADOS_INVALIDOS', ['bairro_id'])
  }
  const cidade = await localRepository.buscarCidade(cidadeId ?? bairro.cidade_id)
  if (!cidade) throw erro(404, 'Cidade não encontrada.', 'CIDADE_NAO_ENCONTRADA', ['cidade_id'])
  return { cidade, bairro }
}

// ---------------------------------------------------------------- localização do usuário

export async function consultarLocalizacaoAtual(usuarioId) {
  return formatarLocalizacaoDoUsuario(await repo.buscarLocalizacaoDoUsuario(usuarioId))
}

// GPS: { latitude, longitude, precisao_m, capturada_em }; manual: { origem: 'manual', cidade_id, bairro_id }
export async function salvarLocalizacaoAtual(usuarioId, corpo, { exigirExistente = false } = {}) {
  exigirObjeto(corpo, 'a localização')
  const atual = await repo.buscarLocalizacaoDoUsuario(usuarioId)
  if (exigirExistente && !atual) {
    throw erro(404, 'Você ainda não registrou uma localização. Use POST /api/localizacao/atual.', 'LOCALIZACAO_NAO_ENCONTRADA')
  }

  const temCoordenadas = !vazio(corpo.latitude) || !vazio(corpo.longitude)
  const origem = v.lerOrigem(corpo.origem, ['gps', 'manual'], 'origem') ?? (temCoordenadas ? 'gps' : 'manual')

  let nova
  if (origem === 'gps') {
    const ponto = v.lerCoordenadas(corpo.latitude, corpo.longitude, { obrigatorio: true })
    const { cidade, bairro } = await cidadeEBairroDoPonto(ponto)
    nova = {
      latitude: ponto.latitude, longitude: ponto.longitude, precisao: v.lerPrecisao(corpo.precisao_m),
      origem: 'gps', cidadeId: cidade.id, bairroId: bairro?.id ?? null, capturadaEm: v.lerMomento(corpo.capturada_em),
    }
  } else {
    const { cidade, bairro } = await cidadeEBairroEscolhidos(corpo)
    // ponto marcado no mapa é opcional, mas tem que ser da cidade
    const ponto = v.lerCoordenadas(corpo.latitude, corpo.longitude)
    if (ponto && !pontoNoMunicipio(ponto.latitude, ponto.longitude, cidade.codigo_ibge)) {
      throw erro(422, `O ponto escolhido não fica em ${cidade.nome}.`, 'FORA_DA_CIDADE', ['latitude'])
    }
    const base = ponto ?? bairro ?? cidade
    nova = {
      latitude: Number(base.latitude), longitude: Number(base.longitude), precisao: null,
      origem: 'manual', cidadeId: cidade.id, bairroId: bairro?.id ?? null, capturadaEm: new Date(),
    }
  }

  const decisao = decidirAtualizacao(atual, nova)
  if (decisao.motivo) return { localizacao: formatarLocalizacaoDoUsuario(atual), atualizada: false, criada: false, motivo: decisao.motivo }
  if (decisao.aguardarMs) {
    const e = erro(429, 'A localização foi atualizada há poucos segundos. Aguarde um pouco.', 'MUITAS_REQUISICOES')
    e.tentarDeNovoEm = Math.max(1, Math.ceil(decisao.aguardarMs / 1000))
    throw e
  }

  await repo.salvarLocalizacaoDoUsuario(usuarioId, nova)
  const preferencias = await repo.buscarPreferencias(usuarioId)
  await repo.salvarPreferencias(usuarioId, {
    ...preferencias,
    compartilhar: true,
    modo: nova.origem,
    cidade_id: nova.origem === 'manual' ? nova.cidadeId : preferencias.cidade_id,
    bairro_id: nova.origem === 'manual' ? nova.bairroId : preferencias.bairro_id,
  })

  registrar('localizacao.usuario.salva', { usuario_id: usuarioId, origem: nova.origem, cidade_id: nova.cidadeId, precisao_m: nova.precisao })
  const salva = formatarLocalizacaoDoUsuario(await repo.buscarLocalizacaoDoUsuario(usuarioId))
  avisarUsuarios([usuarioId], 'localizacao_atualizada', salva) // outras abas e aparelhos da mesma conta
  return { localizacao: salva, atualizada: true, criada: !atual }
}

// parar de compartilhar: apaga o que estava guardado
export async function removerLocalizacaoAtual(usuarioId) {
  const existia = await repo.apagarLocalizacaoDoUsuario(usuarioId)
  const preferencias = await repo.buscarPreferencias(usuarioId)
  await repo.salvarPreferencias(usuarioId, { ...preferencias, compartilhar: false })
  registrar('localizacao.usuario.removida', { usuario_id: usuarioId, existia })
  avisarUsuarios([usuarioId], 'localizacao_atualizada', null)
}

// ---------------------------------------------------------------- preferências

export async function consultarPreferencias(usuarioId) {
  return formatarPreferencias(await repo.buscarPreferencias(usuarioId))
}

export async function salvarPreferencias(usuarioId, corpo) {
  exigirObjeto(corpo, 'as preferências')
  const nova = { ...(await repo.buscarPreferencias(usuarioId)) }
  if ('raio_km' in corpo) nova.raio_km = v.lerRaio(corpo.raio_km, { padrao: RAIO_PADRAO_KM })
  if ('modo' in corpo) nova.modo = lerOpcao(corpo.modo, 'modo', ['gps', 'manual'])
  if ('compartilhar_localizacao' in corpo) {
    if (typeof corpo.compartilhar_localizacao !== 'boolean') {
      throw erro(400, 'O campo compartilhar_localizacao precisa ser true ou false.', 'DADOS_INVALIDOS', ['compartilhar_localizacao'])
    }
    nova.compartilhar = corpo.compartilhar_localizacao
  }
  if ('cidade_id' in corpo || 'bairro_id' in corpo) {
    if (vazio(corpo.cidade_id) && vazio(corpo.bairro_id)) {
      nova.cidade_id = null
      nova.bairro_id = null
    } else {
      const { cidade, bairro } = await cidadeEBairroEscolhidos(corpo)
      nova.cidade_id = cidade.id
      nova.bairro_id = bairro?.id ?? null
    }
  }
  await repo.salvarPreferencias(usuarioId, nova)
  if (!nova.compartilhar) await repo.apagarLocalizacaoDoUsuario(usuarioId)
  registrar('localizacao.preferencias.salvas', { usuario_id: usuarioId, raio_km: nova.raio_km, modo: nova.modo, compartilhar: nova.compartilhar })
  return consultarPreferencias(usuarioId)
}

// ---------------------------------------------------------------- busca por proximidade

function lerListaDeIds(valor, campo) {
  if (vazio(valor)) return []
  const lista = String(valor).split(',').map((parte) => parte.trim()).filter(Boolean)
  if (lista.length > 30) throw erro(400, `Envie no máximo 30 valores em ${campo}.`, 'DADOS_INVALIDOS', [campo])
  return [...new Set(lista.map((parte) => lerId(parte, campo)))]
}

function lerPreco(valor, campo) {
  if (vazio(valor)) return null
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(String(valor).trim())) {
    throw erro(400, `O campo ${campo} precisa ser um número maior ou igual a zero.`, 'DADOS_INVALIDOS', [campo])
  }
  return Number(valor)
}

export function lerFiltros(query) {
  const condicoes = vazio(query.condicao)
    ? []
    : [...new Set(String(query.condicao).split(',').map((c) => lerOpcao(c.trim(), 'condicao', ['novo', 'seminovo', 'usado'])))]
  const filtros = {
    busca: lerTexto(query.busca, 'busca', { max: 100 }),
    categoriaId: v.lerIdOpcional(query.categoria_id, 'categoria_id'),
    subcategorias: lerListaDeIds(query.subcategoria_id, 'subcategoria_id'),
    condicoes,
    precoMin: lerPreco(query.preco_min, 'preco_min'),
    precoMax: lerPreco(query.preco_max, 'preco_max'),
    cidadeId: v.lerIdOpcional(query.so_cidade_id, 'so_cidade_id'),
  }
  if (filtros.precoMin !== null && filtros.precoMax !== null && filtros.precoMin > filtros.precoMax) {
    throw erro(400, 'O preço mínimo não pode ser maior que o preço máximo.', 'DADOS_INVALIDOS', ['preco_min'])
  }
  return filtros
}

// De onde medir a distância: 1) latitude e longitude enviadas; 2) origem=atual (a guardada);
// 3) bairro_id ou cidade_id (manual); 4) sem nada, a guardada ou a referência das preferências.
export async function resolverOrigem(query, usuarioId) {
  const ponto = v.lerCoordenadas(query.latitude, query.longitude)
  if (ponto) {
    const { cidade, bairro } = await cidadeEBairroDoPonto(ponto)
    return {
      tipo: 'coordenadas', latitude: ponto.latitude, longitude: ponto.longitude, precisao_m: v.lerPrecisao(query.precisao_m),
      cidade: { id: cidade.id, nome: cidade.nome }, bairro: bairro ? { id: bairro.id, nome: bairro.nome } : null,
    }
  }

  const pediuAtual = query.origem === 'atual'
  if (pediuAtual && !usuarioId) throw erro(401, 'Faça login para usar a sua localização guardada.', 'NAO_AUTENTICADO')

  const bairroId = v.lerIdOpcional(query.bairro_id, 'bairro_id')
  const cidadeId = v.lerIdOpcional(query.cidade_id, 'cidade_id')
  if (!pediuAtual && (bairroId || cidadeId)) {
    const { cidade, bairro } = await cidadeEBairroEscolhidos({ cidade_id: cidadeId, bairro_id: bairroId })
    const base = bairro ?? cidade
    return {
      tipo: bairro ? 'bairro' : 'cidade', latitude: Number(base.latitude), longitude: Number(base.longitude), precisao_m: null,
      cidade: { id: cidade.id, nome: cidade.nome }, bairro: bairro ? { id: bairro.id, nome: bairro.nome } : null,
    }
  }

  if (usuarioId) {
    const guardada = formatarLocalizacaoDoUsuario(await repo.buscarLocalizacaoDoUsuario(usuarioId))
    if (guardada) {
      return {
        tipo: 'localizacao_atual', latitude: guardada.latitude, longitude: guardada.longitude, precisao_m: guardada.precisao_m,
        cidade: guardada.cidade, bairro: guardada.bairro, desatualizada: guardada.desatualizada, capturada_em: guardada.capturada_em,
      }
    }
    if (pediuAtual) {
      throw erro(404, 'Você não tem localização guardada. Compartilhe a localização ou escolha uma cidade.', 'LOCALIZACAO_NAO_ENCONTRADA')
    }
    const preferencias = await repo.buscarPreferencias(usuarioId)
    if (preferencias.cidade_id) return resolverOrigem({ cidade_id: preferencias.cidade_id, bairro_id: preferencias.bairro_id }, usuarioId)
  }

  throw erro(400, 'Informe a localização: latitude e longitude, bairro_id ou cidade_id.', 'LOCALIZACAO_OBRIGATORIA',
    ['latitude', 'longitude', 'bairro_id', 'cidade_id'])
}

// raio pedido, senão o das preferências, senão 5 km (também usado pela comparação e pela lista de compras)
export async function raioDaBusca(query, usuarioId) {
  const pedido = v.lerRaio(query.raio_km)
  if (pedido) return pedido
  if (usuarioId) return Number((await repo.buscarPreferencias(usuarioId)).raio_km)
  return RAIO_PADRAO_KM
}

export async function buscarProximos(query, usuarioId) {
  const origem = await resolverOrigem(query, usuarioId)
  const raioKm = await raioDaBusca(query, usuarioId)
  const filtros = lerFiltros(query)
  const ordenar = lerOpcao(query.ordenar, 'ordenar', repo.ORDENACOES, { obrigatorio: false }) ?? 'proximos'
  const { pagina, porPagina } = v.lerPaginacao(query)

  const { total, itens } = await repo.listarAnunciosPorDistancia({ origem, raioKm, filtros, ordenar, pagina, porPagina, usuarioId })

  // nada no raio: sugere o menor raio maior que tem anúncio
  let ampliar = null
  if (total === 0) {
    for (const km of [...RAIOS.map((r) => r.km), 100, RAIO_MAXIMO_KM].filter((km) => km > raioKm)) {
      const achados = await repo.contarAnunciosPorDistancia({ origem, raioKm: km, filtros })
      if (achados > 0) {
        ampliar = { raio_km: km, total: achados }
        break
      }
    }
  }

  let mensagem = null
  if (total === 0 && ampliar) mensagem = `Nenhum anúncio em até ${raioKm} km. Em até ${ampliar.raio_km} km há ${ampliar.total}.`
  else if (total === 0) mensagem = `Nenhum anúncio em até ${raioKm} km com esses filtros.`

  return {
    origem,
    raio_km: raioKm,
    raios_sugeridos: RAIOS,
    ordenar,
    pagina,
    por_pagina: porPagina,
    total,
    total_paginas: Math.ceil(total / porPagina),
    mensagem,
    ampliar,
    distancia: 'em linha reta',
    itens: itens.map(({ distancia_m, ...item }) => ({ ...item, distancia_km: metrosParaKm(distancia_m) })),
  }
}

// marcadores na área visível do mapa, com os mesmos filtros (no máximo 500)
export async function marcadoresDoMapa(query) {
  const caixa = v.lerCaixa(query.bbox)
  if (!caixa) throw erro(400, 'Envie bbox=lng_min,lat_min,lng_max,lat_max (a área visível do mapa).', 'DADOS_INVALIDOS', ['bbox'])
  const limite = Math.min(v.lerIdOpcional(query.limite, 'limite') ?? 300, 500)
  const { total, linhas } = await repo.listarMarcadores({ caixa, filtros: lerFiltros(query), limite })
  return {
    total,
    exibidos: linhas.length,
    limite,
    raio_aproximacao_m: RAIO_APROXIMACAO_M,
    marcadores: linhas.map(({ capa_id, capa_ordem, capa_arquivo, ...m }) => ({
      ...m,
      latitude: Number(m.latitude),
      longitude: Number(m.longitude),
      foto: formatarFoto(m.id, { id: capa_id, ordem: capa_ordem, arquivo: capa_arquivo })?.pequena ?? null,
    })),
  }
}

// ---------------------------------------------------------------- distância e sugestões

export async function calcularDistancia(query, usuarioId) {
  let de = v.lerCoordenadas(query.de_latitude, query.de_longitude, { dentroDaArea: false, campos: ['de_latitude', 'de_longitude'] })
  if (!de && usuarioId) {
    const guardada = await repo.buscarLocalizacaoDoUsuario(usuarioId)
    if (guardada) de = { latitude: Number(guardada.latitude), longitude: Number(guardada.longitude) }
  }
  if (!de) throw erro(400, 'Envie de_latitude e de_longitude (ou compartilhe sua localização).', 'DADOS_INVALIDOS', ['de_latitude', 'de_longitude'])

  const anuncioId = v.lerIdOpcional(query.anuncio_id, 'anuncio_id')
  if (anuncioId) {
    const local = await repo.buscarLocalizacaoDoAnuncio(anuncioId)
    const dono = local && Number(local.usuario_id) === Number(usuarioId)
    if (!local || local.latitude_publica === null || (!['ativo', 'reservado'].includes(local.status) && !dono)) {
      throw erro(404, 'Anúncio não encontrado.', 'ANUNCIO_NAO_ENCONTRADO')
    }
    const km = distanciaKm(de.latitude, de.longitude, Number(local.latitude_publica), Number(local.longitude_publica))
    return { distancia_km: metrosParaKm(km * 1000), metodo: 'haversine', ate: { tipo: 'anuncio', id: anuncioId, aproximado: true } }
  }

  const para = v.lerCoordenadas(query.para_latitude, query.para_longitude, { obrigatorio: true, dentroDaArea: false, campos: ['para_latitude', 'para_longitude'] })
  const km = distanciaKm(de.latitude, de.longitude, para.latitude, para.longitude)
  return { distancia_km: Math.round(km * 1000) / 1000, distancia_m: Math.round(km * 1000), metodo: 'haversine', ate: { tipo: 'ponto' } }
}

export async function sugerirRegioes(query, usuarioId) {
  const texto = v.lerTextoBusca(query.busca)
  if (texto) return { sugestoes: await localRepository.sugerirPorNome(texto) }

  let ponto = v.lerCoordenadas(query.latitude, query.longitude)
  if (!ponto && usuarioId) {
    const guardada = await repo.buscarLocalizacaoDoUsuario(usuarioId)
    if (guardada) ponto = { latitude: Number(guardada.latitude), longitude: Number(guardada.longitude) }
  }
  if (!ponto) throw erro(400, 'Envie busca (nome da cidade ou bairro) ou latitude e longitude.', 'DADOS_INVALIDOS', ['busca'])
  const sugestoes = await localRepository.sugerirPerto(ponto.latitude, ponto.longitude)
  return { sugestoes: ordenarPorDistancia(sugestoes.map(({ distancia_m, ...s }) => ({ ...s, distancia_km: metrosParaKm(distancia_m) }))) }
}

export const raiosDisponiveis = () => ({ raios: RAIOS, minimo_km: RAIO_MINIMO_KM, maximo_km: RAIO_MAXIMO_KM, padrao_km: RAIO_PADRAO_KM })

// ---------------------------------------------------------------- localização dos anúncios

// o dono vê tudo; os outros, só o aproximado; rascunho de outra pessoa nem existe
export async function localizacaoDoAnuncio(anuncioId, usuarioId) {
  const l = await repo.buscarLocalizacaoDoAnuncio(anuncioId)
  const dono = l && Number(l.usuario_id) === Number(usuarioId)
  if (!l || (['rascunho', 'em_analise'].includes(l.status) && !dono)) throw erro(404, 'Anúncio não encontrado.', 'ANUNCIO_NAO_ENCONTRADO')
  return { anuncio_id: anuncioId, eh_meu: Boolean(dono), localizacao: localizacaoVisivel(l, dono) }
}

const CAMPOS_DE_LOCALIZACAO = ['latitude', 'longitude', 'origem_localizacao', 'origem', 'rua', 'cep', 'precisao_m']

// Lê a localização do corpo (do anúncio ou da rota de localização). gps e manual exigem latitude e
// longitude dentro da cidade do bairro; bairro usa o centro do bairro. Sem bairro_id, o bairro sai do
// ponto. Devolve null quando o corpo não fala de localização (e exigir é false).
export async function prepararLocalizacaoDoAnuncio(corpo, { bairroIdAtual = null, exigir = false } = {}) {
  if (!exigir && !CAMPOS_DE_LOCALIZACAO.some((campo) => !vazio(corpo[campo]))) return null

  const temCoordenadas = !vazio(corpo.latitude) || !vazio(corpo.longitude)
  const origem = v.lerOrigem(corpo.origem_localizacao ?? corpo.origem, ['gps', 'manual', 'bairro'], 'origem')
    ?? (temCoordenadas ? 'manual' : 'bairro')
  const ponto = origem === 'bairro' ? null : v.lerCoordenadas(corpo.latitude, corpo.longitude, { obrigatorio: true })

  let bairroId = v.lerIdOpcional(corpo.bairro_id, 'bairro_id') ?? bairroIdAtual
  if (!bairroId && ponto) bairroId = (await cidadeEBairroDoPonto(ponto)).bairro?.id ?? null
  if (!bairroId) throw erro(400, 'Escolha o bairro do anúncio ou envie a localização.', 'DADOS_INVALIDOS', ['bairro_id'])

  const bairro = await localRepository.buscarBairro(bairroId)
  if (!bairro) throw erro(400, 'Bairro não encontrado.', 'BAIRRO_NAO_ENCONTRADO', ['bairro_id'])
  if (ponto && !pontoNoMunicipio(ponto.latitude, ponto.longitude, bairro.codigo_ibge)) {
    throw erro(422, `A localização enviada não fica em ${bairro.cidade}, a cidade do bairro escolhido.`, 'FORA_DA_CIDADE', ['latitude'])
  }

  const exato = ponto ?? { latitude: Number(bairro.latitude), longitude: Number(bairro.longitude) }
  const publico = origem === 'bairro' ? exato : pontoAproximado(exato.latitude, exato.longitude)
  return {
    bairroId: bairro.id,
    dados: {
      latitude: exato.latitude,
      longitude: exato.longitude,
      latitudePublica: publico.latitude,
      longitudePublica: publico.longitude,
      precisao: origem === 'gps' ? v.lerPrecisao(corpo.precisao_m) : null,
      origem,
      cidadeId: bairro.cidade_id,
      bairroId: bairro.id,
      cidade: bairro.cidade,
      bairro: bairro.nome,
      rua: lerTexto(corpo.rua, 'rua', { max: 150 }),
      cep: v.lerCep(corpo.cep),
    },
  }
}

export async function localizacaoPeloBairro(bairroId) {
  return (await prepararLocalizacaoDoAnuncio({ origem: 'bairro', bairro_id: bairroId }, { exigir: true })).dados
}

export const gravarLocalizacaoDoAnuncio = (conexao, anuncioId, dados) => repo.salvarLocalizacaoDoAnuncio(anuncioId, dados, conexao)

// Depois de editar: trocou de bairro e o ponto não é da nova cidade (ou era só o centro do bairro)?
// A localização vai para o centro do novo bairro. Sem localização, ganha a do bairro.
export async function ajustarLocalizacaoAoBairro(conexao, anuncioId, bairroId) {
  if (!bairroId) return
  const atual = await repo.buscarLocalizacaoDoAnuncio(anuncioId)
  const temLocal = atual && atual.latitude_publica !== null
  if (temLocal && Number(atual.bairro_id) === Number(bairroId)) return

  const bairro = await localRepository.buscarBairro(bairroId)
  const mantemPonto = temLocal && atual.origem !== 'bairro'
    && pontoNoMunicipio(Number(atual.latitude), Number(atual.longitude), bairro.codigo_ibge)
  if (!mantemPonto) {
    await repo.salvarLocalizacaoDoAnuncio(anuncioId, await localizacaoPeloBairro(bairroId), conexao)
    return
  }
  await repo.salvarLocalizacaoDoAnuncio(anuncioId, {
    latitude: Number(atual.latitude), longitude: Number(atual.longitude),
    latitudePublica: Number(atual.latitude_publica), longitudePublica: Number(atual.longitude_publica),
    precisao: numeroOuNull(atual.precisao_m), origem: atual.origem, cidadeId: bairro.cidade_id, bairroId: bairro.id,
    cidade: bairro.cidade, bairro: bairro.nome, rua: atual.rua, cep: atual.cep,
  }, conexao)
}

async function exigirDonoDoAnuncio(anuncioId, usuarioId) {
  const anuncio = await anuncioModel.buscarPorId(anuncioId)
  if (!anuncio) throw erro(404, 'Anúncio não encontrado.', 'ANUNCIO_NAO_ENCONTRADO')
  if (Number(anuncio.usuario_id) !== Number(usuarioId)) {
    throw erro(403, 'Só o dono pode alterar a localização deste anúncio.', 'SEM_PERMISSAO')
  }
  return anuncio
}

// POST (criar) e PATCH (atualizar) da localização do anúncio: só o dono
export async function definirLocalizacaoDoAnuncio(anuncioId, usuarioId, corpo, { criar }) {
  exigirObjeto(corpo, 'a localização')
  const anuncio = await exigirDonoDoAnuncio(anuncioId, usuarioId)
  const temLocal = (await repo.buscarLocalizacaoDoAnuncio(anuncioId)).latitude_publica !== null
  if (criar && temLocal) throw erro(409, 'Este anúncio já tem localização. Para mudar, use PATCH.', 'CONFLITO')
  if (!criar && !temLocal) throw erro(404, 'Este anúncio ainda não tem localização. Para registrar, use POST.', 'LOCALIZACAO_NAO_ENCONTRADA')

  const preparada = await prepararLocalizacaoDoAnuncio(corpo, { bairroIdAtual: anuncio.bairro_id, exigir: true })
  const conexao = await db.getConnection()
  try {
    await conexao.beginTransaction()
    await repo.salvarLocalizacaoDoAnuncio(anuncioId, preparada.dados, conexao)
    if (Number(preparada.bairroId) !== Number(anuncio.bairro_id)) await repo.mudarBairroDoAnuncio(anuncioId, preparada.bairroId, conexao)
    await conexao.commit()
  } catch (falha) {
    await conexao.rollback()
    throw falha
  } finally {
    conexao.release()
  }

  registrar('localizacao.anuncio.salva', { usuario_id: usuarioId, anuncio_id: anuncioId, origem: preparada.dados.origem, cidade_id: preparada.dados.cidadeId })
  if (['ativo', 'reservado'].includes(anuncio.status)) publicarParaTodos('anuncio_atualizado', { id: anuncioId, status: anuncio.status, motivo: 'localizacao' })
  return localizacaoDoAnuncio(anuncioId, usuarioId)
}

// retenção: roda ao subir a API e a cada 6 horas
export async function aplicarRetencao() {
  const apagadas = await repo.apagarLocalizacoesAntigas()
  if (apagadas) registrar('localizacao.retencao', { apagadas, dias: repo.RETENCAO_DIAS })
  return apagadas
}
