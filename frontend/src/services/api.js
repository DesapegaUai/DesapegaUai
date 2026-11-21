// Todas as chamadas para o back-end passam por aqui.
// Exemplo: const dados = await api.get('/saude')
const ORIGEM_API = import.meta.env.VITE_API_URL ?? ''
const URL_API = `${ORIGEM_API}/api`

// erro da API com o formato padrão: { erro, codigo, status, campos }
export class ErroApi extends Error {
  constructor(mensagem, { status = 0, codigo = 'ERRO', campos = [] } = {}) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
    this.campos = campos
  }
}

async function requisicao(metodo, caminho, corpo, { sinal } = {}) {
  const opcoes = { method: metodo, credentials: 'include', headers: {}, signal: sinal }

  if (corpo instanceof FormData) {
    opcoes.body = corpo // envio de arquivos (fotos)
  } else if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json'
    opcoes.body = JSON.stringify(corpo)
  }

  let resposta
  try {
    resposta = await fetch(URL_API + caminho, opcoes)
  } catch (erro) {
    if (erro.name === 'AbortError') throw erro
    throw new ErroApi('Sem conexão com o servidor. Confira a internet e tente de novo.', { codigo: 'SEM_CONEXAO' })
  }

  if (resposta.status === 204) return null
  let dados = null
  let chegouInteira = true
  try {
    dados = await resposta.json()
  } catch (erro) {
    if (erro.name === 'AbortError') throw erro
    chegouInteira = false
  }
  if (!resposta.ok) {
    if (resposta.status === 401) window.dispatchEvent(new Event('desapegauai:nao-autenticado'))
    throw new ErroApi(dados?.erro ?? `Erro ${resposta.status} no servidor.`, {
      status: resposta.status,
      codigo: dados?.codigo,
      campos: dados?.campos ?? [],
    })
  }
  // resposta de sucesso que não chegou inteira (a conexão caiu no meio): é falha, não "sem dados".
  // Antes voltava null e a tela quebrava ao usar a lista que não veio.
  if (!chegouInteira) throw new ErroApi('Sem conexão com o servidor. Confira a internet e tente de novo.', { codigo: 'SEM_CONEXAO' })
  return dados
}

export const api = {
  get: (caminho, opcoes) => requisicao('GET', caminho, undefined, opcoes),
  post: (caminho, corpo, opcoes) => requisicao('POST', caminho, corpo, opcoes),
  put: (caminho, corpo, opcoes) => requisicao('PUT', caminho, corpo, opcoes),
  patch: (caminho, corpo, opcoes) => requisicao('PATCH', caminho, corpo, opcoes),
  delete: (caminho, corpo, opcoes) => requisicao('DELETE', caminho, corpo, opcoes),
}

// endereço completo de um arquivo servido pela API (fotos)
export function urlDaApi(caminho) {
  if (!caminho) return null
  return caminho.startsWith('http') || caminho.startsWith('blob:') || caminho.startsWith('data:') ? caminho : `${ORIGEM_API}${caminho}`
}

export const parametros = (objeto) => {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(objeto)) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, Array.isArray(valor) ? valor.join(',') : String(valor))
  }
  const texto = busca.toString()
  return texto ? `?${texto}` : ''
}
