// Moderação de texto do DesapegaUai: regras próprias, em português, sem serviço pago e sem mandar o
// texto para fora. Recusa o que não pode na plataforma:
//   armas   armas de fogo, munição, pólvora, explosivos e simulacros (airsoft e arma de pressão podem)
//   drogas  drogas ilícitas, anabolizantes e remédios controlados
//   sexual  pornografia e conteúdo sexual (biquíni, lingerie e "batom nude" podem)
//   ameaca  ameaça ou violência contra alguém
// Feita para não confundir: "pistola de cola quente", "revolver a terra", "bala de goma", "matar a
// saudade", "vou te pegar no ponto" e "baseado em fatos reais" passam. Aguenta as tentativas comuns de
// esconder a palavra: acento, maiúscula, letra repetida ("maconhaaa"), número no lugar de letra
// ("m4c0nh4") e letra separada ("m a c o n h a").
// O texto da pessoa nunca vai para o log: só a categoria e onde foi.
import { erroHttp } from '../utils/erroHttp.js'
import { registrar } from '../utils/log.js'

export const MENSAGENS = {
  armas: 'Não é permitido anunciar ou negociar armas de fogo, munição, explosivos ou simulacros no DesapegaUai.',
  drogas: 'Não é permitido anunciar ou negociar drogas, anabolizantes ou remédios controlados no DesapegaUai.',
  sexual: 'Conteúdo sexual ou pornográfico não é permitido no DesapegaUai.',
  ameaca: 'Ameaça ou violência contra alguém não é permitida no DesapegaUai. Se alguém ameaçou você, use Denunciar.',
}

// o que vale em cada lugar (na avaliação, por exemplo, a pessoa pode contar que o vendedor ofereceu algo proibido)
export const REGRAS_POR_LUGAR = {
  anuncio: ['armas', 'drogas', 'sexual', 'ameaca'],
  procura: ['armas', 'drogas', 'sexual', 'ameaca'],
  lista: ['armas', 'drogas', 'sexual'],
  chat: ['armas', 'drogas', 'sexual', 'ameaca'],
  perfil: ['armas', 'drogas', 'sexual', 'ameaca'],
  avaliacao: ['sexual', 'ameaca'],
}

// nome do campo como a pessoa vê, para a mensagem dizer o que revisar
const NOME_DO_CAMPO = {
  titulo: 'o título', descricao: 'a descrição', localizacao: 'o ponto de encontro', texto: 'o texto',
  nome: 'o nome', bio: 'a bio', comentario: 'o comentário', legenda: 'a legenda',
}

// ---------------------------------------------------------------- normalização

const LETRA_NO_LUGAR = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' }
// letras de outros alfabetos que parecem as nossas ("mаconha" com o "а" russo)
const PARECIDAS = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', к: 'k', м: 'm', т: 't', н: 'h', в: 'b', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ɡ: 'g', ո: 'n',
  α: 'a', ε: 'e', ο: 'o', ι: 'i', κ: 'k', ν: 'v', ρ: 'p', τ: 't', υ: 'u', χ: 'x', ϲ: 'c',
}
const LETRA_PARECIDA = new RegExp(`[${Object.keys(PARECIDAS).join('')}]`, 'g')
// caracteres invisíveis que dá para enfiar no meio da palavra ("mac​onha")
const INVISIVEIS = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]/g

/** Texto comparável: sem acento, minúsculo, com as tentativas comuns de disfarce desfeitas. */
export function normalizarTexto(texto) {
  let t = String(texto ?? '')
    .normalize('NFKC') // letra larga (ｍａｃｏｎｈａ), em negrito matemático (𝐦𝐚𝐜𝐨𝐧𝐡𝐚) e ligaduras viram letra comum
    .replace(INVISIVEIS, '')
    .toLowerCase()
    .replace(LETRA_PARECIDA, (letra) => PARECIDAS[letra])
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
  // palavra que começa com letra e mistura número ou símbolo ("m4c0nh4", "p0rn0"): vira letra
  t = t.replace(/[a-z][a-z0-9@$]*/g, (palavra) => (/[0-9@$]/.test(palavra)
    ? palavra.replace(/[0134578@$]/g, (c) => LETRA_NO_LUGAR[c] ?? c)
    : palavra))
  // letra repetida 3 vezes ou mais ("maconhaaa") vira uma
  t = t.replace(/([a-z])\1{2,}/g, '$1')
  // 4 ou mais letras sozinhas em sequência ("m a c o n h a", "m.a.c.o.n.h.a") viram uma palavra
  t = t.replace(/\b(?:[a-z][\s.\-_*|/\\•,]+){3,}[a-z]\b/g, (trecho) => trecho.replace(/[^a-z]/g, ''))
  return t.replace(/\s+/g, ' ')
}

// ---------------------------------------------------------------- regras

const VOCE = '(?:voce|vc|vce|ce|tu|ti)'
const ALVO = `(?:${VOCE}|sua familia|tua familia|seus filhos|teus filhos|sua mae|tua mae|sua filha|tua filha|seu filho|teu filho|sua mulher|tua mulher|seu marido|teu marido|seu pai|teu pai)`
// "você vai morrer de rir", "te mato de saudade": não é ameaça
const SEM_DE_BRINCADEIRA = '(?! de (?:rir|saudade|vergonha|curiosidade|inveja|fome|sede|tedio|calor|frio|susto|trabalhar|estudar|cansaco|ciumes|amor|alegria|felicidade|tanto|chorar))'
// armas de pressão, airsoft, paintball e brinquedo: podem (são legais); o simulacro de arma de fogo não
const PRESSAO_OU_BRINQUEDO = /\b(?:pressao|chumbinho|airsoft|paintball|brinquedo|nerf|gel|espuma|agua|orbeez)\b/
// "pistola" de ferramenta: cola quente, pintura, solda, ar quente, massagem...
const PISTOLA_DE_FERRAMENTA = /\b(?:cola|pintura|pintar|solda|soldar|silicone|calor|ar quente|soprador|espuma|lavar|lavagem|jardim|mangueira|agua|massagem|massageadora|graxa|grampeador|grampos?|pregos?|rebites?|tinta|verniz|ar comprimido|compressor|airsoft|paintball|pressao|chumbinho|brinquedo|nerf|gel|bolhas?|termometro|infravermelho|cimento|rejunte|calafetar|vedacao|limpeza|vapor|areia|jateamento|pulverizador|pulverizacao|aerografo|esmalte|cera|polimento|ozonio|espuma)\b/
// (o "cal." e o ".40" ficam fora do \b: depois do ponto não existe fronteira de palavra)
const CONTEXTO_DE_PISTOLA = /\b(?:9 ?mm|380|calibre|taurus|glock|imbel|beretta|bersa|sig ?sauer|smith|wesson|municao|municoes|de fogo|semi ?automatica|coldre|cbc)\b|\bcal\.|\.(?:380|40|45|22)\b/
const CONTEXTO_DE_REVOLVER = /\b(?:calibre|municao|municoes|taurus|rossi|smith|wesson|coldre|arma|armas|pistola|espingarda|polvora|cartuchos?|spl|magnum|357)\b|\bcal\.|\.(?:38|32|22|357|44)\b/
const REVOLVER_QUE_PODE = /\bbeatles\b|\b(?:pressao|chumbinho|airsoft|paintball|brinquedo|nerf|gel|espuma|agua|espoleta)\b/

/**
 * Cada regra: { categoria, padrao } no texto normalizado, com
 *   exceto: se o texto todo casar, a regra não vale;
 *   tambem: o texto todo precisa casar também (contexto);
 *   original: a regra olha o texto só em minúsculas, com acento (o "revólver" com acento é a arma).
 */
const REGRAS = [
  // ------------------------------------------------ armas
  { categoria: 'armas', padrao: /\barmas? de fogo\b/ },
  { categoria: 'armas', padrao: /\b(?:fuzil|fuzis|metralhadoras?|submetralhadoras?|escopetas?|garruchas?)\b/ },
  { categoria: 'armas', padrao: /\b(?:espingardas?|carabinas?|rifles?)\b/, exceto: PRESSAO_OU_BRINQUEDO },
  { categoria: 'armas', padrao: /\bmunic(?:ao|oes)\b/, exceto: PRESSAO_OU_BRINQUEDO },
  { categoria: 'armas', padrao: /\bcartuchos? (?:de |da )?(?:calibre |cal\. ?|cbc\b)/ },
  { categoria: 'armas', padrao: /\bprojet(?:il|eis)\b/ },
  { categoria: 'armas', padrao: /\bpolvora\b/ },
  { categoria: 'armas', padrao: /\b(?:explosivos?|dinamites?|bombas? caseiras?)\b/ },
  { categoria: 'armas', padrao: /\bsimulacros?\b/ },
  { categoria: 'armas', padrao: /\breplicas? (?:de |da |do )?(?:arma|armas|pistolas?|revolver|revolveres|fuzil|fuzis|metralhadoras?|espingardas?|glock|ak ?47|ar ?15|m16)\b/, exceto: /\b(?:airsoft|paintball|gel|nerf|agua|espuma)\b/ },
  { categoria: 'armas', padrao: /\bcalibres? (?:de )?\.?(?:12|16|20|22|24|28|32|36|38|40|44|45|357|380|9 ?mm|5[.,]56|7[.,]62|308)\b/ },
  { categoria: 'armas', padrao: /\bcal\. ?\.?(?:12|16|20|22|24|28|32|36|38|40|44|45|357|380)\b/ },
  { categoria: 'armas', padrao: /(?:\.|\b)(?:38 ?spl|38 special|380 ?acp|40 ?s ?& ?w|22 ?lr|357 ?magnum|44 ?magnum)\b|\b9 ?mm parabellum\b/ },
  { categoria: 'armas', padrao: /\bpistolas?\b/, tambem: CONTEXTO_DE_PISTOLA, exceto: PISTOLA_DE_FERRAMENTA },
  { categoria: 'armas', padrao: /revólver/, original: true, exceto: REVOLVER_QUE_PODE },
  { categoria: 'armas', padrao: /\brevolver(?:es)?\b/, tambem: CONTEXTO_DE_REVOLVER, exceto: REVOLVER_QUE_PODE },

  // ------------------------------------------------ drogas
  { categoria: 'drogas', padrao: /\b(?:maconhas?|cannabis|haxixe|skunk|cocaina|crack|lsd|ecstasy|ecstasi|mdma|metanfetamina|cetamina|ketamina|psilocibina|lanca[ -]?perfumes?)\b/ },
  { categoria: 'drogas', padrao: /\bcogumelos? (?:magicos?|alucinogenos?)\b|\bcha de cogumelo\b/ },
  { categoria: 'drogas', padrao: /\b(?:anabolizantes?|esteroides? anabolizantes?|durateston|deca[ -]?durabolin|oxandrolona|stanozolol|winstrol|trembolona|boldenona|clembuterol|hemogenin|dianabol|nandrolona|testosterona injetavel)\b/ },
  { categoria: 'drogas', padrao: /\b(?:rivotril|clonazepam|ritalina|metilfenidato|venvanse|lisdexanfetamina|sibutramina|zolpidem|diazepam|alprazolam|lorazepam|tramadol|codeina|oxicodona|tarja preta)\b/ },

  // ------------------------------------------------ sexual
  { categoria: 'sexual', padrao: /\bporn(?:o|os|ografia|ografias|ografico|ografica|ograficos|ograficas)\b/ },
  { categoria: 'sexual', padrao: /\b(?:xvideos|xhamster|pornhub|redtube|brazzers|onlyfans|only fans)\b/ },
  { categoria: 'sexual', padrao: /\bconteudos? (?:adultos?|\+ ?18|18 ?\+|eroticos?|sexuais|sexual|hot|explicitos?)(?![a-z])/ },
  { categoria: 'sexual', padrao: /\bsexo (?:explicito|oral|anal|virtual|pago|a tres|ao vivo)\b/ },
  { categoria: 'sexual', padrao: /\b(?:videos?|fotos?|filmes?) (?:de |com )?sexo\b/ },
  { categoria: 'sexual', padrao: /\b(?:fotos?|videos?) (?:intimas?|intimos?|nuas?|nus|peladas?|pelados?|hot|safadas?|proibidas?)\b/ },
  { categoria: 'sexual', padrao: /\b(?:mand[ao]|mande|mandar|vend[oe]|vendem|vender|venda|troc[oa]|trocar|pack|packs|tenho|tem|quer|quero|compro|comprar)(?: (?:de|meus?|minhas?|uns|umas|seus?|suas?))? nudes\b/ },
  { categoria: 'sexual', padrao: /\bpacks? (?:do|de|dos) (?:pe|pes|pezinho|pezinhos)\b/ },
  { categoria: 'sexual', padrao: /\b(?:garotas?|garotos?|meninas?|mocas?) de programa\b|\bfaco programa\b(?! (?:de|em|para|pra|no|na|com|do|da)\b)/ },
  { categoria: 'sexual', padrao: /\bacompanhantes? (?:de luxo|vip|sensual|liberal|completa|completo)\b/ },
  { categoria: 'sexual', padrao: /\b(?:chamadas?|ligacao|ligacoes|video ?chamadas?) (?:de video )?(?:hot|quente|intima|sensual|safada|picante)\b/ },
  { categoria: 'sexual', padrao: /\b(?:putaria|punhetas?|siririca|boquetes?|surubas?|surubao)\b/ },

  // ------------------------------------------------ ameaça e violência
  // (sem "furar" e "executar": "vou te furar a orelha" é piercing e "te executar o serviço" é trabalho)
  { categoria: 'ameaca', padrao: new RegExp(`\\bte (?:matar|mato|esfaquear|esfaqueio|estuprar|estupro|espancar|espanco|arrebentar|arrebento|enforcar|enforco|degolar|degolo)\\b${SEM_DE_BRINCADEIRA}`) },
  { categoria: 'ameaca', padrao: new RegExp(`\\b(?:matar|mato|esfaquear|esfaqueio|espancar|espanco|estuprar|arrebentar|arrebento|degolar|enforcar) (?:o |a )?${ALVO}\\b${SEM_DE_BRINCADEIRA}`) },
  { categoria: 'ameaca', padrao: /\bte (?:dar|dou|meter|meto|enfiar|enfio|acertar|acerto) (?:um |uns |dois |tres |varios |umas |uma )?(?:tiros?|balas?|chumbo|facadas?|porradas?)\b/ },
  { categoria: 'ameaca', padrao: new RegExp(`\\b(?:tiros?|balas?|chumbo|facadas?) (?:em|no|na|na sua|na tua) (?:${VOCE}|sua cara|tua cara|sua cabeca|tua cabeca|sua testa|tua testa)\\b`) },
  { categoria: 'ameaca', padrao: /\bte (?:encher|encho|enchendo) de (?:balas?|tiros?|chumbo|porradas?|facadas?|pancadas?)\b/ },
  { categoria: 'ameaca', padrao: /\b(?:vou|vo|vamos|eu vou|irei|vai) te (?:bater|socar|surrar|espancar)\b(?! (?:um|uma|uns|umas|o|os|a|as|no|na)\b)/ },
  { categoria: 'ameaca', padrao: /\bquebrar (?:a |toda a )?(?:sua|tua) cara\b|\bte (?:quebrar|quebro) (?:a cara|todo|toda|inteiro|inteira|na porrada|no pau)\b/ },
  // (só com "você": "o time vai levar uma surra" é conversa de futebol)
  { categoria: 'ameaca', padrao: new RegExp(`\\b${VOCE} (?:vai|vais|ira) (?:levar|tomar|apanhar) (?:uma |um )?(?:porrada|surra|pancada|tiro|facada)\\b`) },
  { categoria: 'ameaca', padrao: new RegExp(`\\b${VOCE} (?:vai|vais|ira) morrer\\b${SEM_DE_BRINCADEIRA}`) },
  { categoria: 'ameaca', padrao: new RegExp(`\\b(?:vou|vamos|eu vou) acabar com (?:a )?(?:${VOCE}|sua vida|tua vida|sua raca|tua raca|sua familia|tua familia)\\b`) },
  { categoria: 'ameaca', padrao: new RegExp(`\\bvai se matar\\b${SEM_DE_BRINCADEIRA}`) },
  { categoria: 'ameaca', padrao: /\bvou te cacar\b/ },
  { categoria: 'ameaca', padrao: /\b(?:vou|vamos) (?:queimar|incendiar|tacar fogo n[ao]|botar fogo n[ao]|por fogo n[ao]) (?:sua|tua) (?:casa|familia)\b/ },
]

/**
 * Confere um texto. Devolve null (pode) ou a categoria do que não pode ('armas', 'drogas', 'sexual', 'ameaca').
 * onde: 'anuncio', 'procura', 'lista', 'chat', 'perfil' ou 'avaliacao' (cada lugar tem as suas regras).
 */
export function categoriaProibida(texto, onde = 'anuncio') {
  if (texto === null || texto === undefined || texto === '') return null
  const valem = REGRAS_POR_LUGAR[onde] ?? REGRAS_POR_LUGAR.anuncio
  const normal = normalizarTexto(texto)
  const original = String(texto).normalize('NFC').replace(INVISIVEIS, '').toLowerCase()
  for (const regra of REGRAS) {
    if (!valem.includes(regra.categoria)) continue
    if (!regra.padrao.test(regra.original ? original : normal)) continue
    if (regra.tambem && !regra.tambem.test(normal)) continue
    if (regra.exceto && regra.exceto.test(normal)) continue
    return regra.categoria
  }
  return null
}

/**
 * Recusa (422, CONTEUDO_PROIBIDO) se algum dos campos tiver o que não pode.
 * campos: { titulo: '...', descricao: '...' } (vazio e null passam).
 */
export function exigirTextoPermitido(campos, { onde = 'anuncio', usuarioId = null } = {}) {
  for (const [campo, texto] of Object.entries(campos)) {
    const categoria = categoriaProibida(texto, onde)
    if (!categoria) continue
    registrar('moderacao.texto_recusado', { onde, campo, categoria, usuario_id: usuarioId })
    const revisar = NOME_DO_CAMPO[campo] ? ` Revise ${NOME_DO_CAMPO[campo]}.` : ''
    const erro = erroHttp(422, `${MENSAGENS[categoria]}${revisar}`)
    erro.codigo = 'CONTEUDO_PROIBIDO'
    erro.campos = [campo]
    throw erro
  }
}
