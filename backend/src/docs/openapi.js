// Documentação OpenAPI 3.0 da API do DesapegaUai. Veja em http://localhost:3333/api/docs
import { RAIOS } from '../utils/geo.js'

const erro = (descricao, exemplo = { erro: 'Mensagem em português.', codigo: 'DADOS_INVALIDOS', status: 400 }) => ({
  description: descricao,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' }, example: exemplo } },
})
const ok = (descricao, schema) => ({ description: descricao, content: { 'application/json': { schema } } })
const ref = (nome) => ({ $ref: `#/components/schemas/${nome}` })
const corpo = (schema, exemplo) => ({ required: true, content: { 'application/json': { schema, ...(exemplo ? { example: exemplo } : {}) } } })
const query = (name, schema, description, required = false) => ({ in: 'query', name, schema, description, required })
const caminho = (name, description) => ({ in: 'path', name, required: true, schema: { type: 'integer', minimum: 1 }, description })
const login = [{ cookieLogin: [] }]

const E400 = erro('Dados inválidos (campos em "campos")')
const E401 = erro('Sem login', { erro: 'Faça login para continuar.', codigo: 'NAO_AUTENTICADO', status: 401 })
const E403 = erro('Sem permissão', { erro: 'Só o dono pode alterar a localização deste anúncio.', codigo: 'SEM_PERMISSAO', status: 403 })
const E404 = erro('Não encontrado', { erro: 'Anúncio não encontrado.', codigo: 'ANUNCIO_NAO_ENCONTRADO', status: 404 })
const E422 = erro('Fora da Zona da Mata mineira', { erro: 'Essa localização fica fora da Zona da Mata mineira.', codigo: 'FORA_DA_AREA', status: 422 })
const E429 = erro('Muitas requisições', { erro: 'Muitas atualizações de localização em pouco tempo.', codigo: 'MUITAS_REQUISICOES', status: 429 })

const filtrosDaBusca = [
  query('busca', { type: 'string', maxLength: 100 }, 'Palavra-chave no título e na descrição'),
  query('categoria_id', { type: 'integer' }, 'Categoria'),
  query('subcategoria_id', { type: 'string', example: '1,2' }, 'Subcategorias, separadas por vírgula'),
  query('condicao', { type: 'string', example: 'novo,seminovo' }, 'novo, seminovo e/ou usado'),
  query('preco_min', { type: 'number' }, 'Preço mínimo'),
  query('preco_max', { type: 'number' }, 'Preço máximo'),
]

export const especificacao = {
  openapi: '3.0.3',
  info: {
    title: 'API do DesapegaUai',
    version: '1.0.0',
    description: [
      'Marketplace de usados da **Zona da Mata mineira** (142 municípios da mesorregião 3112 do IBGE).',
      '',
      '**Autenticação:** login com Google (`POST /api/auth/google`) grava o cookie httpOnly `token` (JWT de 7 dias).',
      '',
      '**Erros:** sempre `{ "erro": "mensagem", "codigo": "CODIGO", "status": 400, "campos": [...] }`.',
      '',
      '**Localização e LGPD:** a coordenada exata do comprador nunca é pública e expira em 30 dias sem atualização;',
      'a do anúncio é própria (não acompanha o vendedor) e, para os outros, só aparece o ponto aproximado',
      '(grade de ~250 m). Distâncias em **linha reta** (Haversine / `ST_Distance_Sphere`).',
    ].join('\n'),
  },
  servers: [{ url: '/', description: 'Esta API' }],
  tags: [
    { name: 'Localização', description: 'Localização do comprador e dos anúncios, busca por proximidade e mapa' },
    { name: 'Locais', description: 'Cidades, bairros, ruas e CEPs da Zona da Mata (IBGE, Censo 2022)' },
    { name: 'Anúncios' }, { name: 'Procura-se' }, { name: 'Notificações' }, { name: 'Conversas' }, { name: 'Avaliações' },
    { name: 'Favoritos' }, { name: 'Perfil e login' },
  ],
  components: {
    securitySchemes: { cookieLogin: { type: 'apiKey', in: 'cookie', name: 'token' } },
    schemas: {
      Erro: {
        type: 'object', required: ['erro', 'codigo', 'status'],
        properties: { erro: { type: 'string' }, codigo: { type: 'string' }, status: { type: 'integer' }, campos: { type: 'array', items: { type: 'string' } } },
      },
      Coordenadas: {
        type: 'object', required: ['latitude', 'longitude'],
        properties: { latitude: { type: 'number', minimum: -90, maximum: 90, example: -20.7547 }, longitude: { type: 'number', minimum: -180, maximum: 180, example: -42.8819 } },
      },
      Local: { type: 'object', properties: { id: { type: 'integer' }, nome: { type: 'string' } } },
      LocalizacaoDoUsuario: {
        type: 'object', nullable: true,
        properties: {
          latitude: { type: 'number' }, longitude: { type: 'number' },
          precisao_m: { type: 'number', nullable: true, description: 'precisão do GPS, em metros' },
          origem: { type: 'string', enum: ['gps', 'manual'] },
          capturada_em: { type: 'string', format: 'date-time' }, atualizada_em: { type: 'string', format: 'date-time' },
          expira_em: { type: 'string', format: 'date-time', description: 'retenção de 30 dias sem atualização' },
          desatualizada: { type: 'boolean', description: 'GPS com mais de 30 minutos: peça atualização (RN-LOC-012)' },
          idade_min: { type: 'integer' },
          cidade: ref('Local'), bairro: { allOf: [ref('Local')], nullable: true },
        },
      },
      RegistrarLocalizacao: {
        oneOf: [
          {
            type: 'object', title: 'GPS', required: ['latitude', 'longitude'],
            properties: {
              origem: { type: 'string', enum: ['gps'] }, latitude: { type: 'number' }, longitude: { type: 'number' },
              precisao_m: { type: 'number', minimum: 0, maximum: 100000 },
              capturada_em: { oneOf: [{ type: 'string', format: 'date-time' }, { type: 'integer', description: 'ms (timestamp do GPS)' }] },
            },
          },
          {
            type: 'object', title: 'Manual', required: ['origem'],
            properties: { origem: { type: 'string', enum: ['manual'] }, cidade_id: { type: 'integer' }, bairro_id: { type: 'integer' }, latitude: { type: 'number' }, longitude: { type: 'number' } },
          },
        ],
      },
      ResultadoLocalizacao: {
        type: 'object',
        properties: {
          localizacao: ref('LocalizacaoDoUsuario'),
          atualizada: { type: 'boolean', description: 'false quando a mudança foi menor que 50 m (nada gravado)' },
          criada: { type: 'boolean' }, motivo: { type: 'string' },
        },
      },
      Preferencias: {
        type: 'object',
        properties: {
          raio_km: { type: 'integer', minimum: 1, maximum: 300, example: 5 }, modo: { type: 'string', enum: ['gps', 'manual'] },
          compartilhar_localizacao: { type: 'boolean' }, cidade_manual: { allOf: [ref('Local')], nullable: true },
          bairro_manual: { allOf: [ref('Local')], nullable: true },
        },
      },
      CardComDistancia: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, titulo: { type: 'string' }, preco: { type: 'number' }, condicao: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['ativo', 'reservado'], description: 'reservado continua na busca' },
          transporte: { type: 'string', nullable: true, enum: ['mochila', 'carro', 'carreto'], description: 'como levar: cabe na mochila, em carro de aplicativo ou precisa de carreto' },
          bairro: { type: 'string' }, cidade: { type: 'string' }, uf: { type: 'string' },
          foto_capa: { type: 'object', nullable: true }, favoritado: { type: 'boolean' },
          distancia_km: { type: 'number', description: 'em linha reta, 100 m de resolução' },
          localizacao_aproximada: ref('Coordenadas'),
          localizacao_origem: { type: 'string', enum: ['gps', 'manual', 'bairro'] },
        },
      },
      ResultadoProximos: {
        type: 'object',
        properties: {
          origem: { type: 'object', description: 'de onde a distância foi medida (coordenadas, localizacao_atual, bairro ou cidade)' },
          raio_km: { type: 'integer' }, raios_sugeridos: { type: 'array', items: { type: 'object' } },
          ordenar: { type: 'string' }, pagina: { type: 'integer' }, por_pagina: { type: 'integer' },
          total: { type: 'integer' }, total_paginas: { type: 'integer' },
          mensagem: { type: 'string', nullable: true, description: 'quando não há anúncios no raio' },
          ampliar: { type: 'object', nullable: true, description: 'menor raio maior que tem anúncios: { raio_km, total }' },
          itens: { type: 'array', items: ref('CardComDistancia') },
        },
      },
      LocalizacaoDoAnuncio: {
        type: 'object',
        properties: {
          anuncio_id: { type: 'integer' }, eh_meu: { type: 'boolean' },
          localizacao: {
            type: 'object', nullable: true,
            properties: {
              aproximada: { type: 'boolean' }, latitude: { type: 'number' }, longitude: { type: 'number' },
              raio_aproximacao_m: { type: 'integer', nullable: true }, origem: { type: 'string', enum: ['gps', 'manual', 'bairro'] },
              cidade: ref('Local'), bairro: ref('Local'),
              exata: { type: 'object', description: 'só para o dono: { latitude, longitude, precisao_m }' },
              rua: { type: 'string', description: 'só para o dono' }, cep: { type: 'string', description: 'só para o dono' },
            },
          },
        },
      },
      DefinirLocalizacaoDoAnuncio: {
        type: 'object',
        properties: {
          origem: { type: 'string', enum: ['gps', 'manual', 'bairro'], description: 'gps/manual exigem latitude e longitude na cidade do bairro' },
          latitude: { type: 'number' }, longitude: { type: 'number' }, precisao_m: { type: 'number' },
          bairro_id: { type: 'integer', description: 'sem ele, usa o bairro atual do anúncio (ou o do ponto)' },
          rua: { type: 'string', maxLength: 150 }, cep: { type: 'string', example: '36570087' },
        },
      },
      Endereco: {
        type: 'object',
        properties: {
          dentro_da_area: { type: 'boolean' }, precisao: { type: 'string', enum: ['rua', 'bairro', 'cidade'] },
          cidade: ref('Local'), bairro: { type: 'object', nullable: true }, rua: { type: 'string', nullable: true },
          cep: { type: 'string', nullable: true }, fonte: { type: 'object' },
        },
      },
      Notificacao: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, tipo: { type: 'string', enum: ['novo_anuncio', 'nova_avaliacao'] }, anuncio_id: { type: 'integer', nullable: true },
          titulo: { type: 'string' }, texto: { type: 'string' }, lida: { type: 'boolean' }, criada_em: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/api/localizacao/atual': {
      post: {
        tags: ['Localização'], summary: 'Registrar localização atual', security: login,
        description: 'GPS (com consentimento do usuário, no front) ou manual (cidade e bairro). Valida as coordenadas e a área. Liga o compartilhamento.',
        requestBody: corpo(ref('RegistrarLocalizacao'), { latitude: -20.7547, longitude: -42.8819, precisao_m: 15, capturada_em: '2026-11-20T22:00:00Z' }),
        responses: { 201: ok('Registrada', ref('ResultadoLocalizacao')), 200: ok('Já existia: atualizada ou sem mudança significativa', ref('ResultadoLocalizacao')), 400: E400, 401: E401, 422: E422, 429: E429 },
      },
      get: {
        tags: ['Localização'], summary: 'Consultar a minha localização', security: login,
        responses: { 200: ok('Localização (ou null)', { type: 'object', properties: { localizacao: ref('LocalizacaoDoUsuario') } }), 401: E401 },
      },
      patch: {
        tags: ['Localização'], summary: 'Atualizar a minha localização', security: login,
        description: 'Não grava mudança menor que 50 m sem melhora de precisão; recusa duas gravações em menos de 2 s (429).',
        requestBody: corpo(ref('RegistrarLocalizacao')),
        responses: { 200: ok('Atualizada', ref('ResultadoLocalizacao')), 400: E400, 401: E401, 404: E404, 422: E422, 429: E429 },
      },
      delete: {
        tags: ['Localização'], summary: 'Remover a localização guardada (revogar compartilhamento)', security: login,
        responses: { 204: { description: 'Removida' }, 401: E401 },
      },
    },
    '/api/localizacao/preferencias': {
      get: { tags: ['Localização'], summary: 'Preferências de localização', security: login, responses: { 200: ok('Preferências', ref('Preferencias')), 401: E401 } },
      put: {
        tags: ['Localização'], summary: 'Alterar raio padrão, modo, compartilhamento e referência manual', security: login,
        requestBody: corpo({ type: 'object', properties: { raio_km: { type: 'integer' }, modo: { type: 'string' }, compartilhar_localizacao: { type: 'boolean' }, cidade_id: { type: 'integer' }, bairro_id: { type: 'integer' } } }, { raio_km: 10, modo: 'manual', cidade_id: 1, bairro_id: 2 }),
        responses: { 200: ok('Preferências salvas', ref('Preferencias')), 400: E400, 401: E401 },
      },
    },
    '/api/localizacao/proximos': {
      get: {
        tags: ['Localização'], summary: 'Buscar anúncios próximos',
        description: 'Só anúncios ativos, dentro do raio, com a distância de cada um, ordenados por proximidade (ou outra ordem). O filtro e a ordenação são feitos no MySQL.',
        parameters: [
          query('latitude', { type: 'number' }, 'Origem: GPS do aparelho (não é guardado)'),
          query('longitude', { type: 'number' }, 'Origem: GPS do aparelho'),
          query('origem', { type: 'string', enum: ['atual'] }, 'Usar a localização guardada (login)'),
          query('bairro_id', { type: 'integer' }, 'Origem manual: centro do bairro'),
          query('cidade_id', { type: 'integer' }, 'Origem manual: sede da cidade'),
          query('raio_km', { type: 'integer', minimum: 1, maximum: 300 }, `Raio. Sugeridos: ${RAIOS.map((r) => r.km).join(', ')} km`),
          query('ordenar', { type: 'string', enum: ['proximos', 'recentes', 'menor_preco', 'maior_preco'] }, 'Padrão: proximos'),
          ...filtrosDaBusca,
          query('pagina', { type: 'integer', minimum: 1 }, 'Página'),
          query('por_pagina', { type: 'integer', minimum: 1, maximum: 50 }, 'Máximo 50'),
        ],
        responses: { 200: ok('Anúncios próximos', ref('ResultadoProximos')), 400: E400, 422: E422, 429: E429 },
      },
    },
    '/api/localizacao/mapa': {
      get: {
        tags: ['Localização'], summary: 'Marcadores do mapa na área visível',
        parameters: [query('bbox', { type: 'string', example: '-42.95,-20.80,-42.80,-20.70' }, 'lng_min,lat_min,lng_max,lat_max', true), query('limite', { type: 'integer', maximum: 500 }, 'Padrão 300'), ...filtrosDaBusca],
        responses: { 200: ok('Marcadores (ponto aproximado)', { type: 'object' }), 400: E400 },
      },
    },
    '/api/localizacao/distancia': {
      get: {
        tags: ['Localização'], summary: 'Distância entre dois pontos (ou até um anúncio)',
        parameters: [
          query('de_latitude', { type: 'number' }, 'Ponto de partida (ou a localização guardada)'), query('de_longitude', { type: 'number' }, ''),
          query('para_latitude', { type: 'number' }, 'Ponto de chegada'), query('para_longitude', { type: 'number' }, ''),
          query('anuncio_id', { type: 'integer' }, 'Ou: até o ponto aproximado deste anúncio'),
        ],
        responses: { 200: ok('Distância em linha reta', { type: 'object', properties: { distancia_km: { type: 'number' }, distancia_m: { type: 'integer' }, metodo: { type: 'string' } } }), 400: E400, 404: E404 },
      },
    },
    '/api/localizacao/endereco': {
      get: {
        tags: ['Localização'], summary: 'Coordenada para endereço aproximado (cidade, bairro, rua, CEP)',
        description: 'Base local do IBGE e, para a rua exata, o OpenStreetMap (Nominatim, 1 pedido/s, com cache). Nada é guardado.',
        parameters: [query('latitude', { type: 'number' }, '', true), query('longitude', { type: 'number' }, '', true)],
        responses: { 200: ok('Endereço', ref('Endereco')), 400: E400, 422: E422, 429: E429 },
      },
    },
    '/api/localizacao/sugestoes': {
      get: {
        tags: ['Localização'], summary: 'Sugerir regiões (por nome ou perto de um ponto)',
        parameters: [query('busca', { type: 'string', minLength: 2 }, 'Nome de cidade ou bairro'), query('latitude', { type: 'number' }, ''), query('longitude', { type: 'number' }, '')],
        responses: { 200: ok('Sugestões', { type: 'object' }), 400: E400 },
      },
    },
    '/api/localizacao/raios': { get: { tags: ['Localização'], summary: 'Raios sugeridos e limites', responses: { 200: ok('Raios', { type: 'object' }) } } },
    '/api/localizacao/cep/{cep}': {
      get: {
        tags: ['Localização'], summary: 'CEP para rua, bairro e cidade (Zona da Mata)',
        parameters: [{ in: 'path', name: 'cep', required: true, schema: { type: 'string', example: '36570087' } }],
        responses: { 200: ok('Local do CEP', { type: 'object' }), 400: E400, 404: E404 },
      },
    },
    '/api/localizacao/anuncios/{id}': {
      get: {
        tags: ['Localização'], summary: 'Localização de um anúncio',
        description: 'Para os outros: só o ponto aproximado, bairro e cidade. Para o dono: também o ponto exato, a rua e o CEP. Rascunho de outra pessoa: 404.',
        parameters: [caminho('id', 'Id do anúncio')],
        responses: { 200: ok('Localização', ref('LocalizacaoDoAnuncio')), 404: E404 },
      },
      post: {
        tags: ['Localização'], summary: 'Registrar a localização do anúncio (só o dono)', security: login,
        parameters: [caminho('id', 'Id do anúncio')], requestBody: corpo(ref('DefinirLocalizacaoDoAnuncio')),
        responses: { 201: ok('Registrada', ref('LocalizacaoDoAnuncio')), 400: E400, 401: E401, 403: E403, 404: E404, 409: erro('Já tem localização (use PATCH)'), 422: E422 },
      },
      patch: {
        tags: ['Localização'], summary: 'Atualizar a localização do anúncio (só o dono)', security: login,
        parameters: [caminho('id', 'Id do anúncio')], requestBody: corpo(ref('DefinirLocalizacaoDoAnuncio'), { origem: 'gps', latitude: -20.7561, longitude: -42.8789, precisao_m: 12 }),
        responses: { 200: ok('Atualizada', ref('LocalizacaoDoAnuncio')), 400: E400, 401: E401, 403: E403, 404: E404, 422: E422 },
      },
    },
    '/api/cidades': { get: { tags: ['Locais'], summary: 'Os 142 municípios da Zona da Mata', responses: { 200: ok('Cidades', { type: 'array', items: { type: 'object' } }) } } },
    '/api/cidades/{id}/bairros': { get: { tags: ['Locais'], summary: 'Bairros e localidades da cidade', parameters: [caminho('id', 'Id da cidade'), query('busca', { type: 'string' }, 'Filtra pelo nome')], responses: { 200: ok('Bairros', { type: 'array', items: { type: 'object' } }), 404: E404 } } },
    '/api/cidades/{id}/ruas': { get: { tags: ['Locais'], summary: 'Ruas da cidade com CEP (autocompletar)', parameters: [caminho('id', 'Id da cidade'), query('busca', { type: 'string' }, 'Parte do nome'), query('bairro_id', { type: 'integer' }, ''), query('limite', { type: 'integer', maximum: 50 }, '')], responses: { 200: ok('Ruas', { type: 'array', items: { type: 'object' } }), 404: E404 } } },
    '/api/anuncios': {
      get: { tags: ['Anúncios'], summary: 'Busca (com distância a partir da cidade ou das coordenadas)', parameters: [query('cidade_id', { type: 'integer' }, 'Padrão 1 (Viçosa)'), query('latitude', { type: 'number' }, ''), query('longitude', { type: 'number' }, ''), query('distancia_max', { type: 'number' }, 'km'), query('ordenar', { type: 'string', enum: ['recentes', 'menor_preco', 'maior_preco', 'proximos'] }, ''), ...filtrosDaBusca], responses: { 200: ok('Página de anúncios', { type: 'object' }) } },
      post: { tags: ['Anúncios'], summary: 'Publicar (multipart, fotos no campo fotos). Aceita transporte (mochila, carro ou carreto) e latitude, longitude, origem_localizacao, rua, cep e precisao_m', security: login, responses: { 201: ok('Anúncio', { type: 'object' }), 400: E400, 401: E401, 422: E422 } },
    },
    '/api/anuncios/{id}': {
      get: { tags: ['Anúncios'], summary: 'Detalhe (com localizacao_anuncio aproximada; exata só para o dono). O vendedor vem com vinculo_academico (verdadeiro ou falso), sem e-mail', parameters: [caminho('id', 'Id')], responses: { 200: ok('Anúncio', { type: 'object' }), 404: E404 } },
      put: { tags: ['Anúncios'], summary: 'Editar (só o dono; também aceita os campos de localização)', security: login, parameters: [caminho('id', 'Id')], responses: { 200: ok('Anúncio', { type: 'object' }), 403: E403 } },
      delete: { tags: ['Anúncios'], summary: 'Excluir (só o dono); some das buscas na hora', security: login, parameters: [caminho('id', 'Id')], responses: { 204: { description: 'Excluído' }, 403: E403 } },
    },
    '/api/anuncios/{id}/status': {
      patch: { tags: ['Anúncios'], summary: 'Mudar o status (só o dono): ativo (disponível), reservado (continua na busca) ou vendido (sai da busca)', security: login, parameters: [caminho('id', 'Id')], requestBody: corpo({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['ativo', 'reservado', 'vendido'] } } }), responses: { 200: ok('Anúncio', { type: 'object' }), 400: E400, 403: E403 } },
    },
    '/api/procuras': {
      get: { tags: ['Procura-se'], summary: 'Pedidos de quem está procurando algo (os mais novos primeiro), sem telefone e e-mail', parameters: [query('cidade_id', { type: 'integer' }, 'Só os pedidos dessa cidade')], responses: { 200: ok('Pedidos', { type: 'object', properties: { itens: { type: 'array', items: { type: 'object' } } } }) } },
      post: { tags: ['Procura-se'], summary: 'Publicar um pedido. Quando um anúncio compatível for publicado na mesma cidade, quem pediu e quem anunciou são avisados no sininho', security: login, requestBody: corpo({ type: 'object', required: ['titulo', 'bairro_id'], properties: { titulo: { type: 'string', minLength: 3, maxLength: 80 }, bairro_id: { type: 'integer' }, categoria_id: { type: 'integer', nullable: true }, preco_max: { type: 'number', nullable: true } } }), responses: { 201: ok('Pedido', { type: 'object' }), 400: E400, 401: E401, 409: erro('Limite de 10 pedidos por pessoa') } },
    },
    '/api/procuras/{id}': {
      delete: { tags: ['Procura-se'], summary: 'Excluir o pedido (só quem publicou)', security: login, parameters: [caminho('id', 'Id do pedido')], responses: { 204: { description: 'Excluído' }, 403: E403, 404: E404 } },
    },
    '/api/conversas/{id}/comparecimento': {
      get: { tags: ['Conversas'], summary: 'A minha resposta sobre o combinado desta conversa (ou null)', security: login, parameters: [caminho('id', 'Id da conversa')], responses: { 200: ok('Resposta', { type: 'object' }), 403: E403, 404: E404 } },
      post: { tags: ['Conversas'], summary: 'Compromisso nas entregas: depois da venda, dizer se a outra pessoa compareceu ao combinado (uma vez por conversa)', security: login, parameters: [caminho('id', 'Id da conversa')], requestBody: corpo({ type: 'object', required: ['compareceu'], properties: { compareceu: { type: 'boolean' } } }), responses: { 201: ok('Resposta', { type: 'object' }), 400: E400, 403: E403, 409: erro('Anúncio ainda não vendido ou resposta já enviada') } },
    },
    '/api/notificacoes': { get: { tags: ['Notificações'], summary: 'Avisos do sininho', security: login, responses: { 200: ok('Avisos', { type: 'object', properties: { nao_lidas: { type: 'integer' }, itens: { type: 'array', items: ref('Notificacao') } } }), 401: E401 } } },
    '/api/notificacoes/lidas': { patch: { tags: ['Notificações'], summary: 'Marcar como lidas (todas ou { ids })', security: login, responses: { 200: ok('Não lidas restantes', { type: 'object' }) } } },
    '/api/notificacoes/preferencias': {
      get: { tags: ['Notificações'], summary: 'Preferências de aviso e situação do push', security: login, responses: { 200: ok('Preferências', { type: 'object' }) } },
      put: { tags: ['Notificações'], summary: 'Ativar/desativar avisos de anúncio novo e raio', security: login, requestBody: corpo({ type: 'object', properties: { anuncios: { type: 'boolean' }, raio_km: { type: 'integer', nullable: true } } }), responses: { 200: ok('Preferências', { type: 'object' }) } },
    },
    '/api/notificacoes/push': {
      post: { tags: ['Notificações'], summary: 'Inscrever este aparelho no push (PushSubscription do navegador)', security: login, responses: { 201: ok('Inscrito', { type: 'object' }), 503: erro('Push não configurado no servidor') } },
      delete: { tags: ['Notificações'], summary: 'Desinscrever este aparelho', security: login, responses: { 204: { description: 'Removido' } } },
    },
    '/api/notificacoes/push/chave': { get: { tags: ['Notificações'], summary: 'Chave pública VAPID', responses: { 200: ok('Chave', { type: 'object' }) } } },
    '/api/usuarios/{id}': { get: { tags: ['Perfil'], summary: 'Perfil público de um usuário (sem telefone e e-mail) com o selo vinculo_academico, a taxa de compromisso nas entregas e os anúncios ativos e reservados dele', parameters: [caminho('id', 'Id do usuário')], responses: { 200: ok('Perfil público', { type: 'object' }), 404: erro('Usuário não encontrado') } } },
    '/api/conversas': { get: { tags: ['Conversas'], summary: 'Minhas conversas (com online agora e último acesso do outro)', security: login, responses: { 200: ok('Conversas', { type: 'object' }) } }, post: { tags: ['Conversas'], summary: 'Abrir conversa em um anúncio', security: login, responses: { 201: ok('Conversa', { type: 'object' }) } } },
    '/api/conversas/{id}/mensagens': { get: { tags: ['Conversas'], summary: 'Mensagens (marca as recebidas como lidas)', security: login, parameters: [caminho('id', 'Id')], responses: { 200: ok('Mensagens', { type: 'object' }) } }, post: { tags: ['Conversas'], summary: 'Enviar mensagem (também pelo Socket.IO: enviar_mensagem)', security: login, parameters: [caminho('id', 'Id')], responses: { 201: ok('Mensagem', { type: 'object' }) } } },
    '/api/conversas/{id}/mensagens/{mensagemId}': { patch: { tags: ['Conversas'], summary: 'Editar a própria mensagem até 15 minutos depois de enviar ({ texto })', security: login, parameters: [caminho('id', 'Id da conversa'), caminho('mensagemId', 'Id da mensagem')], responses: { 200: ok('Mensagem editada (editada: true)', { type: 'object' }), 403: erro('Mensagem de outra pessoa ou conversa de outras pessoas'), 404: erro('Mensagem não encontrada'), 409: erro('Passou dos 15 minutos ou a mensagem foi apagada') } }, delete: { tags: ['Conversas'], summary: 'Apagar mensagem: para=mim (some só para você, qualquer mensagem) ou para=todos (a sua, até 2 dias depois; texto e foto saem)', security: login, parameters: [caminho('id', 'Id da conversa'), caminho('mensagemId', 'Id da mensagem'), { in: 'query', name: 'para', schema: { type: 'string', enum: ['mim', 'todos'] }, description: 'Padrão: mim' }], responses: { 200: ok('Apagada para todos (apagada: true)', { type: 'object' }), 204: { description: 'Apagada só para você' }, 403: erro('Mensagem de outra pessoa (para todos) ou conversa de outras pessoas'), 404: erro('Mensagem não encontrada'), 409: erro('Passou dos 2 dias para apagar para todos') } } },
    '/api/conversas/{id}/fotos': { post: { tags: ['Conversas'], summary: 'Enviar fotos na conversa (multipart: fotos = até 5 imagens JPG, PNG ou WebP; texto = legenda opcional)', security: login, parameters: [caminho('id', 'Id')], responses: { 201: ok('Mensagens criadas, uma por foto', { type: 'object' }), 400: erro('Sem foto, arquivo inválido ou mais de 5 fotos'), 403: erro('Não participa da conversa') } } },
    '/api/conversas/{id}/fotos/{arquivo}': { get: { tags: ['Conversas'], summary: 'Abrir uma foto da conversa (só quem participa)', security: login, parameters: [caminho('id', 'Id'), { in: 'path', name: 'arquivo', required: true, schema: { type: 'string' }, description: 'Nome do arquivo, ex.: <foto>-480.webp' }], responses: { 200: { description: 'Imagem WebP' }, 403: erro('Não participa da conversa'), 404: erro('Foto não encontrada') } } },
    '/api/conversas/{id}/denuncia': { get: { tags: ['Conversas'], summary: 'A denúncia que eu fiz nesta conversa (ou null)', security: login, parameters: [caminho('id', 'Id')], responses: { 200: ok('Denúncia', { type: 'object' }) } }, post: { tags: ['Conversas'], summary: 'Denunciar a outra pessoa da conversa (motivo: golpe, ofensa, spam, proibido, perfil_falso ou outro)', security: login, parameters: [caminho('id', 'Id')], responses: { 201: ok('Denúncia', { type: 'object' }), 409: erro('Já denunciou esta conversa') } } },
    '/api/avaliacoes/conversas/{id}': { post: { tags: ['Avaliações'], summary: 'Avaliar o vendedor (comprador, após a venda e depois de conversarem)', security: login, parameters: [caminho('id', 'Id da conversa')], responses: { 201: ok('Avaliação', { type: 'object' }), 409: erro('Antes da venda, sem conversa ou repetida') } } },
    '/api/avaliacoes/usuarios/{id}': { get: { tags: ['Avaliações'], summary: 'Avaliações recebidas por um usuário', parameters: [caminho('id', 'Id')], responses: { 200: ok('Avaliações', { type: 'object' }) } } },
    '/api/favoritos': { get: { tags: ['Favoritos'], summary: 'Meus favoritos', security: login, responses: { 200: ok('Favoritos', { type: 'object' }) } } },
    '/api/perfil': {
      get: { tags: ['Perfil e login'], summary: 'Meu perfil (com membro desde e último acesso)', security: login, responses: { 200: ok('Perfil', { type: 'object' }) } },
      delete: { tags: ['Perfil e login'], summary: 'Excluir a minha conta: saem a conta, os anúncios, as conversas, as avaliações e todas as fotos (do banco e do disco)', security: login, requestBody: corpo({ type: 'object', required: ['confirmar'], properties: { confirmar: { type: 'string', enum: ['EXCLUIR'] } } }), responses: { 204: { description: 'Conta excluída' }, 400: E400, 401: E401 } },
    },
    '/api/auth/sessao': { get: { tags: ['Perfil e login'], summary: 'Sessão atual (registra o acesso ao entrar)', responses: { 200: ok('Usuário ou null', { type: 'object' }) } } },
    '/api/auth/google': { post: { tags: ['Perfil e login'], summary: 'Login com Google', requestBody: corpo({ type: 'object', properties: { credential: { type: 'string' } } }), responses: { 200: ok('Usuário', { type: 'object' }) } } },
    '/api/auth/logout': { post: { tags: ['Perfil e login'], summary: 'Sair (com { push_endpoint }, desinscreve este aparelho)', responses: { 204: { description: 'Saiu' } } } },
  },
}
