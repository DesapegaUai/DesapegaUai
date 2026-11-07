-- Dados iniciais do DesapegaUai. Rode depois do schema.sql (ou use npm run banco).
-- A parte 2 é só para desenvolvimento: em produção, rode apenas a parte 1.

USE desapegauai;
SET NAMES utf8mb4;

-- Parte 1: dados fixos

-- Categorias, na ordem das abas
INSERT INTO categoria (id, nome, slug, rotulo_filtro, ordem) VALUES
  (1, 'Casa',        'casa',        'Tipo',       1),
  (2, 'Eletrônicos', 'eletronicos', 'Tipo',       2),
  (3, 'Moda',        'moda',        'Tamanho',    3),
  (4, 'Veículos',    'veiculos',    'Tipo',       4),
  (5, 'Livros',      'livros',      'Gênero',     5),
  (6, 'Games',       'games',       'Plataforma', 6),
  (7, 'Serviços',    'servicos',    'Tipo',       7),
  (8, 'Outros',      'outros',      'Tipo',       8);

-- Subcategorias (os chips de filtro)
INSERT INTO subcategoria (id, categoria_id, nome) VALUES
  (1, 1, 'Móveis'), (2, 1, 'Eletrodomésticos'), (3, 1, 'Decoração'), (4, 1, 'Utensílios'),
  (5, 2, 'Celulares'), (6, 2, 'Notebooks'), (7, 2, 'Áudio'), (8, 2, 'TVs'),
  (9, 3, 'P'), (10, 3, 'M'), (11, 3, 'G'), (12, 3, 'GG'),
  (13, 4, 'Carros'), (14, 4, 'Motos'), (15, 4, 'Bicicletas'), (16, 4, 'Peças'),
  (17, 5, 'Didáticos'), (18, 5, 'Literatura'), (19, 5, 'HQs'), (20, 5, 'Técnicos'),
  (21, 6, 'PlayStation'), (22, 6, 'Xbox'), (23, 6, 'Nintendo'), (24, 6, 'PC'),
  (25, 7, 'Reparos'), (26, 7, 'Aulas'), (27, 7, 'Frete'), (28, 7, 'Limpeza'),
  (29, 8, 'Instrumentos'), (30, 8, 'Esportes'), (31, 8, 'Pets'), (32, 8, 'Bebê');

-- Cidades (coordenada do centro, Google Places)
INSERT INTO cidade (id, nome, uf, latitude, longitude) VALUES
  (1, 'Viçosa',     'MG', -20.752736, -42.881906),
  (2, 'Teixeiras',  'MG', -20.652995, -42.857124),
  (3, 'Ponte Nova', 'MG', -20.419632, -42.917060),
  (4, 'Ubá',        'MG', -21.120156, -42.942018);

-- Bairros (Google Places)
INSERT INTO bairro (id, cidade_id, nome, latitude, longitude) VALUES
  (1,  1, 'Centro',           -20.752736, -42.881906),
  (2,  1, 'Ramos',            -20.754992, -42.883220),
  (3,  1, 'Santa Clara',      -20.756417, -42.887652),
  (4,  1, 'Bela Vista',       -20.757912, -42.876578),
  (5,  1, 'Betânia',          -20.756073, -42.890417),
  (6,  1, 'Clélia Bernardes', -20.761024, -42.883181),
  (7,  1, 'Santo Antônio',    -20.751021, -42.870269),
  (8,  1, 'Campus UFV',       -20.761013, -42.870236),
  (9,  1, 'Fátima',           -20.764150, -42.888921),
  (10, 1, 'Bom Jesus',        -20.766414, -42.879623),
  (11, 1, 'Sagrada Família',  -20.769720, -42.886321),
  (12, 1, 'Nova Viçosa',      -20.771593, -42.901540),
  (13, 1, 'Amoras',           -20.729496, -42.886916),
  (14, 1, 'Vale do Sol',      -20.734714, -42.885712),
  (15, 1, 'Barrinha',         -20.736829, -42.892409),
  (16, 1, 'Júlia Mollá',      -20.734435, -42.871097),
  (17, 1, 'Inconfidência',    -20.732945, -42.864620),
  (18, 1, 'João Braz',        -20.732658, -42.861351),
  (19, 1, 'Silvestre',        -20.718339, -42.861351),
  (20, 1, 'Novo Silvestre',   -20.709612, -42.862569),
  (21, 2, 'Centro',           -20.652995, -42.857124),
  (22, 3, 'Centro',           -20.419632, -42.917060),
  (23, 3, 'Palmeiras',        -20.411375, -42.894235),
  (24, 4, 'Centro',           -21.120156, -42.942018),
  (25, 4, 'São Domingos',     -21.112413, -42.942131);

-- Parte 2: dados de teste
-- Login de teste: POST /api/auth/teste com { "usuario_id": 1 }

-- O login de teste só aceita google_id que começa com "teste-"
INSERT INTO usuario (id, google_id, nome, email, telefone, bio, criado_em, ultimo_acesso) VALUES
  (1, 'teste-diego',   'Diego Martins',   'diego.teste@example.com',   '31999990001',
      'Saio de Viçosa em 3 semanas e preciso esvaziar o apartamento.', NOW() - INTERVAL 400 DAY, NOW() - INTERVAL 1 HOUR),
  (2, 'teste-larissa', 'Larissa Andrade', 'larissa.teste@example.com', NULL,
      'Caloura, montando o quarto na república do Ramos.', NOW() - INTERVAL 20 DAY, NOW() - INTERVAL 2 HOUR),
  (3, 'teste-usuario', 'Usuário Teste',   'usuario.teste@example.com', NULL,
      NULL, NOW() - INTERVAL 5 DAY, NULL);

-- Anúncios do Diego (sem foto)
INSERT INTO anuncio (id, usuario_id, categoria_id, subcategoria_id, bairro_id, titulo, descricao,
                     preco, condicao, forma_entrega, localizacao, status, data_publicacao) VALUES
  (1,  1, 1, 1,  1,  'Sofá 3 lugares', 'Sofá cinza de 3 lugares, tecido sem rasgos. Preciso vender rápido.',
       780.00,  'usado',    'retirada', NULL, 'ativo', NOW() - INTERVAL 2 HOUR),
  (2,  1, 1, 1,  19, 'Guarda-roupa 6 portas', 'Guarda-roupa de MDF com 6 portas e 2 gavetas. Já está desmontado.',
       650.00,  'usado',    'combinar', NULL, 'ativo', NOW() - INTERVAL 5 HOUR),
  (3,  1, 1, 2,  1,  'Geladeira Brastemp', 'Geladeira frost free de 375 litros, funcionando perfeitamente.',
       1200.00, 'usado',    'combinar', NULL, 'ativo', NOW() - INTERVAL 1 DAY),
  (4,  1, 1, 1,  12, 'Mesa de jantar', 'Mesa de madeira com 4 cadeiras.',
       480.00,  'seminovo', 'retirada', NULL, 'ativo', NOW() - INTERVAL 27 HOUR),
  (5,  1, 1, 2,  10, 'Air fryer 4L', 'Air fryer Mondial de 4 litros, usei por uns 8 meses. Acompanha a caixa.',
       260.00,  'seminovo', 'retirada', NULL, 'ativo', NOW() - INTERVAL 2 DAY),
  (6,  1, 1, 2,  7,  'Ventilador de teto', 'Ventilador de teto com 3 pás e controle de velocidade.',
       120.00,  'usado',    'retirada', NULL, 'ativo', NOW() - INTERVAL 3 DAY),
  (7,  1, 2, 5,  1,  'iPhone 13 128GB', 'iPhone 13 de 128 GB, bateria em 86%, com capinha e película.',
       2450.00, 'seminovo', 'combinar', 'Entrego perto da UFV', 'ativo', NOW() - INTERVAL 4 DAY),
  (8,  1, 4, 15, 23, 'Bicicleta aro 29', 'Mountain bike aro 29 com 21 marchas e freio a disco.',
       850.00,  'usado',    'retirada', NULL, 'ativo', NOW() - INTERVAL 5 DAY),
  (9,  1, 1, 1,  25, 'Sofá 2 lugares', 'Sofá retrátil de 2 lugares.',
       600.00,  'usado',    'combinar', NULL, 'ativo', NOW() - INTERVAL 6 DAY),
  (10, 1, 1, 1,  21, 'Mesa de escritório', 'Mesa de escritório com gaveteiro, ótima para estudar.',
       250.00,  'usado',    'retirada', NULL, 'ativo', NOW() - INTERVAL 7 DAY),
  -- vendido: não aparece na busca, só em Meus anúncios
  (11, 1, 1, 1,  2,  'Escrivaninha branca', 'Escrivaninha com uma gaveta.',
       150.00,  'usado',    'retirada', NULL, 'vendido', NOW() - INTERVAL 10 DAY);

-- Favoritos da Larissa
INSERT INTO favorito (usuario_id, anuncio_id, criado_em) VALUES
  (2, 1, NOW() - INTERVAL 1 HOUR),
  (2, 7, NOW() - INTERVAL 3 HOUR);

-- Conversa da Larissa com o Diego sobre a air fryer (a última mensagem ainda não foi lida)
INSERT INTO conversa (id, anuncio_id, comprador_id, criada_em, atualizada_em) VALUES
  (1, 5, 2, NOW() - INTERVAL 50 MINUTE, NOW() - INTERVAL 30 MINUTE);

INSERT INTO mensagem (conversa_id, remetente_id, texto, enviada_em, lida) VALUES
  (1, 2, 'Oi! Boa tarde. A air fryer ainda está disponível?', NOW() - INTERVAL 50 MINUTE, TRUE),
  (1, 1, 'Oi, Larissa! Está sim, em ótimo estado. Usei por uns 8 meses.', NOW() - INTERVAL 45 MINUTE, TRUE),
  (1, 2, 'Acompanha a caixa?', NOW() - INTERVAL 40 MINUTE, TRUE),
  (1, 1, 'Acompanha a caixa original, só o manual que eu perdi.', NOW() - INTERVAL 35 MINUTE, TRUE),
  (1, 2, 'Perfeito. Aceita R$ 240 pegando hoje?', NOW() - INTERVAL 30 MINUTE, FALSE);
