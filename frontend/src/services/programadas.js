// Datas da mensagem programada (como no WhatsApp): os dias das rodinhas e como o horário aparece na tela.
// O horário é o do aparelho; para a API vai em UTC (toISOString).

export const DIAS_PARA_FRENTE = 30 // a API aceita até 30 dias
const formatoDiaDaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const formatoMes = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
const dois = (n) => String(n).padStart(2, '0')
const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)

const inicioDoDia = (data) => new Date(data.getFullYear(), data.getMonth(), data.getDate())

// "Sex. 27 de nov."
function nomeDoDia(data) {
  const semana = formatoDiaDaSemana.format(data).replace('.', '')
  const mes = formatoMes.format(data).replace('.', '')
  return `${capitalizar(semana)}. ${data.getDate()} de ${mes}.`
}

/** os dias das rodinhas: Hoje, Amanhã e os próximos, até 30 dias */
export function diasParaEscolher(agora = new Date()) {
  const hoje = inicioDoDia(agora)
  return Array.from({ length: DIAS_PARA_FRENTE }, (_, i) => {
    const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i)
    return { valor: i, rotulo: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : nomeDoDia(dia), data: dia }
  })
}

export const HORAS = Array.from({ length: 24 }, (_, h) => ({ valor: h, rotulo: dois(h) }))
export const MINUTOS = Array.from({ length: 60 }, (_, m) => ({ valor: m, rotulo: dois(m) }))

/** o horário que já vem escolhido: a próxima hora cheia (23h e pouco: amanhã à meia-noite) */
export function escolhaInicial(agora = new Date()) {
  const proxima = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), agora.getHours() + 1, 0, 0, 0)
  const dias = Math.round((inicioDoDia(proxima) - inicioDoDia(agora)) / 86400000)
  return { dia: dias, hora: proxima.getHours(), minuto: 0 }
}

/** a data escolhida nas rodinhas */
export function dataEscolhida({ dia, hora, minuto }, agora = new Date()) {
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + dia, hora, minuto, 0, 0)
}

/** "hoje às 11:00", "amanhã às 08:00", "sex., 27 de nov. às 08:00" */
export function quandoSai(data, agora = new Date()) {
  const d = new Date(data)
  const dias = Math.round((inicioDoDia(d) - inicioDoDia(agora)) / 86400000)
  const hora = `${dois(d.getHours())}:${dois(d.getMinutes())}`
  if (dias === 0) return `hoje às ${hora}`
  if (dias === 1) return `amanhã às ${hora}`
  return `${nomeDoDia(d).replace(/\.$/, '').replace('. ', ', ').toLowerCase()} às ${hora}`
}
