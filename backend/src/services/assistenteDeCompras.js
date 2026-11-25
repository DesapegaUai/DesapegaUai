// IA do DesapegaUai: compara anúncios parecidos e entende a lista de compras. Roda aqui no servidor,
// sem serviço pago e sem mandar dados para fora. Não conversa como um chat: são regras que leem o título
// e a descrição, descobrem o tipo do produto, separam as características e os defeitos citados pelo
// vendedor e dão uma nota de custo-benefício de 0 a 10, sempre com o motivo.

const MARCAS = /[̀-ͯ]/g

/**
 * Texto sem acento e em minúsculas, com o mesmo tamanho do original (em NFC). Assim um trecho achado
 * no texto normalizado pode ser mostrado do jeito que a pessoa escreveu, com acento.
 */
export function normalizar(texto) {
  let saida = ''
  for (const letra of String(texto ?? '').normalize('NFC')) {
    const simples = letra.normalize('NFD').replace(MARCAS, '').toLowerCase()
    saida += simples.length === letra.length ? simples : ' '.repeat(letra.length)
  }
  return saida
}

const SEM_PLURAL = new Set(['tenis', 'lapis', 'onibus', 'oculos', 'pires', 'virus', 'atlas', 'gas', 'mais', 'tres', 'ps'])

// plural simples do português: mesas -> mesa, celulares -> celular, colchões -> colchao
export function singular(palavra) {
  if (palavra.length <= 3 || SEM_PLURAL.has(palavra) || /\d/.test(palavra)) return palavra
  if (/(oes|aes)$/.test(palavra)) return `${palavra.slice(0, -3)}ao`
  if (palavra.endsWith('ais')) return `${palavra.slice(0, -3)}al`
  if (/[^a]eis$/.test(palavra)) return `${palavra.slice(0, -3)}el`
  if (/(res|zes)$/.test(palavra)) return palavra.slice(0, -2)
  if (palavra.endsWith('ns')) return `${palavra.slice(0, -2)}m`
  if (palavra.endsWith('s') && !palavra.endsWith('ss')) return palavra.slice(0, -1)
  return palavra
}

/** palavras do texto, sem acento e no singular */
export function palavras(texto) {
  return normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean).map(singular)
}

// posição (em palavras) do termo no texto, ou -1; termo de várias palavras precisa vir junto
function posicao(lista, termo) {
  const partes = termo.split(' ')
  for (let i = 0; i <= lista.length - partes.length; i += 1) {
    if (partes.every((parte, j) => lista[i + j] === parte)) return i
  }
  return -1
}

// ---------------------------------------------------------------- características (lidas no título e na descrição)

const virgula = (n) => String(n).replace('.', ',')
const c = (re, rotulo) => ({ re, rotulo: typeof rotulo === 'string' ? () => rotulo : rotulo })
const C = {
  aro: c(/\baro\s*(\d{2})\b/, (m) => `Aro ${m[1]}`),
  marchas: c(/\b(\d{1,2})\s*(?:marchas?|velocidades?|v)\b/, (m) => `${m[1]} marchas`),
  aluminio: c(/\balumini/, 'Alumínio'),
  aco: c(/\baco\b/, 'Aço'),
  carbono: c(/\bcarbono\b/, 'Carbono'),
  freioDisco: c(/\bfreios?\s*(?:a\s*)?disco\b|\bdisco\s*hidraulico\b/, 'Freio a disco'),
  suspensao: c(/\bsuspens(?:ao|oes)\b/, 'Suspensão'),
  revisada: c(/\brevisad[oa]s?\b/, 'Revisada'),
  shimano: c(/\bshimano\b/, 'Shimano'),
  armazenamento: c(/\b(16|32|64|128|256|512)\s*gb\b(?!\s*(?:de\s*)?ram)/, (m) => `${m[1]} GB`),
  ram: c(/\b(\d{1,2})\s*gb\s*(?:de\s*)?ram\b|\bram\s*(?:de\s*)?(\d{1,2})\s*gb\b/, (m) => `${m[1] ?? m[2]} GB de RAM`),
  bateria: c(/\bbateria\s*(?:com|em|de|a|esta|:)?\s*(\d{2,3})\s*%/, (m) => `Bateria ${m[1]}%`),
  cincoG: c(/\b5g\b/, '5G'),
  dualChip: c(/\bdual\s*chip\b/, 'Dual chip'),
  ssd: c(/\bssd\s*(?:de\s*)?(\d{3,4})\s*(?:gb)?\b|\b(\d{3,4})\s*gb\s*(?:de\s*)?ssd\b|\bssd\b/, (m) => (m[1] || m[2] ? `SSD ${m[1] ?? m[2]} GB` : 'SSD')),
  processador: c(/\b(?:core\s*)?(i[3579])\b|\bryzen\s*(\d)\b/, (m) => (m[1] ? `Core ${m[1]}` : `Ryzen ${m[2]}`)),
  polegadas: c(/\b(\d{2}(?:[.,]\d)?)\s*(?:pol\b|polegadas\b|"|”|'')/, (m) => `${virgula(m[1])} polegadas`),
  smart: c(/\bsmart\b/, 'Smart'),
  quatroK: c(/\b4k\b|\buhd\b/, '4K'),
  fullHd: c(/\bfull\s*hd\b|\b1080p?\b|\bfhd\b/, 'Full HD'),
  hertz: c(/\b(\d{2,3})\s*hz\b/, (m) => `${m[1]} Hz`),
  ips: c(/\bips\b/, 'Tela IPS'),
  curvo: c(/\bcurv[oa]\b/, 'Curvo'),
  centimetros: c(/\b(\d{2,3})\s*(?:cm|centimetros)\b/, (m) => `${m[1]} cm`),
  madeira: c(/\bmadeira\b/, 'Madeira'),
  mdf: c(/\bmdf\b/, 'MDF'),
  vidro: c(/\bvidro\b/, 'Vidro'),
  metal: c(/\bmetal\b|\bferro\b/, 'Metal'),
  gavetas: c(/\b(\d)\s*gavetas?\b|\bgavetas?\b/, (m) => (m[1] ? `${m[1]} ${m[1] === '1' ? 'gaveta' : 'gavetas'}` : 'Com gaveta')),
  lugares: c(/\b(\d{1,2})\s*lugares\b/, (m) => `${m[1]} lugares`),
  giratoria: c(/\bgiratori[oa]\b/, 'Giratória'),
  rodinhas: c(/\brodinhas?\b|\brodizios?\b/, 'Com rodinhas'),
  gamer: c(/\bgamer\b/, 'Gamer'),
  ergonomica: c(/\bergonomic[oa]\b/, 'Ergonômica'),
  regulagem: c(/\bregulage(?:m|ns)\b|\bregulave(?:l|is)\b|\bajustave(?:l|is)\b/, 'Com regulagem'),
  litros: c(/\b(\d{1,3}(?:[.,]\d)?)\s*(?:l|litros)\b/, (m) => `${virgula(m[1])} litros`),
  frostFree: c(/\bfrost\s*free\b/, 'Frost free'),
  voltagem: c(/\b(110|127|220)\s*v\b|\bbivolt\b/, (m) => (m[1] ? `${m[1]} V` : 'Bivolt')),
  bocas: c(/\b(\d)\s*bocas\b/, (m) => `${m[1]} bocas`),
  quilos: c(/\b(\d{1,2}(?:[.,]\d)?)\s*kg\b/, (m) => `${virgula(m[1])} kg`),
  portas: c(/\b(\d)\s*portas\b/, (m) => `${m[1]} portas`),
  inox: c(/\binox\b/, 'Inox'),
  controles: c(/\b(\d)\s*controles\b|\bcom\s*controle\b/, (m) => (m[1] ? `${m[1]} controles` : 'Com controle')),
  jogos: c(/\b(\d{1,2})\s*jogos\b/, (m) => `${m[1]} jogos`),
  espaco: c(/\b(\d)\s*tb\b|\b(500|825|1000)\s*gb\b/, (m) => (m[1] ? `${m[1]} TB` : `${m[2]} GB`)),
}
// valem para qualquer produto
const GERAIS = [
  c(/\bcom\s*(?:a\s*)?caixa\b|\bna\s*caixa\b|\bcaixa\s*original\b/, 'Com caixa'),
  c(/\bnota\s*fiscal\b|\bcom\s*nf\b/, 'Com nota fiscal'),
  c(/\bgarantia\b/, 'Na garantia'),
]

// ---------------------------------------------------------------- tipos de produto

const ELETRONICO = ['capa', 'capinha', 'pelicula', 'carregador', 'fone', 'cabo', 'suporte', 'case', 'adaptador', 'bateria externa']

/**
 * Cada tipo: os termos que mostram o que é (no título), os acessórios (que vêm antes do termo: "capa
 * para celular" é acessório, "celular com capa" é celular), as variações que não se comparam entre si
 * (bicicleta infantil e de adulto) e as características que valem a pena ler. Variação especial
 * (infantil, elétrica, de bebê) só entra na lista de compras de quem pediu por ela; as outras (mesa
 * de escritório ou de jantar, PS4 ou Xbox) entram para quem pediu só o tipo ("Mesa", "Videogame").
 */
const TIPOS = [
  { id: 'tablet', genero: 'o', nome: 'Tablet', plural: 'tablets', termos: ['tablet', 'ipad', 'galaxy tab'], acessorios: ELETRONICO, carac: ['armazenamento', 'ram', 'polegadas', 'cincoG'] },
  { id: 'celular', genero: 'o', nome: 'Celular', plural: 'celulares', termos: ['celular', 'smartphone', 'iphone', 'galaxy', 'moto g', 'moto e', 'motorola', 'redmi', 'xiaomi', 'poco', 'zenfone'],
    // modelos escritos juntos: "Moto G54", "Galaxy A15", "iPhone 13", "Redmi Note 12" ("Moto Honda" é moto, não entra)
    padroes: [/\bmoto\s*[gez]\s*\d{1,3}\b/, /\bgalaxy\s*[asmz]\s*\d{1,3}\b/, /\biphone\s*\d{1,2}\b/, /\bredmi\s*(?:note\s*)?\d{1,2}\b/],
    acessorios: [...ELETRONICO, 'smartwatch', 'relogio'], carac: ['armazenamento', 'ram', 'bateria', 'cincoG', 'dualChip'] },
  { id: 'notebook', genero: 'o', nome: 'Notebook', plural: 'notebooks', termos: ['notebook', 'laptop', 'macbook', 'chromebook', 'ultrabook'], acessorios: [...ELETRONICO, 'mochila', 'bolsa', 'cooler', 'mouse', 'teclado', 'fonte'], carac: ['ram', 'ssd', 'processador', 'polegadas'] },
  { id: 'monitor', genero: 'o', nome: 'Monitor', plural: 'monitores', termos: ['monitor'], acessorios: ['suporte', 'braco', 'cabo'], carac: ['polegadas', 'hertz', 'fullHd', 'ips', 'curvo'] },
  { id: 'tv', genero: 'a', nome: 'TV', plural: 'TVs', termos: ['tv', 'televisao', 'televisor', 'smart tv'], acessorios: ['suporte', 'controle', 'antena', 'cabo', 'conversor', 'rack', 'painel'], carac: ['polegadas', 'smart', 'quatroK', 'fullHd'] },
  { id: 'videogame', genero: 'o', nome: 'Videogame', plural: 'videogames', termos: ['videogame', 'video game', 'playstation', 'ps2', 'ps3', 'ps4', 'ps5', 'xbox', 'nintendo', 'switch'], acessorios: ['controle', 'jogo', 'capa', 'suporte', 'headset', 'fone', 'volante', 'cabo'],
    variantes: [{ id: 'ps5', nome: 'PS5', termos: ['ps5', 'playstation 5'] }, { id: 'ps4', nome: 'PS4', termos: ['ps4', 'playstation 4'] }, { id: 'xbox', nome: 'Xbox', termos: ['xbox'] }, { id: 'nintendo', nome: 'Nintendo', termos: ['nintendo', 'switch'] }],
    carac: ['espaco', 'controles', 'jogos'] },
  { id: 'bicicleta', genero: 'a', nome: 'Bicicleta', plural: 'bicicletas', termos: ['bicicleta', 'bike', 'mountain bike', 'mtb', 'speed'], acessorios: ['capacete', 'pedal', 'farol', 'bomba', 'cadeado', 'suporte', 'pneu', 'camara', 'selim', 'corrente', 'luva', 'bagageiro', 'garrafa', 'caramanhola'],
    variantes: [{ id: 'infantil', nome: 'infantil', especial: true, termos: ['infantil', 'crianca', 'aro 12', 'aro 14', 'aro 16', 'aro 20'] }, { id: 'eletrica', genero: 'o', nome: 'elétrica', especial: true, termos: ['eletrica', 'motorizada'] }],
    carac: ['aro', 'marchas', 'aluminio', 'aco', 'carbono', 'freioDisco', 'suspensao', 'revisada', 'shimano'] },
  { id: 'cadeira', genero: 'a', nome: 'Cadeira', plural: 'cadeiras', termos: ['cadeira', 'poltrona'], acessorios: ['capa', 'almofada'],
    variantes: [{ id: 'bebe', nome: 'de bebê', especial: true, termos: ['bebe', 'cadeirinha', 'alimentacao'] }],
    carac: ['giratoria', 'rodinhas', 'gamer', 'ergonomica', 'regulagem', 'madeira', 'metal'] },
  { id: 'mesa', genero: 'a', nome: 'Mesa', plural: 'mesas', termos: ['mesa', 'escrivaninha'], acessorios: ['toalha', 'forro', 'luminaria', 'tampo'],
    variantes: [{ id: 'escritorio', nome: 'Escritório', termos: ['escritorio', 'escrivaninha', 'computador', 'estudo', 'home office'] }, { id: 'jantar', genero: 'o', nome: 'Jantar', termos: ['jantar', 'cozinha', 'refeicao'] }],
    carac: ['centimetros', 'madeira', 'mdf', 'vidro', 'metal', 'gavetas', 'lugares'] },
  { id: 'sofa', genero: 'o', nome: 'Sofá', plural: 'sofás', termos: ['sofa'], acessorios: ['capa', 'almofada', 'manta'], carac: ['lugares', 'madeira'] },
  { id: 'cama', genero: 'a', nome: 'Cama', plural: 'camas', termos: ['cama', 'beliche', 'bicama'], acessorios: ['lencol', 'edredom', 'travesseiro', 'colcha'], carac: ['madeira', 'mdf', 'metal'] },
  { id: 'colchao', genero: 'o', nome: 'Colchão', plural: 'colchões', termos: ['colchao'], acessorios: ['capa', 'protetor', 'lencol'], carac: [] },
  { id: 'guardaroupa', genero: 'o', nome: 'Guarda-roupa', plural: 'guarda-roupas', termos: ['guarda roupa', 'guardaroupa', 'armario', 'roupeiro'], acessorios: [], carac: ['portas', 'gavetas', 'madeira', 'mdf'] },
  { id: 'geladeira', genero: 'a', nome: 'Geladeira', plural: 'geladeiras', termos: ['geladeira', 'refrigerador', 'frigobar'], acessorios: ['borracha', 'prateleira'], carac: ['litros', 'frostFree', 'voltagem', 'inox', 'portas'] },
  { id: 'fogao', genero: 'o', nome: 'Fogão', plural: 'fogões', termos: ['fogao', 'cooktop'], acessorios: ['botijao', 'mangueira', 'regulador'], carac: ['bocas', 'inox', 'voltagem'] },
  { id: 'lavadora', genero: 'a', nome: 'Máquina de lavar', plural: 'máquinas de lavar', termos: ['maquina de lavar', 'lavadora', 'lava e seca', 'tanquinho'], acessorios: ['capa', 'mangueira'], carac: ['quilos', 'voltagem'] },
  { id: 'microondas', genero: 'o', nome: 'Micro-ondas', plural: 'micro-ondas', termos: ['microonda', 'micro onda'], acessorios: [], carac: ['litros', 'voltagem', 'inox'] },
  { id: 'airfryer', genero: 'a', nome: 'Air fryer', plural: 'air fryers', termos: ['air fryer', 'airfryer', 'fritadeira'], acessorios: ['forma', 'cesto'], carac: ['litros', 'voltagem'] },
  { id: 'ventilador', genero: 'o', nome: 'Ventilador', plural: 'ventiladores', termos: ['ventilador', 'circulador'], acessorios: [], carac: ['voltagem', 'centimetros'] },
  { id: 'impressora', genero: 'a', nome: 'Impressora', plural: 'impressoras', termos: ['impressora', 'multifuncional'], acessorios: ['cartucho', 'toner', 'tinta', 'cabo'], carac: [] },
].map((tipo) => ({
  ...tipo,
  termos: tipo.termos.map((t) => palavras(t).join(' ')),
  acessorios: tipo.acessorios.map((t) => palavras(t).join(' ')),
  variantes: (tipo.variantes ?? []).map((v) => ({ ...v, termos: v.termos.map((t) => palavras(t).join(' ')) })),
}))

export const nomeDoTipo = (id) => TIPOS.find((t) => t.id === id) ?? null

/**
 * O que o título diz que o anúncio é: o tipo cujo termo aparece primeiro (empate: o termo mais longo,
 * "galaxy tab" ganha de "galaxy"). Acessório que vem antes do termo ("Suporte de TV") vira acessório.
 */
export function descobrirTipo(titulo) {
  const lista = palavras(titulo)
  const norm = normalizar(titulo)
  let melhor = null
  const considerar = (tipo, onde, tamanho) => {
    if (!melhor || onde < melhor.onde || (onde === melhor.onde && tamanho > melhor.tamanho)) melhor = { tipo, onde, tamanho }
  }
  for (const tipo of TIPOS) {
    for (const termo of tipo.termos) {
      const onde = posicao(lista, termo)
      if (onde !== -1) considerar(tipo, onde, termo.split(' ').length)
    }
    for (const padrao of tipo.padroes ?? []) {
      const achado = norm.match(padrao)
      if (achado) considerar(tipo, norm.slice(0, achado.index).split(/[^a-z0-9]+/).filter(Boolean).length, 2)
    }
  }
  if (!melhor) return { tipo: null, variante: null, acessorio: false }
  const acessorio = melhor.tipo.acessorios.some((termo) => {
    const onde = posicao(lista, termo)
    return onde !== -1 && onde < melhor.onde
  })
  const variante = melhor.tipo.variantes.find((v) => v.termos.some((termo) => posicao(lista, termo) !== -1)) ?? null
  return { tipo: melhor.tipo, variante, acessorio }
}

// ---------------------------------------------------------------- negação e defeitos

// "sem arranhões", "nenhum risco", "não tem suspensão": a palavra nega o que vem logo depois. Em defeito,
// vale para a lista toda ("sem riscos, amassados ou manchas"); em característica, para na vírgula
// ("sem suspensão, quadro de aço": o aço conta). Sempre para no fim da frase e num "mas".
const NEGA = /\b(?:sem|nenhum|nenhuma|zero|nada de|livre de|nunca|nao tem|nao possui|nao vem|nao acompanha|nao apresenta|nao ha)\s+(?:\S+\s+){0,N}$/.source
const NEGA_CURTA = new RegExp(NEGA.replace('N', '2'))
const NEGA_EM_LISTA = new RegExp(NEGA.replace('N', '4'))
const CONTRASTE = /\b(?:mas|porem|contudo|entretanto|so que|exceto|apenas|somente)\b/
function negado(norm, inicio, { emLista = false } = {}) {
  const frase = norm.slice(Math.max(0, inicio - 60), inicio).split(emLista ? /[.;:!?\n]/ : /[.,;:!?\n]/).pop()
  return (emLista ? NEGA_EM_LISTA : NEGA_CURTA).test(frase.split(CONTRASTE).pop())
}

const DEFEITOS = [
  /\btrincad[oa]s?\b|\btrincas?\b/,
  /\bquebrad[oa]s?\b/,
  /\brachad[oa]s?\b|\brachaduras?\b/,
  /\barranhad[oa]s?\b|\barranh(?:ao|oes)\b/,
  /\briscad[oa]s?\b|\briscos?\b/,
  /\bamassad[oa]s?\b|\bamassados?\b/,
  /\bmanchad[oa]s?\b|\bmanchas?\b/,
  /\brasgad[oa]s?\b|\brasgos?\b/,
  /\bdesgastad[oa]s?\b|\bgast[oa]s?\b/,
  /\bcom\s*defeitos?\b|\bdefeituos[oa]s?\b|\bdefeitos?\b/,
  /\bnao\s*(?:liga|funciona|carrega|esquenta|gela|acende)\b/,
  /\bprecisa\s*(?:de\s*)?(?:reparo|conserto|manutencao|troca|trocar|consertar)\b/,
  /\bbateria\s*viciada\b/,
  /\bfalhando\b/,
  /\benferrujad[oa]s?\b|\bferrugem\b/,
  /\bqueimad[oa]s?\b/,
  /\bdescascad[oa]s?\b|\bdescascando\b/,
  /\bvazando\b|\bvazamento\b/,
]
const PARA = /[.,;:!?()\n]/
const ENCHIMENTO = new Set(['com', 'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os', 'e', 'mas', 'porem', 'so', 'um', 'uma', 'tem', 'esta', 'ta', 'ficou', 'que', 'apenas', 'possui', 'apresenta', 'unico', 'unica', 'detalhe'])
const CORTA_A_DIREITA = new Set(['mas', 'porem', 'e', 'que', 'so', 'mais'])

// palavras vizinhas do trecho, para o defeito fazer sentido: "Pneu traseiro gasto", "Arranhões na tampa"
function trechoDoDefeito(original, norm, inicio, fim) {
  const antes = []
  let i = inicio
  while (antes.length < 2) {
    let j = i - 1
    while (j >= 0 && norm[j] === ' ') j -= 1
    if (j < 0 || PARA.test(norm[j])) break
    let k = j
    while (k >= 0 && /[a-z0-9]/.test(norm[k])) k -= 1
    if (k === j) break
    antes.unshift({ inicio: k + 1, palavra: norm.slice(k + 1, j + 1) })
    i = k + 1
  }
  while (antes.length && ENCHIMENTO.has(antes[0].palavra)) antes.shift()
  let comeco = antes.length ? antes[0].inicio : inicio
  let final = fim
  if (!antes.length) {
    // nada útil antes ("Arranhões na tampa"): pega até duas palavras depois
    let contadas = 0
    let j = fim
    while (contadas < 2) {
      while (j < norm.length && norm[j] === ' ') j += 1
      if (j >= norm.length || PARA.test(norm[j])) break
      let k = j
      while (k < norm.length && /[a-z0-9]/.test(norm[k])) k += 1
      if (k === j || CORTA_A_DIREITA.has(norm.slice(j, k))) break
      final = k
      j = k
      contadas += 1
    }
  }
  comeco = Math.max(0, comeco)
  const texto = original.slice(comeco, final).replace(/\s+/g, ' ').trim().slice(0, 40)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// ---------------------------------------------------------------- leitura de um anúncio

/**
 * O que a IA entende de um anúncio: tipo, variação, se é acessório, características (as do tipo e as
 * gerais) e pontos de atenção (defeitos citados, nunca os negados como "sem arranhões").
 */
export function lerAnuncio(anuncio) {
  const original = `${anuncio.titulo ?? ''}. ${anuncio.descricao ?? ''}`.normalize('NFC')
  const norm = normalizar(original)
  const { tipo, variante, acessorio } = descobrirTipo(anuncio.titulo)

  const caracteristicas = []
  const extratores = [...(tipo?.carac ?? []).map((nome) => C[nome]), ...GERAIS]
  for (const { re, rotulo } of extratores) {
    const achado = norm.match(re)
    if (!achado || negado(norm, achado.index)) continue
    const texto = rotulo(achado)
    if (!caracteristicas.includes(texto)) caracteristicas.push(texto)
  }

  const atencao = []
  const usados = []
  for (const re of DEFEITOS) {
    const busca = new RegExp(re.source, 'g')
    for (const achado of norm.matchAll(busca)) {
      const inicio = achado.index
      const fim = inicio + achado[0].length
      if (usados.some(([a, b]) => inicio < b && fim > a) || negado(norm, inicio, { emLista: true })) continue
      usados.push([inicio, fim])
      const trecho = trechoDoDefeito(original, norm, inicio, fim)
      if (trecho && !atencao.includes(trecho)) atencao.push(trecho)
      if (atencao.length >= 3) break
    }
    if (atencao.length >= 3) break
  }

  // bicicleta de aro 20 para baixo é infantil, mesmo sem a palavra no título
  let varianteFinal = variante
  if (tipo?.id === 'bicicleta' && !variante) {
    const aro = Number(norm.match(/\baro\s*(\d{2})\b/)?.[1])
    if (aro && aro <= 20) varianteFinal = tipo.variantes.find((v) => v.id === 'infantil')
  }

  return { tipo, variante: varianteFinal, acessorio, caracteristicas, atencao }
}

// ---------------------------------------------------------------- preços, nota e motivo

// pesos da nota de custo-benefício (somam 1)
export const PESOS = { preco: 0.35, estado: 0.2, caracteristicas: 0.2, informacoes: 0.15, distancia: 0.1 }
const ESTADO = { novo: 100, seminovo: 85, usado: 65 }
const limitar = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n))
const reais = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`
const km = (n) => `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`

function juntar(lista) {
  if (lista.length <= 1) return lista[0] ?? ''
  return `${lista.slice(0, -1).join(', ')} e ${lista.at(-1)}`
}

export function precosDoGrupo(anuncios) {
  const valores = anuncios.map((a) => Number(a.preco))
  return {
    menor: Math.min(...valores),
    media: Math.round(valores.reduce((s, v) => s + v, 0) / valores.length),
    maior: Math.max(...valores),
  }
}

// abaixo, na média (até 5% de diferença) ou acima, com a diferença em reais
export function faixaDoPreco(preco, media) {
  const diferenca = Math.round(Number(preco) - media)
  if (!media || Math.abs(diferenca) / media < 0.05) return { tipo: 'media', diferenca: 0 }
  return { tipo: diferenca < 0 ? 'abaixo' : 'acima', diferenca: Math.abs(diferenca) }
}

/**
 * Nota de custo-benefício e motivo de cada anúncio, comparando com os outros do grupo.
 * Cada anúncio precisa de: id, titulo, descricao, preco, condicao, total_fotos e distancia_km (ou null).
 * Devolve os anúncios com faixa, partes (0 a 100 por critério), nota (0 a 10), motivo e melhor.
 */
export function avaliarGrupo(anuncios) {
  if (!anuncios.length) return { precos: null, anuncios: [] }
  const lidos = anuncios.map((a) => ({ anuncio: a, leitura: a.leitura ?? lerAnuncio(a) }))
  const precos = precosDoGrupo(anuncios)
  const maisCaracteristicas = Math.max(...lidos.map(({ leitura }) => leitura.caracteristicas.length))

  const avaliados = lidos.map(({ anuncio, leitura }) => {
    const faixa = faixaDoPreco(anuncio.preco, precos.media)
    const fotos = Number(anuncio.total_fotos ?? 0)
    const descricao = String(anuncio.descricao ?? '').trim()
    const distancia = anuncio.distancia_km ?? null
    const defeitos = Math.min(leitura.atencao.length, 2)
    const partes = {
      preco: Math.round(limitar(75 + 160 * ((precos.media - Number(anuncio.preco)) / precos.media))),
      estado: Math.round(limitar((ESTADO[anuncio.condicao] ?? 75) - 12 * defeitos, 20)),
      caracteristicas: Math.round(maisCaracteristicas ? 30 + 70 * (leitura.caracteristicas.length / maisCaracteristicas) : 60),
      informacoes: Math.round((Math.min(fotos, 6) / 6) * 60 + (Math.min(descricao.length, 300) / 300) * 40),
      distancia: Math.round(distancia === null ? 60 : limitar(100 - Math.max(0, distancia - 1) * 9, 20)),
    }
    const nota = Math.round(Object.entries(PESOS).reduce((soma, [criterio, peso]) => soma + partes[criterio] * peso, 0)) / 10
    return { anuncio, leitura, faixa, partes, nota: Math.round(nota * 10) / 10, fotos, descricao, distancia }
  })

  // o que só este anúncio tem no grupo vira destaque no motivo (medida e material não são vantagem)
  const NEUTROS = new Set(['Aço', 'Alumínio', 'Carbono', 'Madeira', 'MDF', 'Vidro', 'Metal', 'Curvo'])
  const ehVantagem = (item) => !/\d/.test(item) && !NEUTROS.has(item)
  const contagem = new Map()
  for (const { leitura } of avaliados) for (const item of leitura.caracteristicas) contagem.set(item, (contagem.get(item) ?? 0) + 1)

  const melhor = [...avaliados].sort((a, b) => b.nota - a.nota || a.anuncio.preco - b.anuncio.preco || (a.distancia ?? 99) - (b.distancia ?? 99))[0]
  return {
    precos,
    anuncios: avaliados.map((avaliado) => {
      const { anuncio, leitura, faixa, partes, nota, fotos, descricao, distancia } = avaliado
      const bons = []
      const ruins = []
      const menorPreco = avaliados.length > 1 && Number(anuncio.preco) === precos.menor
      if (faixa.tipo === 'abaixo') bons.push(menorPreco ? `menor preço (${reais(faixa.diferenca)} abaixo da média)` : `${reais(faixa.diferenca)} abaixo da média`)
      if (faixa.tipo === 'media') bons.push('preço na média')
      if (faixa.tipo === 'acima') ruins.push(`${reais(faixa.diferenca)} acima da média`)
      if (anuncio.condicao === 'novo' || anuncio.condicao === 'seminovo') bons.push(`estado ${anuncio.condicao}`)
      if (anuncio.condicao === 'usado') ruins.push('estado usado')
      for (const defeito of leitura.atencao.slice(0, 2)) ruins.push(`o vendedor cita ${defeito.toLowerCase()}`)
      if (distancia !== null && distancia <= 2) bons.push(`a ${km(distancia)}`)
      if (distancia !== null && distancia >= 5) ruins.push(`fica a ${km(distancia)}`)
      if (fotos >= 5) bons.push(`${fotos} fotos`)
      if (fotos === 0) ruins.push('sem fotos')
      else if (fotos <= 2) ruins.push(`só ${fotos} ${fotos === 1 ? 'foto' : 'fotos'}`)
      if (descricao.length < 40) ruins.push('descrição curta')

      let motivo = bons.length ? juntar(bons) : ''
      if (ruins.length) motivo = motivo ? `${motivo}, mas ${juntar(ruins)}` : juntar(ruins)
      motivo = motivo ? `${motivo.charAt(0).toUpperCase()}${motivo.slice(1)}.` : ''
      const destaques = avaliados.length > 1 ? leitura.caracteristicas.filter((item) => contagem.get(item) === 1 && ehVantagem(item)).slice(0, 2) : []
      if (destaques.length) motivo = `${motivo} ${destaques.length === 1 ? 'Destaque' : 'Destaques'}: ${juntar(destaques.map((d) => (/^[A-Z0-9]{2}/.test(d) ? d : d.toLowerCase())))}.`.trim()

      return {
        ...anuncio,
        caracteristicas: leitura.caracteristicas,
        atencao: leitura.atencao,
        faixa,
        partes,
        nota,
        motivo,
        melhor: avaliados.length > 1 && avaliado === melhor,
      }
    }),
  }
}

// ---------------------------------------------------------------- grupo da busca

const MOTIVO_DE_FORA = {
  acessorio: 'é acessório, não o produto',
  variante: (v) => `não é do mesmo tipo (${v})`,
  outro: 'é outro produto',
}

/**
 * Dos anúncios achados na busca, quais são parecidos o bastante para comparar. Com um tipo conhecido
 * (pelo termo buscado ou pela maioria dos anúncios), ficam os desse tipo e da mesma variação; os outros
 * saem da conta com o motivo. Sem tipo, ficam os da categoria que mais aparece.
 */
export function separarParecidos(termo, anuncios) {
  const lidos = anuncios.map((anuncio) => ({ anuncio, leitura: lerAnuncio(anuncio) }))
  const doTermo = termo ? descobrirTipo(termo) : { tipo: null, variante: null }
  let tipo = doTermo.tipo
  if (!tipo) {
    const contagem = new Map()
    for (const { leitura } of lidos) if (leitura.tipo && !leitura.acessorio) contagem.set(leitura.tipo, (contagem.get(leitura.tipo) ?? 0) + 1)
    const [maisVisto, vezes] = [...contagem].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
    if (vezes >= 2) tipo = maisVisto
  }

  if (!tipo) {
    const porCategoria = new Map()
    for (const { anuncio } of lidos) porCategoria.set(anuncio.categoria_id, (porCategoria.get(anuncio.categoria_id) ?? 0) + 1)
    const [categoria] = [...porCategoria].sort((a, b) => b[1] - a[1])[0] ?? [null]
    return {
      tipo: null,
      parecidos: lidos.filter(({ anuncio }) => anuncio.categoria_id === categoria).map(({ anuncio, leitura }) => ({ ...anuncio, leitura })),
      fora: lidos.filter(({ anuncio }) => anuncio.categoria_id !== categoria).map(({ anuncio }) => ({ id: anuncio.id, titulo: anuncio.titulo, motivo: MOTIVO_DE_FORA.outro })),
    }
  }

  // a variação do termo ("bicicleta infantil") ou a que mais aparece entre os anúncios do tipo
  let variante = doTermo.tipo === tipo ? doTermo.variante : null
  if (!variante) {
    const contagem = new Map()
    for (const { leitura } of lidos) if (leitura.tipo === tipo && !leitura.acessorio) contagem.set(leitura.variante?.id ?? null, (contagem.get(leitura.variante?.id ?? null) ?? 0) + 1)
    const [id] = [...contagem].sort((a, b) => b[1] - a[1] || (a[0] === null ? -1 : 1))[0] ?? [null]
    variante = tipo.variantes.find((v) => v.id === id) ?? null
  }

  const parecidos = []
  const fora = []
  for (const { anuncio, leitura } of lidos) {
    if (leitura.tipo === tipo && !leitura.acessorio && (leitura.variante?.id ?? null) === (variante?.id ?? null)) {
      parecidos.push({ ...anuncio, leitura })
    } else {
      const motivo = leitura.tipo === tipo && leitura.acessorio ? MOTIVO_DE_FORA.acessorio
        : leitura.tipo === tipo ? MOTIVO_DE_FORA.variante(leitura.variante?.nome ?? `sem ser ${variante?.nome ?? ''}`.trim())
          : MOTIVO_DE_FORA.outro
      fora.push({ id: anuncio.id, titulo: anuncio.titulo, motivo })
    }
  }
  return { tipo: { nome: tipo.nome, plural: tipo.plural, genero: tipo.genero, variante: variante?.nome ?? null }, parecidos, fora }
}

// ---------------------------------------------------------------- lista de compras

const SEM_SENTIDO = new Set(['um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 'para', 'pra', 'pro', 'quero', 'procuro', 'preciso',
  'comprar', 'compro', 'com', 'bom', 'boa', 'barato', 'barata', 'o', 'a', 'os', 'as', 'e', 'em', 'no', 'na', 'algum', 'alguma', 'que', 'r',
  'por', 'ate', 'reais', 'real', 'mil'])

/**
 * O que a pessoa quer, a partir do que ela escreveu: "Celular usado até R$ 800" vira tipo celular,
 * estado usado e no máximo R$ 800. Os chips mostram o que a IA entendeu.
 */
export function entenderItem(texto) {
  const original = String(texto ?? '').normalize('NFC').trim()
  let norm = normalizar(original)

  let precoMax = null
  const achouPreco = norm.match(/(?:\bate\b|\bmaximo\b|\bmenos de\b|\babaixo de\b|r\s*\$)\s*(?:r\s*\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(mil|k|reais)?/)
    ?? norm.match(/\b(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(mil|k|reais)\b/)
  if (achouPreco) {
    let valor = Number(achouPreco[1].replace(/\./g, '')) + Number(`0.${achouPreco[2] ?? 0}`)
    if (achouPreco[3] === 'mil' || achouPreco[3] === 'k') valor *= 1000
    if (valor > 0) precoMax = Math.round(valor * 100) / 100
    norm = norm.slice(0, achouPreco.index) + ' '.repeat(achouPreco[0].length) + norm.slice(achouPreco.index + achouPreco[0].length)
  }

  let condicao = null
  const achouEstado = norm.match(/\bsemi\s*-?\s*nov[oa]s?\b|\bnov[oa]s?\b|\busad[oa]s?\b/)
  if (achouEstado) {
    condicao = /semi/.test(achouEstado[0]) ? 'seminovo' : /nov/.test(achouEstado[0]) ? 'novo' : 'usado'
    norm = norm.slice(0, achouEstado.index) + ' '.repeat(achouEstado[0].length) + norm.slice(achouEstado.index + achouEstado[0].length)
  }

  const termos = norm.split(/[^a-z0-9]+/).filter((p) => p && !SEM_SENTIDO.has(p) && !/^\d+$/.test(p)).map(singular)
  const { tipo, variante } = descobrirTipo(original)

  // o nome do item como a pessoa escreveu, sem o preço e o estado ("Mesa de escritório")
  const limpo = original.split('').filter((_, i) => norm[i] !== ' ' || original[i] === ' ').join('')
  const nome = (tipo ? tipo.nome : limpo.replace(/\b(?:at[eé]|r\$)\s*$/i, '').replace(/\s+/g, ' ').trim()) || original

  const entendi = [nome.charAt(0).toUpperCase() + nome.slice(1)]
  if (variante) entendi.push(variante.nome.charAt(0).toUpperCase() + variante.nome.slice(1))
  if (condicao) entendi.push({ novo: 'Novo', seminovo: 'Seminovo', usado: 'Usado' }[condicao])
  if (precoMax) entendi.push(`Até R$ ${Number(precoMax).toLocaleString('pt-BR', { minimumFractionDigits: precoMax % 1 ? 2 : 0, maximumFractionDigits: 2 })}`)

  return { tipo, variante, condicao, precoMax, termos, entendi }
}

// estado aceito: quem quer usado aceita seminovo; quem quer seminovo aceita novo
const ESTADOS_ACEITOS = { usado: ['usado', 'seminovo'], seminovo: ['seminovo', 'novo'], novo: ['novo'] }

/** termos de busca no banco para achar os candidatos de um item (depois a IA confere um por um) */
export function termosDeBusca(item) {
  if (item.tipo) return item.tipo.termos
  return item.termos.length ? [item.termos[0]] : []
}

/** o anúncio serve para o item da lista? (tipo, variação, estado e preço máximo) */
export function combinaComItem(item, anuncio, leitura = lerAnuncio(anuncio)) {
  if (item.precoMax && Number(anuncio.preco) > item.precoMax) return false
  if (item.condicao && anuncio.condicao && !ESTADOS_ACEITOS[item.condicao].includes(anuncio.condicao)) return false
  if (item.tipo) {
    if (leitura.tipo !== item.tipo || leitura.acessorio) return false
    if (item.variante) return leitura.variante?.id === item.variante.id
    return !leitura.variante?.especial
  }
  if (!item.termos.length) return false
  const texto = ` ${palavras(`${anuncio.titulo} ${anuncio.descricao ?? ''}`).join(' ')} `
  return item.termos.every((termo) => texto.includes(` ${termo}`))
}
