import { api, parametros, urlDaApi } from './api.js'

// Anúncios, favoritos, conversas e mapa: tudo vem da API. O front só formata para mostrar.

export function iniciais(nome = '') {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
}

const capitalizar = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto)
const formatoData = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

export function cardDaApi(anuncio) {
  return {
    ...anuncio,
    foto: urlDaApi(anuncio.foto_capa?.media ?? anuncio.foto_capa?.pequena),
    categoria: anuncio.categoria_slug ?? null,
    local: [anuncio.bairro, anuncio.cidade].filter(Boolean).join(', '),
  }
}

export function anuncioDaApi(anuncio) {
  return {
    ...anuncio,
    categoria: anuncio.categoria_slug,
    condicaoTexto: capitalizar(anuncio.condicao),
    meu: anuncio.eh_meu,
    entrega: anuncio.forma_entrega,
    fotos: (anuncio.fotos ?? []).map((foto) => urlDaApi(foto.grande ?? foto.media ?? foto.pequena)),
    fotosApi: anuncio.fotos ?? [],
    vendedor: {
      ...anuncio.vendedor,
      foto_url: urlDaApi(anuncio.vendedor?.foto_url),
      iniciais: iniciais(anuncio.vendedor?.nome),
      desde: anuncio.vendedor?.criado_em ? formatoData.format(new Date(anuncio.vendedor.criado_em)) : '',
    },
  }
}

// ---------------------------------------------------------------- anúncios

// busca por proximidade (a API filtra pelo raio, calcula a distância e ordena)
export async function buscarProximos(filtros, { sinal } = {}) {
  const resultado = await api.get(`/localizacao/proximos${parametros(filtros)}`, { sinal })
  return { ...resultado, itens: resultado.itens.map(cardDaApi) }
}

// anúncios além do raio escolhido, do mais perto para o mais longe (seção "Em outras cidades da região")
export async function buscarAlemDoRaio(filtros, raioKm, { sinal } = {}) {
  const resultado = await api.get(`/anuncios${parametros({ ...filtros, ordenar: 'proximos', por_pagina: 24 })}`, { sinal })
  return resultado.itens.map(cardDaApi).filter((anuncio) => typeof anuncio.distancia_km === 'number' && anuncio.distancia_km > raioKm)
}

// os mais recentes da região inteira, sem raio (cards da seção "Conectando pessoas" da home)
export async function listarRecentes(quantidade = 12, { sinal } = {}) {
  const resultado = await api.get(`/anuncios${parametros({ ordenar: 'recentes', por_pagina: quantidade })}`, { sinal })
  return resultado.itens.map(cardDaApi)
}

export const marcadoresDoMapa =(filtros, { sinal } = {}) => api.get(`/localizacao/mapa${parametros(filtros)}`, { sinal })

// perfil público de outra pessoa: { usuario, anuncios } (sem telefone e e-mail)
export async function verPerfilPublico(id) {
  const { usuario, anuncios } = await api.get(`/usuarios/${id}`)
  return {
    usuario: {
      ...usuario,
      foto: urlDaApi(usuario.foto_url),
      iniciais: iniciais(usuario.nome),
      desde: usuario.criado_em ? formatoData.format(new Date(usuario.criado_em)) : '',
    },
    anuncios: anuncios.map(cardDaApi),
  }
}

export const verAnuncio = async (id) => anuncioDaApi(await api.get(`/anuncios/${id}`))

export async function listarMeusAnuncios() {
  return (await api.get('/meus-anuncios')).map(cardDaApi)
}

export const publicarAnuncio = (formulario) => api.post('/anuncios', formulario)
export const editarAnuncio = (id, dados) => api.put(`/anuncios/${id}`, dados)
export const mudarStatus = (id, status) => api.patch(`/anuncios/${id}/status`, { status })
export const excluirAnuncio = (id) => api.delete(`/anuncios/${id}`)
export const adicionarFotos = (id, formulario) => api.post(`/anuncios/${id}/fotos`, formulario)
export const removerFoto = (id, fotoId) => api.delete(`/anuncios/${id}/fotos/${fotoId}`)
export const definirCapa = (id, fotoId) => api.patch(`/anuncios/${id}/fotos/${fotoId}/capa`)

let catalogo = null
export async function obterCategorias() {
  catalogo ??= api.get('/categorias').catch((erro) => {
    catalogo = null
    throw erro
  })
  return catalogo
}

// ---------------------------------------------------------------- Procura-se

// pedidos de quem está procurando alguma coisa (o mais novo primeiro)
export async function listarProcuras(filtros = {}) {
  const { itens } = await api.get(`/procuras${parametros(filtros)}`)
  return itens.map((p) => ({ ...p, usuario: { ...p.usuario, foto: urlDaApi(p.usuario.foto_url), iniciais: iniciais(p.usuario.nome) } }))
}
export const publicarProcura = (dados) => api.post('/procuras', dados)
export const excluirProcura = (id) => api.delete(`/procuras/${id}`)

// ---------------------------------------------------------------- favoritos

export const favoritar = (id) => api.post(`/favoritos/${id}`)
export const desfavoritar = (id) => api.delete(`/favoritos/${id}`)

export async function listarFavoritos(filtros) {
  const resultado = await api.get(`/favoritos${parametros(filtros)}`)
  return { ...resultado, itens: resultado.itens.map(cardDaApi) }
}

// ---------------------------------------------------------------- conversas

const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const formatoDia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' })

function diaDaMensagem(data) {
  const hoje = new Date()
  const ontem = new Date(Date.now() - 86_400_000)
  if (data.toDateString() === hoje.toDateString()) return 'Hoje'
  if (data.toDateString() === ontem.toDateString()) return 'Ontem'
  return formatoDia.format(data)
}

export function mensagemDaApi(mensagem, meuId) {
  const data = new Date(mensagem.enviada_em)
  const minha = mensagem.minha ?? Number(mensagem.remetente_id) === Number(meuId)
  // foto mandada no chat: { pequena, grande } (na lista de conversas vem só tem_foto, sem os endereços)
  const foto = mensagem.foto ? { pequena: urlDaApi(mensagem.foto.pequena), grande: urlDaApi(mensagem.foto.grande) } : null
  return {
    ...mensagem, foto, temFoto: Boolean(foto || mensagem.tem_foto),
    minha, autor: minha ? 'eu' : 'outro', hora: formatoHora.format(data), dia: diaDaMensagem(data),
  }
}

export function conversaDaApi(conversa, meuId) {
  return {
    ...conversa,
    nome: conversa.outro_usuario.nome,
    iniciais: iniciais(conversa.outro_usuario.nome),
    foto: urlDaApi(conversa.outro_usuario.foto_url),
    online: Boolean(conversa.outro_usuario.online),
    ultimoAcesso: conversa.outro_usuario.ultimo_acesso ?? null,
    naoLidas: conversa.nao_lidas,
    vendendo: conversa.papel === 'vendendo',
    mensagens: conversa.ultima_mensagem ? [mensagemDaApi(conversa.ultima_mensagem, meuId)] : [],
    anuncio: {
      ...conversa.anuncio,
      vendido: conversa.anuncio.status === 'vendido',
      foto: urlDaApi(conversa.anuncio.foto_capa?.pequena ?? conversa.anuncio.foto_capa?.media),
    },
  }
}

export async function listarConversas(meuId) {
  const resultado = await api.get('/conversas')
  return { ...resultado, itens: resultado.itens.map((c) => conversaDaApi(c, meuId)) }
}

export async function listarMensagens(conversaId, meuId) {
  const resultado = await api.get(`/conversas/${conversaId}/mensagens`)
  return { ...resultado, mensagens: resultado.mensagens.map((m) => mensagemDaApi(m, meuId)) }
}

export const abrirConversa = (anuncioId) => api.post('/conversas', { anuncio_id: anuncioId })
export const enviarMensagemPelaApi = (conversaId, texto) => api.post(`/conversas/${conversaId}/mensagens`, { texto })
// editar a própria mensagem (até 15 min) e apagar: para = "mim" ou "todos" (a própria, até 2 dias)
export const editarMensagemPelaApi = (conversaId, mensagemId, texto) => api.patch(`/conversas/${conversaId}/mensagens/${mensagemId}`, { texto })
export const apagarMensagemPelaApi = (conversaId, mensagemId, para) => api.delete(`/conversas/${conversaId}/mensagens/${mensagemId}?para=${para}`)
export const contarConversasNaoLidas = () => api.get('/conversas/nao-lidas')

// compromisso nas entregas: depois da venda, digo se a outra pessoa apareceu no combinado
export const buscarComparecimento = (conversaId) => api.get(`/conversas/${conversaId}/comparecimento`)
export const responderComparecimento = (conversaId, compareceu) => api.post(`/conversas/${conversaId}/comparecimento`, { compareceu })

// tira a conversa da minha lista (a outra pessoa continua com a dela)
export const excluirConversa = (conversaId) => api.delete(`/conversas/${conversaId}`)

// denúncia de usuário feita no chat: { motivo, descricao? }
export const denunciarConversa = (conversaId, dados) => api.post(`/conversas/${conversaId}/denuncia`, dados)
export const buscarDenuncia = (conversaId) => api.get(`/conversas/${conversaId}/denuncia`)

// manda as fotos (arquivos File) e, se tiver, o texto como legenda da última; devolve { mensagens }
export function enviarFotosPelaApi(conversaId, arquivos, texto) {
  const corpo = new FormData()
  arquivos.forEach((arquivo) => corpo.append('fotos', arquivo))
  if (texto) corpo.append('texto', texto)
  return api.post(`/conversas/${conversaId}/fotos`, corpo)
}

export function textoDoUltimoAcesso(data) {
  if (!data) return 'Offline'
  const minutos = Math.round((Date.now() - new Date(data).getTime()) / 60000)
  if (minutos < 2) return 'Visto agora há pouco'
  if (minutos < 60) return `Visto há ${minutos} min`
  const d = new Date(data)
  return `Visto por último ${diaDaMensagem(d).toLowerCase()} às ${formatoHora.format(d)}`
}
