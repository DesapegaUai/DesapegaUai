// Google e prévia de link. O site é um React que monta a tela no navegador; o Google até lê isso, mas o
// WhatsApp, o Facebook e o X não. Por isso a API já entrega cada página com o título, a descrição e a foto
// certos (o anúncio chega como "Sofá 3 lugares por R$ 780,00 em Centro, Viçosa", com a foto), além do
// robots.txt (o que o Google pode ler), do sitemap.xml (a lista de páginas e anúncios) e da imagem de
// prévia de cada anúncio em JPG (o formato que todo aplicativo mostra).
import fs from 'node:fs/promises'
import express from 'express'
import sharp from 'sharp'
import { db } from './config/db.js'
import { env } from './config/env.js'
import { caminhoDaFoto } from './utils/fotos.js'

const NOME = 'DesapegaUai'
const DESCRICAO_PADRAO = 'Compre e venda usados com gente do seu bairro, em Viçosa e região da Zona da Mata mineira. Anúncio grátis, chat com o vendedor e busca por distância.'
const IMAGEM_PADRAO = '/img/compartilhar.jpg'
const PAGINAS_DE_AJUDA = {
  'como-funciona': 'Como funciona',
  'regras-para-anunciar': 'Regras para anunciar',
  'perguntas-frequentes': 'Perguntas frequentes',
  'dicas-de-seguranca': 'Dicas de segurança',
  'sobre-nos': 'Sobre nós',
  'fale-conosco': 'Fale conosco',
  'termos-de-uso': 'Termos de uso',
  'politica-de-privacidade': 'Política de privacidade',
}
// telas da conta e páginas que não fazem sentido no Google (o perfil das pessoas fica de fora por privacidade)
const FORA_DO_GOOGLE = /^\/(entrar|perfil|conversas|favoritos|meus-anuncios|anunciar|anuncios\/|usuario\/|busca)/
const VISIVEIS = ['ativo', 'reservado', 'vendido']

const escapar = (texto) => String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const reais = (valor) => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const resumir = (texto, maximo) => {
  const limpo = String(texto ?? '').replace(/\s+/g, ' ').trim()
  return limpo.length > maximo ? `${limpo.slice(0, maximo - 1).trimEnd()}…` : limpo
}

// ---------------------------------------------------------------- dados de cada página

async function dadosDoAnuncio(id) {
  const [[anuncio]] = await db.query(
    `SELECT a.id, a.titulo, a.descricao, a.preco, a.status, a.condicao, b.nome AS bairro, c.nome AS cidade,
            (SELECT f.arquivo FROM foto_anuncio f WHERE f.anuncio_id = a.id ORDER BY f.ordem, f.id LIMIT 1) AS foto
       FROM anuncio a
       LEFT JOIN bairro b ON b.id = a.bairro_id
       LEFT JOIN cidade c ON c.id = b.cidade_id
      WHERE a.id = ? AND a.status IN (?)`,
    [id, VISIVEIS],
  )
  return anuncio ?? null
}

// título, descrição, imagem e o resto de cada página; base = endereço do site (https://desapegauai.com.br)
export async function metasDaPagina(caminho, base = env.frontendUrl) {
  const padrao = { titulo: `${NOME}: compre e venda usados em Viçosa e região`, descricao: DESCRICAO_PADRAO, imagem: `${base}${IMAGEM_PADRAO}`, tipo: 'website' }
  if (FORA_DO_GOOGLE.test(caminho)) return { ...padrao, foraDoGoogle: true }
  if (caminho === '/') return padrao

  let m = caminho.match(/^\/anuncio\/(\d+)\/?$/)
  if (m) {
    const anuncio = await dadosDoAnuncio(Number(m[1]))
    if (!anuncio) return { ...padrao, foraDoGoogle: true }
    const lugar = [anuncio.bairro, anuncio.cidade].filter(Boolean).join(', ')
    const vendido = anuncio.status === 'vendido'
    const titulo = `${anuncio.titulo} por ${reais(anuncio.preco)}${lugar ? ` em ${lugar}` : ''}${vendido ? ' (vendido)' : ''}`
    const descricao = resumir(anuncio.descricao || `${anuncio.titulo} à venda${lugar ? ` em ${lugar}` : ''}. Converse com quem vende pelo chat do ${NOME}.`, 160)
    const imagem = anuncio.foto ? `${base}/compartilhar/anuncio/${anuncio.id}.jpg` : padrao.imagem
    const condicao = { novo: 'https://schema.org/NewCondition', seminovo: 'https://schema.org/UsedCondition', usado: 'https://schema.org/UsedCondition' }[anuncio.condicao]
    // o Google entende o anúncio como produto e pode mostrar o preço no resultado da busca
    const produto = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: anuncio.titulo,
      description: descricao,
      ...(anuncio.foto ? { image: imagem } : {}),
      offers: {
        '@type': 'Offer',
        price: Number(anuncio.preco).toFixed(2),
        priceCurrency: 'BRL',
        availability: vendido ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        ...(condicao ? { itemCondition: condicao } : {}),
        url: `${base}/anuncio/${anuncio.id}`,
      },
    }
    return { titulo: `${titulo} | ${NOME}`, tituloDaPrevia: titulo, descricao, imagem, tipo: 'product', produto }
  }

  m = caminho.match(/^\/categoria\/([a-z-]+)\/?$/)
  if (m) {
    const [[categoria]] = await db.query('SELECT nome FROM categoria WHERE slug = ?', [m[1]])
    if (!categoria) return { ...padrao, foraDoGoogle: true }
    return {
      ...padrao,
      titulo: `${categoria.nome}: usados em Viçosa e região | ${NOME}`,
      descricao: `Anúncios de ${categoria.nome.toLowerCase()} perto de você, em Viçosa e na Zona da Mata mineira, com a distância de cada um. Anuncie grátis no ${NOME}.`,
    }
  }

  m = caminho.match(/^\/ajuda\/([a-z-]+)\/?$/)
  if (m && PAGINAS_DE_AJUDA[m[1]]) return { ...padrao, titulo: `${PAGINAS_DE_AJUDA[m[1]]} | ${NOME}` }
  if (/^\/procura-se\/?$/.test(caminho)) {
    return { ...padrao, titulo: `Procura-se: pedidos de quem quer comprar em Viçosa e região | ${NOME}`, descricao: 'Veja o que as pessoas de Viçosa e região estão procurando e avise quando tiver para vender.' }
  }
  if (/^\/mapa\/?$/.test(caminho)) return { ...padrao, titulo: `Mapa de anúncios em Viçosa e região | ${NOME}` }
  return { ...padrao, foraDoGoogle: true } // página que não existe
}

// põe as informações da página no index.html, no lugar do título e da descrição que vêm do build
export function aplicarMetas(html, m, caminho, base = env.frontendUrl) {
  const endereco = `${base}${caminho === '/' ? '/' : caminho.replace(/\/$/, '')}`
  const tituloDaPrevia = m.tituloDaPrevia ?? m.titulo
  const extras = [
    m.foraDoGoogle ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${escapar(endereco)}" />`,
    `<meta property="og:site_name" content="${NOME}" />`,
    '<meta property="og:locale" content="pt_BR" />',
    `<meta property="og:type" content="${m.tipo}" />`,
    `<meta property="og:title" content="${escapar(tituloDaPrevia)}" />`,
    `<meta property="og:description" content="${escapar(m.descricao)}" />`,
    `<meta property="og:url" content="${escapar(endereco)}" />`,
    `<meta property="og:image" content="${escapar(m.imagem)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    // dado para o Google (não é código que roda): o "<" vira \u003c para nada fechar a tag antes da hora
    m.produto ? `<script type="application/ld+json">${JSON.stringify(m.produto).replace(/</g, '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n    ')
  return html
    .replace(/<title>[^<]*<\/title>/, () => `<title>${escapar(m.titulo)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, () => `<meta name="description" content="${escapar(m.descricao)}" />`)
    .replace('</head>', () => `    ${extras}\n  </head>`)
}

// ---------------------------------------------------------------- robots.txt, sitemap.xml e imagem de prévia

export function rotasDoGoogle({ base = env.frontendUrl } = {}) {
  const rotas = express.Router()

  rotas.get('/robots.txt', (req, res) => {
    res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send([
      'User-agent: *',
      'Allow: /',
      'Allow: /api/uploads/anuncios/', // as fotos dos anúncios podem aparecer no Google Imagens
      'Disallow: /api/',
      'Disallow: /entrar',
      'Disallow: /perfil',
      'Disallow: /conversas',
      'Disallow: /favoritos',
      'Disallow: /meus-anuncios',
      'Disallow: /anunciar',
      'Disallow: /anuncios/',
      'Disallow: /busca',
      '',
      `Sitemap: ${base}/sitemap.xml`,
      '',
    ].join('\n'))
  })

  rotas.get('/sitemap.xml', async (req, res, next) => {
    try {
      const [categorias] = await db.query('SELECT slug FROM categoria ORDER BY ordem, id')
      const [anuncios] = await db.query(
        "SELECT id, COALESCE(atualizado_em, data_publicacao, criado_em) AS mudou FROM anuncio WHERE status IN ('ativo', 'reservado') ORDER BY id DESC LIMIT 5000",
      )
      const enderecos = [
        { caminho: '/', prioridade: '1.0' },
        ...categorias.map((c) => ({ caminho: `/categoria/${c.slug}`, prioridade: '0.8' })),
        { caminho: '/procura-se', prioridade: '0.6' },
        { caminho: '/mapa', prioridade: '0.5' },
        ...Object.keys(PAGINAS_DE_AJUDA).map((slug) => ({ caminho: `/ajuda/${slug}`, prioridade: '0.3' })),
        ...anuncios.map((a) => ({ caminho: `/anuncio/${a.id}`, prioridade: '0.7', mudou: a.mudou })),
      ]
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...enderecos.map((e) => `  <url><loc>${escapar(base + e.caminho)}</loc>${e.mudou ? `<lastmod>${new Date(e.mudou).toISOString()}</lastmod>` : ''}<priority>${e.prioridade}</priority></url>`),
        '</urlset>',
        '',
      ].join('\n')
      res.type('application/xml').set('Cache-Control', 'public, max-age=600').send(xml)
    } catch (erro) {
      next(erro)
    }
  })

  // a foto de capa do anúncio em JPG 1200 x 630, o tamanho que o WhatsApp, o Facebook e o X mostram na prévia
  rotas.get('/compartilhar/anuncio/:id.jpg', async (req, res, next) => {
    try {
      const id = Number(req.params.id)
      const anuncio = Number.isInteger(id) && id > 0 ? await dadosDoAnuncio(id) : null
      if (!anuncio?.foto) return res.redirect(302, IMAGEM_PADRAO)
      const original = await fs.readFile(caminhoDaFoto(anuncio.id, anuncio.foto, 800))
      const imagem = await sharp(original).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer()
      res.type('image/jpeg').set('Cache-Control', 'public, max-age=86400').send(imagem)
    } catch (erro) {
      if (erro.code === 'ENOENT') return res.redirect(302, IMAGEM_PADRAO)
      next(erro)
    }
  })

  return rotas
}
