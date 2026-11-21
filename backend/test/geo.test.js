// Testes unitários dos cálculos geográficos e das validações de localização (sem banco).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

process.env.JWT_SEGREDO ||= 'x'.repeat(32)
const geo = await import('../src/utils/geo.js')
const v = await import('../src/validations/localizacaoValidation.js')
const { limparDados } = await import('../src/utils/log.js')

const VICOSA = { latitude: -20.7547, longitude: -42.8819 } // Centro
const PONTE_NOVA = { latitude: -20.4158, longitude: -42.9086 }
const BELO_HORIZONTE = { latitude: -19.9191, longitude: -43.9386 }
const RIO_DE_JANEIRO = { latitude: -22.9068, longitude: -43.1729 }

// Distância no elipsoide WGS-84 (fórmula inversa de Vincenty), só para conferir a Haversine
function vincentyKm(lat1, lng1, lat2, lng2) {
  const a = 6378137
  const f = 1 / 298.257223563
  const b = a * (1 - f)
  const rad = (g) => (g * Math.PI) / 180
  const L = rad(lng2 - lng1)
  const U1 = Math.atan((1 - f) * Math.tan(rad(lat1)))
  const U2 = Math.atan((1 - f) * Math.tan(rad(lat2)))
  const [sinU1, cosU1, sinU2, cosU2] = [Math.sin(U1), Math.cos(U1), Math.sin(U2), Math.cos(U2)]
  let lambda = L
  let anterior
  let sinSigma, cosSigma, sigma, cos2Alpha, cos2SigmaM
  do {
    const sinLambda = Math.sin(lambda)
    const cosLambda = Math.cos(lambda)
    sinSigma = Math.sqrt((cosU2 * sinLambda) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2)
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda
    sigma = Math.atan2(sinSigma, cosSigma)
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma
    cos2Alpha = 1 - sinAlpha ** 2
    cos2SigmaM = cosSigma - (2 * sinU1 * sinU2) / cos2Alpha
    const C = (f / 16) * cos2Alpha * (4 + f * (4 - 3 * cos2Alpha))
    anterior = lambda
    lambda = L + (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)))
  } while (Math.abs(lambda - anterior) > 1e-12)
  const u2 = (cos2Alpha * (a * a - b * b)) / (b * b)
  const A = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
  const deltaSigma = B * sinSigma * (cos2SigmaM + (B / 4) * (cosSigma * (-1 + 2 * cos2SigmaM ** 2)
    - (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)))
  return (b * A * (sigma - deltaSigma)) / 1000
}

function erroDe(funcao) {
  try {
    funcao()
  } catch (erro) {
    return erro
  }
  assert.fail('era para dar erro')
}

describe('distanciaKm (Haversine)', () => {
  test('mesmo ponto é zero e a ida é igual à volta', () => {
    assert.equal(geo.distanciaKm(VICOSA.latitude, VICOSA.longitude, VICOSA.latitude, VICOSA.longitude), 0)
    const ida = geo.distanciaKm(VICOSA.latitude, VICOSA.longitude, PONTE_NOVA.latitude, PONTE_NOVA.longitude)
    const volta = geo.distanciaKm(PONTE_NOVA.latitude, PONTE_NOVA.longitude, VICOSA.latitude, VICOSA.longitude)
    assert.equal(ida, volta)
  })

  test('1 grau de latitude dá 111,2 km', () => {
    assert.ok(Math.abs(geo.distanciaKm(-20, -42, -21, -42) - 111.195) < 0.01)
  })

  test('fica a menos de 0,5% da distância no elipsoide WGS-84 (Vincenty)', () => {
    const pares = [[VICOSA, PONTE_NOVA], [BELO_HORIZONTE, RIO_DE_JANEIRO], [VICOSA, { latitude: -21.7642, longitude: -43.3503 }]]
    for (const [a, b] of pares) {
      const haversine = geo.distanciaKm(a.latitude, a.longitude, b.latitude, b.longitude)
      const referencia = vincentyKm(a.latitude, a.longitude, b.latitude, b.longitude)
      assert.ok(Math.abs(haversine - referencia) / referencia < 0.005, `Haversine ${haversine} x Vincenty ${referencia}`)
    }
  })

  test('arredonda a distância exibida em 100 m', () => {
    assert.equal(geo.arredondarKm(1.249), 1.2)
    assert.equal(geo.arredondarKm(1.25), 1.3)
    assert.equal(geo.arredondarKm(0.04), 0)
  })
})

describe('município do ponto (contornos do IBGE)', () => {
  test('acha a cidade de pontos da Zona da Mata', () => {
    assert.equal(geo.TOTAL_MUNICIPIOS, 142)
    assert.equal(geo.municipioDoPonto(VICOSA.latitude, VICOSA.longitude), 3171303)
    assert.equal(geo.municipioDoPonto(PONTE_NOVA.latitude, PONTE_NOVA.longitude), 3152105)
    assert.equal(geo.municipioDoPonto(-21.7642, -43.3503), 3136702) // Juiz de Fora
  })

  test('fora da Zona da Mata é null', () => {
    assert.equal(geo.municipioDoPonto(BELO_HORIZONTE.latitude, BELO_HORIZONTE.longitude), null)
    assert.equal(geo.municipioDoPonto(RIO_DE_JANEIRO.latitude, RIO_DE_JANEIRO.longitude), null)
    assert.equal(geo.pontoNaArea(BELO_HORIZONTE.latitude, BELO_HORIZONTE.longitude), false)
  })

  test('aceita até 5 km fora da divisa (erro do GPS), mas não 20 km', () => {
    const viçosaSul = geo.municipioDoPonto(-20.85, -42.85)
    assert.ok(viçosaSul !== null)
    assert.equal(geo.pontoNoMunicipio(VICOSA.latitude, VICOSA.longitude, 3171303), true)
    assert.equal(geo.pontoNoMunicipio(PONTE_NOVA.latitude, PONTE_NOVA.longitude, 3171303), false)
  })
})

describe('ponto aproximado do anúncio', () => {
  test('fica a menos de 200 m do exato e é sempre o mesmo para o mesmo ponto', () => {
    for (const [lat, lng] of [[-20.75471, -42.88194], [-21.12013, -42.94207], [-20.41583, -42.90861]]) {
      const a = geo.pontoAproximado(lat, lng)
      const b = geo.pontoAproximado(lat, lng)
      assert.deepEqual(a, b)
      assert.ok(geo.distanciaKm(lat, lng, a.latitude, a.longitude) * 1000 <= geo.RAIO_APROXIMACAO_M, 'longe demais do ponto exato')
    }
  })

  test('pontos vizinhos caem na mesma célula (não dá para achar a casa pela diferença)', () => {
    assert.deepEqual(geo.pontoAproximado(-20.75470, -42.88190), geo.pontoAproximado(-20.75480, -42.88200))
  })
})

describe('caixa do raio', () => {
  test('contém o círculo inteiro', () => {
    const caixa = geo.caixaDoRaio(VICOSA.latitude, VICOSA.longitude, 5)
    for (const angulo of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const rad = (angulo * Math.PI) / 180
      const lat = VICOSA.latitude + (5 / 111.32) * Math.cos(rad) * 0.999
      const lng = VICOSA.longitude + (5 / (111.32 * Math.cos((VICOSA.latitude * Math.PI) / 180))) * Math.sin(rad) * 0.999
      assert.ok(lat >= caixa.minLat && lat <= caixa.maxLat && lng >= caixa.minLng && lng <= caixa.maxLng, `${angulo} graus`)
    }
  })
})

describe('validação de coordenadas', () => {
  test('aceita número e texto com ponto decimal dentro da área', () => {
    assert.deepEqual(v.lerCoordenadas(-20.7547, -42.8819), { latitude: -20.7547, longitude: -42.8819, codigoIbge: 3171303 })
    assert.equal(v.lerCoordenadas('-20.7547', '-42.8819').codigoIbge, 3171303)
    assert.equal(v.lerCoordenadas(undefined, undefined), null)
  })

  test('latitude de -90 a 90 e longitude de -180 a 180', () => {
    assert.equal(erroDe(() => v.lerCoordenadas(91, -42)).status, 400)
    assert.equal(erroDe(() => v.lerCoordenadas(-91, -42)).status, 400)
    assert.equal(erroDe(() => v.lerCoordenadas(-20, 181)).status, 400)
    assert.equal(erroDe(() => v.lerCoordenadas(-20, -181)).status, 400)
  })

  test('recusa texto, NaN, Infinity, só uma das duas e o ponto 0,0', () => {
    for (const [lat, lng] of [['abc', '-42'], [Number.NaN, -42], [Infinity, -42], ['-20.7', undefined], [0, 0], ['1e1', '-42'], ['-20,75', '-42,88']]) {
      assert.equal(erroDe(() => v.lerCoordenadas(lat, lng)).status, 400, `${lat}, ${lng}`)
    }
  })

  test('fora da Zona da Mata é 422 FORA_DA_AREA, a não ser quando a área não importa', () => {
    const erro = erroDe(() => v.lerCoordenadas(BELO_HORIZONTE.latitude, BELO_HORIZONTE.longitude))
    assert.equal(erro.status, 422)
    assert.equal(erro.codigo, 'FORA_DA_AREA')
    assert.equal(v.lerCoordenadas(BELO_HORIZONTE.latitude, BELO_HORIZONTE.longitude, { dentroDaArea: false }).codigoIbge, null)
  })

  test('raio: inteiro de 1 a 300 km', () => {
    assert.equal(v.lerRaio('5'), 5)
    assert.equal(v.lerRaio(undefined, { padrao: 5 }), 5)
    for (const raio of ['0', '301', '2.5', '-1', 'abc', '10km']) assert.equal(erroDe(() => v.lerRaio(raio)).status, 400, raio)
  })

  test('precisão, momento da leitura, CEP e área do mapa', () => {
    assert.equal(v.lerPrecisao('12.345'), 12.35)
    assert.equal(erroDe(() => v.lerPrecisao(-1)).status, 400)
    assert.ok(v.lerMomento(Date.now() - 1000) instanceof Date)
    assert.equal(erroDe(() => v.lerMomento(Date.now() + 10 * 60 * 1000)).status, 400)
    assert.equal(erroDe(() => v.lerMomento(Date.now() - 48 * 60 * 60 * 1000)).status, 400)
    assert.equal(v.lerCep('36570-087'), '36570087')
    assert.equal(erroDe(() => v.lerCep('3657')).status, 400)
    assert.deepEqual(v.lerCaixa('-42.95,-20.80,-42.80,-20.70'), { minLng: -42.95, minLat: -20.8, maxLng: -42.8, maxLat: -20.7 })
    assert.equal(erroDe(() => v.lerCaixa('-42.80,-20.80,-42.95,-20.70')).status, 400)
    assert.equal(erroDe(() => v.lerCaixa('-49,-25,-40,-15')).status, 400)
  })
})

describe('log sem dado pessoal', () => {
  test('coordenadas, endereço, CEP, e-mail e chaves de push viram [omitido]', () => {
    const limpo = limparDados({ usuario_id: 3, latitude: -20.7, longitude: -42.8, cep: '36570087', email: 'a@b.c', rua: 'Rua X', endpoint: 'https://push', extra: { latitude_publica: -20.7 } })
    assert.deepEqual(limpo, {
      usuario_id: 3, latitude: '[omitido]', longitude: '[omitido]', cep: '[omitido]', email: '[omitido]',
      rua: '[omitido]', endpoint: '[omitido]', extra: { latitude_publica: '[omitido]' },
    })
  })
})

const regras = await import('../src/utils/regrasLocalizacao.js')

describe('regras de localização (sem banco)', () => {
  test('metros para quilômetros, com 100 m de resolução', () => {
    assert.equal(regras.metrosParaKm(0), 0)
    assert.equal(regras.metrosParaKm(1234), 1.2)
    assert.equal(regras.metrosParaKm('7050'), 7.1)
  })

  test('ordena por distância, sem distância vai para o fim e o empate mantém a ordem', () => {
    const itens = [{ id: 1, distancia_km: 3 }, { id: 2, distancia_km: null }, { id: 3, distancia_km: 0.5 }, { id: 4, distancia_km: 3 }]
    assert.deepEqual(regras.ordenarPorDistancia(itens).map((i) => i.id), [3, 1, 4, 2])
    assert.deepEqual(itens.map((i) => i.id), [1, 2, 3, 4], 'não mexe na lista original')
  })

  test('GPS com mais de 30 minutos está desatualizado; localização manual não envelhece', () => {
    const agora = Date.parse('2026-11-20T12:00:00Z')
    assert.equal(regras.localizacaoDesatualizada({ origem: 'gps', capturada_em: '2026-11-20T11:31:00Z' }, agora), false)
    assert.equal(regras.localizacaoDesatualizada({ origem: 'gps', capturada_em: '2026-11-20T11:29:00Z' }, agora), true)
    assert.equal(regras.localizacaoDesatualizada({ origem: 'manual', capturada_em: '2026-01-01T00:00:00Z' }, agora), false)
  })

  test('quando gravar uma nova leitura', () => {
    const agora = Date.parse('2026-11-20T12:00:00Z')
    const atual = { latitude: -20.7547, longitude: -42.8819, precisao_m: 20, origem: 'gps', cidade_id: 1, bairro_id: 1, atualizada_em: '2026-11-20T11:59:00Z' }
    const nova = (extra) => ({ latitude: -20.7547, longitude: -42.8819, precisao: 20, origem: 'gps', cidadeId: 1, bairroId: 1, ...extra })
    assert.deepEqual(regras.decidirAtualizacao(null, nova()), { gravar: true }, 'primeira vez grava')
    assert.ok(regras.decidirAtualizacao(atual, nova({ latitude: -20.7549 }), agora).motivo, 'andou 22 m: não grava')
    assert.deepEqual(regras.decidirAtualizacao(atual, nova({ latitude: -20.7560 }), agora), { gravar: true }, 'andou 145 m: grava')
    assert.deepEqual(regras.decidirAtualizacao(atual, nova({ precisao: 5 }), agora), { gravar: true }, 'precisão bem melhor: grava')
    assert.deepEqual(regras.decidirAtualizacao(atual, nova({ origem: 'manual', precisao: null }), agora), { gravar: true }, 'mudou para manual: grava')
    const recente = { ...atual, atualizada_em: new Date(agora - 500).toISOString() }
    assert.ok(regras.decidirAtualizacao(recente, nova({ latitude: -20.7600 }), agora).aguardarMs > 0, 'menos de 2 s: espera')
  })

  test('privacidade: o dono vê o ponto exato, a rua e o CEP; os outros, só o aproximado', () => {
    const linha = {
      latitude: -20.7612345, longitude: -42.8702345, latitude_publica: -20.76, longitude_publica: -42.87, precisao_m: '8.00',
      origem: 'gps', cidade_id: 1, cidade: 'Viçosa', uf: 'MG', bairro_id: 8, bairro: 'Campus UFV', rua: 'Rua X', cep: '36570000', atualizada_em: null,
    }
    const publica = regras.localizacaoVisivel(linha, false)
    assert.equal(publica.aproximada, true)
    assert.equal(publica.latitude, -20.76)
    assert.equal(publica.raio_aproximacao_m, 200)
    for (const campo of ['exata', 'rua', 'cep']) assert.ok(!(campo in publica), `${campo} vazou`)
    assert.ok(!JSON.stringify(publica).includes('-20.7612345'), 'coordenada exata vazou')
    const doDono = regras.localizacaoVisivel(linha, true)
    assert.deepEqual(doDono.exata, { latitude: -20.7612345, longitude: -42.8702345, precisao_m: 8 })
    assert.equal(doDono.rua, 'Rua X')
    assert.equal(regras.localizacaoVisivel({ ...linha, latitude_publica: null }, true), null, 'sem localização (rascunho)')
  })
})
