// throw erroHttp(404, 'Anúncio não encontrado.') responde { "erro": "Anúncio não encontrado." } com status 404
export function erroHttp(status, mensagem) {
  const erro = new Error(mensagem)
  erro.status = status
  return erro
}
