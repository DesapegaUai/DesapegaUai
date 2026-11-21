// Regras de localização que não dependem do banco (por isso têm teste unitário).
import { arredondarKm, deslocamentoM, RAIO_APROXIMACAO_M } from './geo.js'

export const INTERVALO_MINIMO_MS = 2000 // entre duas gravações da localização da mesma pessoa
export const MUDANCA_SIGNIFICATIVA_M = 50 // GPS que andou menos que isso, sem melhorar a precisão, não grava
export const GPS_DESATUALIZADO_MS = 30 * 60 * 1000 // depois disso a localização pede atualização

export const metrosParaKm = (metros) => arredondarKm(Number(metros) / 1000)

// do mais perto ao mais longe; sem distância vai para o fim; empate mantém a ordem
export function ordenarPorDistancia(itens, campo = 'distancia_km') {
  return itens
    .map((item, posicao) => ({ item, posicao }))
    .sort((a, b) => {
      const da = a.item[campo]
      const db = b.item[campo]
      if (da === null || da === undefined) return db === null || db === undefined ? a.posicao - b.posicao : 1
      if (db === null || db === undefined) return -1
      return da - db || a.posicao - b.posicao
    })
    .map(({ item }) => item)
}

// GPS medido há mais de 30 min: a tela pede para atualizar (a manual não envelhece)
export function localizacaoDesatualizada({ origem, capturada_em: capturadaEm }, agora = Date.now()) {
  return origem === 'gps' && agora - new Date(capturadaEm).getTime() > GPS_DESATUALIZADO_MS
}

/**
 * Decide se a nova leitura deve ser gravada.
 * { gravar: false, motivo } quando a mudança é pequena demais; { gravar: false, aguardarMs } quando
 * a última gravação foi há menos de 2 s; { gravar: true } nos outros casos.
 */
export function decidirAtualizacao(atual, nova, agora = Date.now()) {
  if (!atual) return { gravar: true }
  const mesmaReferencia = atual.origem === nova.origem && Number(atual.cidade_id) === Number(nova.cidadeId)
    && Number(atual.bairro_id ?? 0) === Number(nova.bairroId ?? 0)
  const precisaoAtual = atual.precisao_m === null || atual.precisao_m === undefined ? null : Number(atual.precisao_m)
  const melhorouPrecisao = nova.precisao !== null && nova.precisao !== undefined
    && (precisaoAtual === null || nova.precisao < precisaoAtual * 0.5)
  if (mesmaReferencia && deslocamentoM(atual, nova) < MUDANCA_SIGNIFICATIVA_M && !melhorouPrecisao) {
    return { gravar: false, motivo: `A posição mudou menos de ${MUDANCA_SIGNIFICATIVA_M} m: nada foi gravado.` }
  }
  const desde = agora - new Date(atual.atualizada_em).getTime()
  if (desde < INTERVALO_MINIMO_MS) return { gravar: false, aguardarMs: INTERVALO_MINIMO_MS - desde }
  return { gravar: true }
}

// O que cada pessoa vê da localização de um anúncio: o dono vê o ponto exato, a rua e o CEP;
// os outros, só o ponto aproximado, o bairro e a cidade.
export function localizacaoVisivel(l, ehDono) {
  if (!l || l.latitude_publica === null || l.latitude_publica === undefined) return null
  const publica = {
    aproximada: true,
    latitude: Number(l.latitude_publica),
    longitude: Number(l.longitude_publica),
    raio_aproximacao_m: l.origem === 'bairro' ? null : RAIO_APROXIMACAO_M,
    origem: l.origem,
    cidade: { id: l.cidade_id, nome: l.cidade, uf: l.uf },
    bairro: { id: l.bairro_id, nome: l.bairro },
    atualizada_em: l.atualizada_em,
  }
  if (!ehDono) return publica
  return {
    ...publica,
    exata: {
      latitude: Number(l.latitude),
      longitude: Number(l.longitude),
      precisao_m: l.precisao_m === null || l.precisao_m === undefined ? null : Number(l.precisao_m),
    },
    rua: l.rua,
    cep: l.cep,
  }
}
