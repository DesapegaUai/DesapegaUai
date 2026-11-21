import { useSyncExternalStore } from 'react'
import { api } from './api.js'
import { quandoReconectar } from './tempoReal.js'

// Localização de referência da busca, com a Geolocation API do navegador.
// O navegador pede a permissão; sem ela (ou sem GPS) vale a cidade e o bairro escolhidos.
// O front só coleta e mostra: quem valida, calcula a distância e filtra é a API.
// No navegador fica guardado só o modo, a cidade/bairro escolhidos e o raio (nunca a coordenada).

const CHAVE = 'desapegauai.localizacao.v2'
const ENVIO_MINIMO_MS = 15_000 // intervalo mínimo entre envios do GPS para a API
const MUDANCA_MINIMA_M = 50 // menos que isso não muda a busca
export const RAIOS = [1, 3, 5, 10, 15, 25, 50]
export const RAIO_PADRAO = 5
const VICOSA = { id: 1, nome: 'Viçosa' }

function lerPreferencia() {
  try {
    const salva = JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
    if (salva && typeof salva === 'object') return salva
  } catch {
    // sem acesso ao armazenamento: usa o padrão
  }
  return {}
}

const salva = lerPreferencia()
let estado = {
  modo: salva.modo === 'gps' ? 'gps' : 'manual', // gps ou manual
  status: 'inativa', // inativa, pedindo, ativa, negada, indisponivel, tempo_esgotado, sem_suporte, inseguro, fora_da_area
  posicao: null, // { latitude, longitude, precisao_m, capturada_em }
  cidade: salva.cidade ?? VICOSA,
  bairro: salva.bairro ?? null,
  raioKm: RAIOS.includes(salva.raioKm) || (Number.isInteger(salva.raioKm) && salva.raioKm >= 1 && salva.raioKm <= 300) ? salva.raioKm : RAIO_PADRAO,
  logado: false,
}
const ouvintes = new Set()
let observador = null
let ultimoEnvio = { em: 0, posicao: null }

function mudar(parcial) {
  estado = { ...estado, ...parcial }
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ modo: estado.modo, cidade: estado.cidade, bairro: estado.bairro, raioKm: estado.raioKm }))
  } catch {
    // sem armazenamento: vale só nesta visita
  }
  ouvintes.forEach((avisar) => avisar())
}

const radianos = (g) => (g * Math.PI) / 180
// só para decidir se vale reenviar; a distância que vale é a da API
function metrosEntre(a, b) {
  const dLat = radianos(b.latitude - a.latitude)
  const dLng = radianos(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radianos(a.latitude)) * Math.cos(radianos(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function motivoSemGps() {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return 'sem_suporte'
  if (!window.isSecureContext) return 'inseguro'
  return null
}

export const TEXTO_DO_STATUS = {
  inativa: 'Localização desligada.',
  pedindo: 'Pedindo permissão para usar a localização…',
  ativa: 'Usando a sua localização.',
  negada: 'Você não autorizou a localização. Escolha a cidade e o bairro.',
  indisponivel: 'Não foi possível descobrir onde você está (GPS desligado ou sem sinal). Escolha a cidade e o bairro.',
  tempo_esgotado: 'O GPS está demorando para responder. Tentando de novo…',
  sem_suporte: 'Este navegador não informa a localização. Escolha a cidade e o bairro.',
  inseguro: 'A localização só funciona em endereço seguro (https). Escolha a cidade e o bairro.',
  fora_da_area: 'Você está fora da Zona da Mata mineira. Escolha uma cidade da região.',
}

async function enviarParaApi(posicao, { forcar = false } = {}) {
  if (!estado.logado) return
  const agora = Date.now()
  const andou = ultimoEnvio.posicao ? metrosEntre(ultimoEnvio.posicao, posicao) : Infinity
  if (!forcar && (agora - ultimoEnvio.em < ENVIO_MINIMO_MS || andou < MUDANCA_MINIMA_M)) return
  ultimoEnvio = { em: agora, posicao }
  try {
    const { localizacao } = await api.post('/localizacao/atual', { origem: 'gps', ...posicao })
    if (localizacao) mudar({ cidade: localizacao.cidade, bairro: localizacao.bairro })
  } catch (erro) {
    if (erro.codigo === 'FORA_DA_AREA') pararGps('fora_da_area')
  }
}

function aoLer(leitura) {
  const posicao = {
    latitude: Number(leitura.coords.latitude.toFixed(7)),
    longitude: Number(leitura.coords.longitude.toFixed(7)),
    precisao_m: Math.round(leitura.coords.accuracy),
    capturada_em: new Date(leitura.timestamp || Date.now()).toISOString(),
  }
  if (!Number.isFinite(posicao.latitude) || !Number.isFinite(posicao.longitude)) return
  const anterior = estado.posicao
  const mudouBastante = !anterior || metrosEntre(anterior, posicao) >= MUDANCA_MINIMA_M || posicao.precisao_m < anterior.precisao_m * 0.5
  if (mudouBastante || estado.status !== 'ativa') mudar({ posicao, status: 'ativa' })
  enviarParaApi(posicao)
}

function aoFalhar(erro) {
  if (erro.code === 1) return pararGps('negada')
  if (erro.code === 2) return mudar({ status: 'indisponivel' })
  if (erro.code === 3) mudar({ status: 'tempo_esgotado' })
}

function observar() {
  if (observador !== null) return
  observador = navigator.geolocation.watchPosition(aoLer, aoFalhar, { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 })
}

function pararDeObservar() {
  if (observador !== null) navigator.geolocation.clearWatch(observador)
  observador = null
}

function pararGps(status) {
  pararDeObservar()
  mudar({ modo: 'manual', status, posicao: null })
}

// liga o GPS: o navegador mostra o pedido de permissão (só depois do clique da pessoa)
export function ativarGps() {
  const motivo = motivoSemGps()
  if (motivo) return mudar({ modo: 'manual', status: motivo })
  mudar({ modo: 'gps', status: estado.posicao ? 'ativa' : 'pedindo' })
  observar()
}

// atualizar agora (botão): leitura nova, sem usar a guardada pelo navegador
export function atualizarAgora() {
  if (motivoSemGps()) return ativarGps()
  mudar({ modo: 'gps', status: estado.posicao ? 'ativa' : 'pedindo' })
  navigator.geolocation.getCurrentPosition((leitura) => {
    aoLer(leitura)
    if (estado.posicao) enviarParaApi(estado.posicao, { forcar: true })
  }, aoFalhar, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 })
  observar()
}

// desliga o compartilhamento: para o GPS e apaga a localização guardada na API
export async function desativarGps() {
  pararDeObservar()
  mudar({ modo: 'manual', status: 'inativa', posicao: null })
  ultimoEnvio = { em: 0, posicao: null }
  if (estado.logado) await api.delete('/localizacao/atual').catch(() => {})
}

// cidade e bairro escolhidos à mão (funciona sem GPS)
export async function usarLocalManual(cidade, bairro = null) {
  pararDeObservar()
  mudar({ modo: 'manual', status: 'inativa', posicao: null, cidade, bairro })
  if (estado.logado) {
    await api.post('/localizacao/atual', { origem: 'manual', cidade_id: cidade.id, bairro_id: bairro?.id ?? null }).catch(() => {})
  }
}

export function definirRaio(km) {
  const raio = Number(km)
  if (!Number.isInteger(raio) || raio < 1 || raio > 300) return false
  mudar({ raioKm: raio })
  if (estado.logado) api.put('/localizacao/preferencias', { raio_km: raio }).catch(() => {})
  return true
}

// parâmetros de origem para a API: o GPS (se ativo) ou a referência escolhida
export function origemDaBusca(e = estado) {
  if (e.modo === 'gps' && e.posicao) return { latitude: e.posicao.latitude, longitude: e.posicao.longitude, precisao_m: e.posicao.precisao_m }
  if (e.bairro?.id) return { bairro_id: e.bairro.id }
  return { cidade_id: e.cidade?.id ?? VICOSA.id }
}

export function nomeDaReferencia(e = estado) {
  if (e.modo === 'gps' && e.posicao) return e.bairro ? `Perto de você · ${e.bairro.nome}` : 'Perto de você'
  return e.bairro ? `${e.bairro.nome}, ${e.cidade.nome}` : `${e.cidade?.nome ?? VICOSA.nome}, MG`
}

// sair da página: para de acompanhar; voltar: retoma
document.addEventListener('visibilitychange', () => {
  if (estado.modo !== 'gps') return
  if (document.hidden) pararDeObservar()
  else if (!motivoSemGps()) observar()
})

// a conexão voltou: reenvia a localização (o servidor pode ter perdido a referência)
quandoReconectar(() => {
  if (estado.modo === 'gps' && estado.posicao) enviarParaApi(estado.posicao, { forcar: true })
})

window.addEventListener('desapegauai:login', () => {
  mudar({ logado: true })
  if (estado.modo === 'gps' && estado.posicao) enviarParaApi(estado.posicao, { forcar: true })
  else if (estado.modo === 'manual') {
    api.get('/localizacao/preferencias').then((p) => { if (p?.raio_km) mudar({ raioKm: p.raio_km }) }).catch(() => {})
  }
})
window.addEventListener('desapegauai:logout', () => {
  mudar({ logado: false })
  ultimoEnvio = { em: 0, posicao: null }
})

export function retomarGpsSalvo() {
  if (estado.modo === 'gps' && !motivoSemGps()) observar()
}

const assinar = (avisar) => {
  ouvintes.add(avisar)
  return () => ouvintes.delete(avisar)
}
export const useLocalizacao = () => useSyncExternalStore(assinar, () => estado)
