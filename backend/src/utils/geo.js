// Cálculos geográficos da Zona da Mata mineira (sem banco e sem validação de entrada).
// Nunca escreva coordenadas em logs: elas são dado pessoal (LGPD).
import fs from 'node:fs'
import path from 'node:path'

const { municipios } = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, '..', 'dados', 'limites-zona-da-mata.json'), 'utf8'),
)

// cada município com a caixa (bbox) para descartar rápido os que nem chegam perto
const LIMITES = Object.entries(municipios).map(([codigo, aneis]) => {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
  for (const [lng, lat] of aneis[0]) {
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng)
  }
  return { codigoIbge: Number(codigo), aneis, minLat, maxLat, minLng, maxLng }
})

export const TOTAL_MUNICIPIOS = LIMITES.length

// caixa que contém a Zona da Mata inteira
export const AREA = LIMITES.reduce(
  (a, m) => ({
    minLat: Math.min(a.minLat, m.minLat), maxLat: Math.max(a.maxLat, m.maxLat),
    minLng: Math.min(a.minLng, m.minLng), maxLng: Math.max(a.maxLng, m.maxLng),
  }),
  { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 },
)

// Raios sugeridos na busca por proximidade (o usuário também pode digitar outro)
export const RAIOS = [
  { km: 1, objetivo: 'Extremamente próximos' },
  { km: 3, objetivo: 'Região próxima' },
  { km: 5, objetivo: 'Busca local' },
  { km: 10, objetivo: 'Busca ampliada' },
  { km: 15, objetivo: 'Região mais abrangente' },
  { km: 25, objetivo: 'Viçosa e arredores' },
  { km: 50, objetivo: 'Região ampliada' },
]
export const RAIO_PADRAO_KM = 5
export const RAIO_MINIMO_KM = 1
export const RAIO_MAXIMO_KM = 300 // a Zona da Mata inteira cabe em 300 km
export const TOLERANCIA_BORDA_KM = 5 // fora da Zona da Mata: erro do GPS perto da divisa da região
export const TOLERANCIA_MUNICIPIO_KM = 1.5 // ponto na cidade do bairro: contorno simplificado do IBGE + erro do GPS

// Grade do ponto público dos anúncios: uns 280 m (latitude) por 260 m (longitude) aqui.
// O ponto público fica a no máximo uns 190 m do exato.
const GRADE_GRAUS = 0.0025
export const RAIO_APROXIMACAO_M = 200

const RAIO_DA_TERRA_KM = 6371.0088 // raio médio (IUGG)

const emRadianos = (graus) => (graus * Math.PI) / 180

// Fórmula de Haversine: distância em linha reta sobre a Terra, em km
export function distanciaKm(lat1, lng1, lat2, lng2) {
  const dLat = emRadianos(lat2 - lat1)
  const dLng = emRadianos(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(emRadianos(lat1)) * Math.cos(emRadianos(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * RAIO_DA_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

// ponto dentro do polígono (raio cruzando as bordas)
function dentroDoAnel(lat, lng, anel) {
  let dentro = false
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i]
    const [xj, yj] = anel[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

// código IBGE do município da Zona da Mata onde o ponto está, ou null (o 1º anel é o contorno; os outros, buracos)
export function municipioDoPonto(lat, lng) {
  if (lat < AREA.minLat || lat > AREA.maxLat || lng < AREA.minLng || lng > AREA.maxLng) return null
  for (const m of LIMITES) {
    if (lat < m.minLat || lat > m.maxLat || lng < m.minLng || lng > m.maxLng) continue
    if (dentroDoAnel(lat, lng, m.aneis[0]) && !m.aneis.slice(1).some((buraco) => dentroDoAnel(lat, lng, buraco))) {
      return m.codigoIbge
    }
  }
  return null
}

// distância (km) do ponto até a divisa de um município (ou da região inteira, sem código)
export function distanciaAteDivisaKm(lat, lng, codigoIbge = null) {
  const kmPorGrauLat = 111.32
  const kmPorGrauLng = 111.32 * Math.cos(emRadianos(lat))
  let menor = Infinity
  for (const m of LIMITES) {
    if (codigoIbge !== null && m.codigoIbge !== codigoIbge) continue
    for (const anel of m.aneis) {
      for (let i = 1; i < anel.length; i++) {
        const ax = (anel[i - 1][0] - lng) * kmPorGrauLng
        const ay = (anel[i - 1][1] - lat) * kmPorGrauLat
        const dx = (anel[i][0] - lng) * kmPorGrauLng - ax
        const dy = (anel[i][1] - lat) * kmPorGrauLat - ay
        const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0
        menor = Math.min(menor, Math.hypot(ax + t * dx, ay + t * dy))
      }
    }
  }
  return menor
}

// o ponto está na Zona da Mata (ou a poucos km da divisa, pelo erro do GPS)?
export function pontoNaArea(lat, lng) {
  return municipioDoPonto(lat, lng) !== null || distanciaAteDivisaKm(lat, lng) <= TOLERANCIA_BORDA_KM
}

// o ponto está no município (ou a até 1,5 km da divisa dele)?
export function pontoNoMunicipio(lat, lng, codigoIbge) {
  if (municipioDoPonto(lat, lng) === Number(codigoIbge)) return true
  return distanciaAteDivisaKm(lat, lng, Number(codigoIbge)) <= TOLERANCIA_MUNICIPIO_KM
}

// Ponto público do anúncio: o centro da célula da grade. É sempre o mesmo para o mesmo ponto,
// então repetir a busca de vários lugares não revela o ponto exato.
export function pontoAproximado(lat, lng) {
  const arredondar = (valor) => Number((Math.round(valor / GRADE_GRAUS) * GRADE_GRAUS).toFixed(7))
  return { latitude: arredondar(lat), longitude: arredondar(lng) }
}

// Caixa (bbox) que contém o círculo: pré-filtro que usa o índice do banco antes da conta exata.
// Usa 111,0 km por grau (menos que os 111,19 da esfera) e 1% a mais de raio: a caixa sempre
// sobra um pouco em volta do círculo, nunca corta um anúncio que está dentro.
export function caixaDoRaio(lat, lng, raioKm) {
  const raio = raioKm * 1.01
  const dLat = raio / 111.0
  const dLng = raio / (111.0 * Math.max(0.01, Math.cos(emRadianos(Math.min(89, Math.abs(lat) + dLat)))))
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng }
}

// distância para mostrar: 100 m de resolução
export const arredondarKm = (km) => Math.round(km * 10) / 10

// deslocamento em metros entre duas leituras (para decidir se a mudança é significativa)
export const deslocamentoM = (a, b) => distanciaKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000
