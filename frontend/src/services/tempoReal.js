import { useSyncExternalStore } from 'react'
import { io } from 'socket.io-client'

// Uma conexão só com o Socket.IO para o site inteiro (chat, avisos, feed, perfil).
// As telas ouvem com ouvir(evento, funcao) e param de ouvir ao sair, sem derrubar a conexão.
// Sem login a conexão também funciona: recebe só o feed público de anúncios.

let socket = null
let estado = { conectado: false, reconectando: false, quedas: 0 }
const ouvintesDoEstado = new Set()
const aoReconectar = new Set()

function mudarEstado(parcial) {
  estado = { ...estado, ...parcial }
  ouvintesDoEstado.forEach((avisar) => avisar())
}

// conta para o servidor se o site está na tela: quem está olhando não recebe a notificação de
// mensagem no aparelho (a mensagem já aparece no site); quem saiu da aba ou bloqueou o celular recebe
function avisarSeEstaNaTela() {
  if (socket?.connected) socket.emit('na_tela', !document.hidden)
}

function criar() {
  const origem = import.meta.env.VITE_API_URL || window.location.origin
  socket = io(origem, { path: '/api/socket.io', withCredentials: true, transports: ['websocket', 'polling'] })
  socket.on('connect', () => {
    const voltou = estado.quedas > 0
    mudarEstado({ conectado: true, reconectando: false })
    avisarSeEstaNaTela()
    if (voltou) aoReconectar.forEach((funcao) => funcao())
  })
  socket.on('disconnect', (motivo) => {
    mudarEstado({ conectado: false, reconectando: motivo !== 'io client disconnect', quedas: estado.quedas + 1 })
  })
  socket.on('connect_error', () => mudarEstado({ conectado: false, reconectando: true }))
  document.addEventListener('visibilitychange', avisarSeEstaNaTela)
}

export function conectarTempoReal() {
  if (!socket) criar()
  else if (!socket.connected && !socket.active) socket.connect()
}

// depois de entrar ou sair da conta: reconecta para o servidor ler o novo cookie
export function reconectarTempoReal() {
  if (!socket) return criar()
  socket.disconnect()
  socket.connect()
}

export function ouvir(evento, funcao) {
  conectarTempoReal()
  socket.on(evento, funcao)
  return () => socket?.off(evento, funcao)
}

// roda a função sempre que a conexão volta depois de uma queda
export function quandoReconectar(funcao) {
  aoReconectar.add(funcao)
  return () => aoReconectar.delete(funcao)
}

// emite e espera a resposta do servidor (ou desiste depois de tempoMs)
export function emitir(evento, dados, tempoMs = 10000) {
  conectarTempoReal()
  return new Promise((resolver, rejeitar) => {
    if (!socket.connected) {
      rejeitar(new Error('Sem conexão em tempo real.'))
      return
    }
    socket.timeout(tempoMs).emit(evento, dados, (erro, resposta) => {
      if (erro) rejeitar(new Error('O servidor demorou para responder. Tente de novo.'))
      else if (resposta && resposta.ok === false) rejeitar(new Error(resposta.erro ?? 'Não foi possível concluir.'))
      else resolver(resposta)
    })
  })
}

// avisos sem resposta (ex.: "digitando")
export function avisar(evento, dados) {
  if (socket?.connected) socket.emit(evento, dados)
}

const assinarEstado = (avisarMudanca) => {
  ouvintesDoEstado.add(avisarMudanca)
  return () => ouvintesDoEstado.delete(avisarMudanca)
}
export const useTempoReal = () => useSyncExternalStore(assinarEstado, () => estado)
