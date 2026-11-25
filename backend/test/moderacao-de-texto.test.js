// Moderação de texto: recusa armas de fogo, drogas, conteúdo sexual e ameaça, sem confundir o que pode
// (pistola de cola, biquíni, batom nude, bala de goma, "vou te pegar no ponto"...).
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { categoriaProibida, exigirTextoPermitido, normalizarTexto } from '../src/services/moderacaoDeTexto.js'

const RECUSA = {
  armas: [
    'Vendo revólver calibre 38', 'Revólver Taurus 357', 'revolver taurus .38 com coldre', 'REVÓLVER .38 SPL',
    'Pistola Taurus G2C 9mm', 'pistola .40 com dois carregadores', 'Pistola 380 semi automática', 'Pistola Glock com coldre',
    'Espingarda calibre 12', 'Carabina .22', 'Fuzil AR-15', 'Metralhadora', 'Garrucha antiga de família',
    'Munição 9mm caixa com 50', 'munições', 'Cartucho calibre 12 CBC', 'cartuchos cal. 38', 'Arma de fogo registrada',
    'Simulacro de pistola', 'Réplica de Glock perfeita', 'Pólvora para recarga', 'Dinamite', 'Bomba caseira',
    'Vendo .38 spl', 'cal. 38 oxidado', 'calibre .380', 'projéteis', 'm u n i ç ã o', 'MUNIÇÃÃÃO',
  ],
  drogas: [
    'Maconha prensada', 'm4c0nh4', 'm a c o n h a', 'MACONHAAAA', 'm.a.c.o.n.h.a', 'Cocaína pura', 'pedra de crack',
    'Lança-perfume', 'lanca perfume argentino', 'LSD', 'ecstasy', 'MDMA', 'cogumelos mágicos', 'Óleo de cannabis',
    'Anabolizante Durateston', 'Oxandrolona 20mg', 'deca durabolin', 'Rivotril sem receita', 'Ritalina 10mg', 'remédio tarja preta',
  ],
  sexual: [
    'Vídeo pornô', 'p0rn0 grátis', 'Vendo nudes', 'manda nudes', 'pack do pezinho', 'Conteúdo +18', 'conteúdo adulto exclusivo',
    'Meu OnlyFans', 'garota de programa', 'faço programa', 'Sexo virtual', 'fotos íntimas', 'chamada de vídeo hot',
    'putaria', 'vídeos de sexo', 'acompanhante de luxo',
  ],
  ameaca: [
    'Vou te matar', 'te mato', 'vou matar você', 'vou matar sua família', 'Vc vai morrer', 'vou te dar um tiro',
    'tiro na sua cara', 'vou te encher de porrada', 'vou quebrar sua cara', 'vou te bater', 'você vai levar uma surra',
    'vou acabar com você', 'vai se matar', 'vou tacar fogo na sua casa', 'v0u t3 m4t4r', 'VOU TE MATAAAR', 'te esfaqueio',
    'vou te espancar', 'te dou uma facada',
  ],
}

// o que pode: tem palavra parecida, mas não é o que a regra procura
const PASSA = [
  'Pistola de cola quente 40W', 'Pistola de pintura elétrica 380 W', 'Pistola de ar quente', 'Pistola de massagem',
  'Pistola de água para crianças', 'Pistola de pressão 4,5 mm', 'Pistola', 'Pistola de solda com 9mm de bico',
  'Enxada para revolver a terra', 'Disco Revolver dos Beatles', 'LP Revólver - The Beatles', 'Revólver de espoleta de brinquedo',
  'Carabina de pressão Gamo 5.5', 'Rifle de airsoft', 'Munição para airsoft (BBs 0.20g)', 'Arma de brinquedo Nerf',
  'Espingarda de chumbinho', 'Bala de goma sabor morango', 'Batom nude', 'Sandálias nudes tamanho 37', 'Saia midi nude',
  'Biquíni cortininha', 'Maiô infantil', 'Lingerie de renda', 'Calcinha e sutiã', 'Livro baseado em fatos reais',
  'Acompanhante de idosos', 'Faço programas de computador', 'Faço programa de exercícios', 'Programa de TV', 'Mata-mosquito',
  'Isso vai matar a saudade', 'Esse filme te mata de rir', 'Você vai morrer de rir com esse jogo', 'Vou te pegar no ponto às 10h',
  'Vou te bater uma foto do produto', 'Vou te quebrar um galho no preço', 'Vou te furar a orelha, faço piercing',
  'Posso te executar o serviço amanhã', 'O Flamengo vai levar uma surra', 'Faca de cozinha Tramontina', 'Tiro ao alvo',
  'Bomba d’água para piscina', 'Bomba de chocolate', 'Granada (pedra preciosa)', 'Cartucho de tinta HP 664', 'Calibrador de pneu',
  'Pneu aro 22', 'Erva-mate', 'Boneco da heroína da Marvel', 'Chocolate crocante', 'Testosterona? Só com receita, procure um médico',
  'Vou acabar com o estoque hoje', 'Você vai amar', 'Camiseta preta', 'Mesa de escritório', 'Air fryer 4L', 'iPhone 13 128GB',
  'Celular com 5G e 128GB', 'Moto G54', 'Bicicleta aro 29 com 21 marchas', 'Pode passar, sei onde você mora pelo mapa',
  'Fone com cancelamento de ruído', 'Sexta de 10h às 16h', 'Sexo do filhote: macho', 'Vendo cachorro-quente', 'Kit 4x4',
]

test('recusa armas, drogas, conteúdo sexual e ameaça (com acento, maiúscula, letra repetida, número no lugar de letra e letra separada)', () => {
  for (const [categoria, textos] of Object.entries(RECUSA)) {
    for (const texto of textos) assert.equal(categoriaProibida(texto, 'chat'), categoria, texto)
  }
})

test('não confunde: pistola de cola, revolver a terra, biquíni, batom nude, bala de goma, "vou te pegar no ponto"...', () => {
  for (const texto of PASSA) assert.equal(categoriaProibida(texto, 'chat'), null, texto)
})

test('cada lugar tem as suas regras: na avaliação dá para contar o que o vendedor ofereceu; ameaça não vale na lista de compras', () => {
  assert.equal(categoriaProibida('O vendedor me ofereceu maconha', 'avaliacao'), null)
  assert.equal(categoriaProibida('Vou te matar', 'avaliacao'), 'ameaca')
  assert.equal(categoriaProibida('Vídeo pornô', 'avaliacao'), 'sexual')
  assert.equal(categoriaProibida('munição', 'lista'), 'armas')
  assert.equal(categoriaProibida('Vou te matar', 'lista'), null)
  for (const onde of ['anuncio', 'procura', 'chat', 'perfil']) assert.equal(categoriaProibida('Pistola 9mm Taurus', onde), 'armas', onde)
  assert.equal(categoriaProibida('Pistola 9mm Taurus', 'lugar-que-nao-existe'), 'armas') // na dúvida, as regras do anúncio
  for (const vazio of [null, undefined, '']) assert.equal(categoriaProibida(vazio, 'chat'), null)
})

test('não deixa passar disfarce: letra de outro alfabeto, caractere invisível, letra larga e negrito matemático', () => {
  assert.equal(categoriaProibida('mаconha', 'chat'), 'drogas') // "а" russo
  assert.equal(categoriaProibida('pοrnô', 'chat'), 'sexual') // "ο" grego
  assert.equal(categoriaProibida('mac​onha', 'chat'), 'drogas') // espaço de largura zero
  assert.equal(categoriaProibida('mu­ni­ção', 'chat'), 'armas') // hífen invisível
  assert.equal(categoriaProibida('ｍａｃｏｎｈａ', 'chat'), 'drogas') // letra larga
  assert.equal(categoriaProibida('𝐦𝐚𝐜𝐨𝐧𝐡𝐚', 'chat'), 'drogas') // negrito matemático
  assert.equal(categoriaProibida('rev​ólver calibre 38', 'chat'), 'armas')
  assert.equal(categoriaProibida('Rua 1º de Maio, 2º andar', 'chat'), null)
})

test('normaliza sem estragar números e medidas', () => {
  assert.equal(normalizarTexto('M4C0NH4'), 'maconha')
  assert.equal(normalizarTexto('m . a . c . o . n . h . a'), 'maconha')
  assert.equal(normalizarTexto('Calibre .38 e 9mm'), 'calibre .38 e 9mm')
  assert.equal(normalizarTexto('Celular 128GB 5G'), 'celular 128gb 5g')
  assert.equal(normalizarTexto('Muuuuito bom'), 'muito bom')
})

test('exigirTextoPermitido: 422 CONTEUDO_PROIBIDO dizendo o que revisar; campo vazio passa', () => {
  assert.doesNotThrow(() => exigirTextoPermitido({ titulo: 'Bicicleta aro 29', descricao: null, localizacao: '' }))
  assert.throws(
    () => exigirTextoPermitido({ titulo: 'Bicicleta aro 29', descricao: 'Acompanha munição calibre 12' }, { onde: 'anuncio' }),
    (erro) => {
      assert.equal(erro.status, 422)
      assert.equal(erro.codigo, 'CONTEUDO_PROIBIDO')
      assert.deepEqual(erro.campos, ['descricao'])
      assert.match(erro.message, /armas de fogo, munição.*Revise a descrição\.$/)
      return true
    },
  )
})

test('nada do seed (anúncios, conversas, perfis, avaliações) é recusado', async () => {
  const seed = await readFile(path.join(import.meta.dirname, '../database/seed.sql'), 'utf8')
  const textos = [...seed.matchAll(/'((?:[^'\\]|\\.|'')*)'/g)].map((m) => m[1]).filter((t) => t.length >= 3)
  assert.ok(textos.length > 50, `poucos textos no seed: ${textos.length}`)
  for (const texto of textos) assert.equal(categoriaProibida(texto, 'chat'), null, texto)
})
