// Todas as chamadas para o back-end passam por aqui.
// Exemplo: const dados = await api.get('/saude')
const URL_API = `${import.meta.env.VITE_API_URL ?? ''}/api`

async function requisicao(metodo, caminho, corpo) {
  const opcoes = { method: metodo, credentials: 'include', headers: {} }

  if (corpo instanceof FormData) {
    opcoes.body = corpo // envio de arquivos (fotos)
  } else if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json'
    opcoes.body = JSON.stringify(corpo)
  }

  let resposta
  try {
    resposta = await fetch(URL_API + caminho, opcoes)
  } catch {
    throw new Error('Sem conexão com a API. Ela está rodando?')
  }

  if (resposta.status === 204) return null
  const dados = await resposta.json().catch(() => null)
  if (!resposta.ok) throw new Error(dados?.erro ?? `Erro ${resposta.status} na API.`)
  return dados
}

export const api = {
  get: (caminho) => requisicao('GET', caminho),
  post: (caminho, corpo) => requisicao('POST', caminho, corpo),
  put: (caminho, corpo) => requisicao('PUT', caminho, corpo),
  patch: (caminho, corpo) => requisicao('PATCH', caminho, corpo),
  delete: (caminho) => requisicao('DELETE', caminho),
}
