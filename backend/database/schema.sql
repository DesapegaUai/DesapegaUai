-- Estrutura do banco do DesapegaUai (MySQL 8 ou MariaDB 10.4 do XAMPP)
-- Apaga e recria as tabelas. Use npm run banco: ele roda este arquivo, o seed.sql e importa os
-- locais da Zona da Mata. Para atualizar um banco antigo sem perder os dados: npm run atualizar
-- Só a Rhayane altera este arquivo.

USE desapegauai;
SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS comparecimento, procura, denuncia, inscricao_push, notificacao, preferencia_localizacao, localizacao_usuario, localizacao_anuncio,
  avaliacao, mensagem_oculta, mensagem, conversa, favorito, foto_anuncio, anuncio, subcategoria, categoria, usuario,
  rua, bairro, cidade;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================================
-- Locais: os 142 municípios da Zona da Mata mineira (mesorregião 3112 do IBGE)
-- ============================================================================================

CREATE TABLE cidade (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  codigo_ibge INT UNSIGNED  NOT NULL,
  nome        VARCHAR(80)   NOT NULL,
  uf          CHAR(2)       NOT NULL DEFAULT 'MG',
  latitude    DECIMAL(9,6)  NOT NULL,   -- sede do município
  longitude   DECIMAL(9,6)  NOT NULL,
  cep_geral   CHAR(8)       NULL,       -- cidade com um CEP só para todos os endereços
  PRIMARY KEY (id),
  UNIQUE KEY uq_cidade_codigo_ibge (codigo_ibge),
  UNIQUE KEY uq_cidade_nome_uf (nome, uf),
  CONSTRAINT ck_cidade_cep CHECK (cep_geral REGEXP '^[0-9]{8}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bairros e localidades (distritos, povoados e comunidades rurais) do Censo 2022
CREATE TABLE bairro (
  id        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  cidade_id INT UNSIGNED  NOT NULL,
  nome      VARCHAR(100)  NOT NULL,
  distrito  VARCHAR(80)   NULL,       -- distrito do IBGE, quando não é o da sede
  rural     BOOLEAN       NOT NULL DEFAULT FALSE,
  latitude  DECIMAL(9,6)  NOT NULL,   -- centro dos endereços do bairro
  longitude DECIMAL(9,6)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bairro_cidade_nome (cidade_id, nome),
  KEY ix_bairro_coordenada (latitude, longitude),
  CONSTRAINT fk_bairro_cidade FOREIGN KEY (cidade_id) REFERENCES cidade (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ruas com CEP (um registro por trecho de rua com o mesmo CEP e bairro), do CNEFE 2022
CREATE TABLE rua (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  cidade_id  INT UNSIGNED  NOT NULL,
  bairro_id  INT UNSIGNED  NULL,
  nome       VARCHAR(150)  NOT NULL,
  cep        CHAR(8)       NULL,
  numero_min INT UNSIGNED  NULL,
  numero_max INT UNSIGNED  NULL,
  enderecos  INT UNSIGNED  NOT NULL DEFAULT 0,   -- endereços do Censo nesse trecho
  latitude   DECIMAL(9,6)  NOT NULL,             -- centro do trecho
  longitude  DECIMAL(9,6)  NOT NULL,
  PRIMARY KEY (id),
  KEY ix_rua_cidade_nome (cidade_id, nome),
  KEY ix_rua_cep (cep),
  KEY ix_rua_coordenada (latitude, longitude),
  CONSTRAINT fk_rua_cidade FOREIGN KEY (cidade_id) REFERENCES cidade (id),
  CONSTRAINT fk_rua_bairro FOREIGN KEY (bairro_id) REFERENCES bairro (id) ON DELETE SET NULL,
  CONSTRAINT ck_rua_cep CHECK (cep REGEXP '^[0-9]{8}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================================
-- Usuários, categorias e anúncios
-- ============================================================================================

CREATE TABLE usuario (
  id                 INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  google_id          VARCHAR(255)       NOT NULL,   -- "sub" do token do Google
  nome               VARCHAR(120)       NOT NULL,
  email              VARCHAR(255)       NOT NULL,
  foto_url           VARCHAR(500)       NULL,
  telefone           VARCHAR(20)        NULL,       -- só números
  bio                VARCHAR(300)       NULL,
  criado_em          DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acesso      DATETIME           NULL,
  versao_sessao      INT UNSIGNED       NOT NULL DEFAULT 0,       -- aumenta ao sair da conta: os tokens de antes deixam de valer
  notificar_anuncios BOOLEAN            NOT NULL DEFAULT FALSE,   -- avisos de anúncios novos
  notificar_mensagens BOOLEAN           NOT NULL DEFAULT TRUE,    -- avisos de mensagem nova do chat
  notificar_raio_km  SMALLINT UNSIGNED  NULL,       -- NULL = toda a Zona da Mata
  notificar_cidade_id INT UNSIGNED      NULL,       -- só avisar anúncios desta cidade (NULL = vale a distância acima)
  notificar_bairro_id INT UNSIGNED      NULL,       -- e, se preenchido, só deste bairro da cidade
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_google_id (google_id),
  UNIQUE KEY uq_usuario_email (email),
  CONSTRAINT fk_usuario_notificar_cidade FOREIGN KEY (notificar_cidade_id) REFERENCES cidade (id) ON DELETE SET NULL,
  CONSTRAINT fk_usuario_notificar_bairro FOREIGN KEY (notificar_bairro_id) REFERENCES bairro (id) ON DELETE SET NULL,
  CONSTRAINT ck_usuario_telefone CHECK (telefone REGEXP '^[0-9]{10,11}$'),
  CONSTRAINT ck_usuario_raio CHECK (notificar_raio_km BETWEEN 1 AND 300)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categoria (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(50)       NOT NULL,
  slug          VARCHAR(50)       NOT NULL,
  rotulo_filtro VARCHAR(30)       NOT NULL,   -- Tipo, Tamanho, Gênero ou Plataforma
  ordem         TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categoria_nome (nome),
  UNIQUE KEY uq_categoria_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subcategoria (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  categoria_id INT UNSIGNED  NOT NULL,
  nome         VARCHAR(50)   NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subcategoria_categoria_nome (categoria_id, nome),
  UNIQUE KEY uq_subcategoria_id_categoria (id, categoria_id),
  CONSTRAINT fk_subcategoria_categoria FOREIGN KEY (categoria_id) REFERENCES categoria (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE anuncio (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  usuario_id      INT UNSIGNED   NOT NULL,
  categoria_id    INT UNSIGNED   NULL,       -- NULL só em rascunho
  subcategoria_id INT UNSIGNED   NULL,
  bairro_id       INT UNSIGNED   NULL,       -- NULL só em rascunho
  titulo          VARCHAR(80)    NULL,       -- NULL só em rascunho
  descricao       VARCHAR(1000)  NULL,
  preco           DECIMAL(10,2)  NULL,       -- NULL só em rascunho
  condicao        ENUM('novo', 'seminovo', 'usado') NULL,   -- NULL só em Serviços
  forma_entrega   ENUM('retirada', 'combinar')       NULL,   -- NULL só em rascunho
  transporte      ENUM('mochila', 'carro', 'carreto') NULL,  -- como levar o item; NULL em Serviços e em anúncio antigo
  localizacao     VARCHAR(120)   NULL,       -- ponto de referência que o dono quer mostrar (público)
  status          ENUM('rascunho', 'ativo', 'reservado', 'vendido') NOT NULL DEFAULT 'ativo',   -- reservado continua na busca
  visualizacoes   INT UNSIGNED   NOT NULL DEFAULT 0,
  criado_em       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_publicacao DATETIME       NULL DEFAULT CURRENT_TIMESTAMP,   -- NULL enquanto for rascunho
  atualizado_em   DATETIME       NULL,   -- NOW() quando o dono editar
  PRIMARY KEY (id),
  KEY ix_anuncio_status_categoria (status, categoria_id),
  KEY ix_anuncio_bairro (bairro_id),
  CONSTRAINT fk_anuncio_usuario      FOREIGN KEY (usuario_id)      REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT fk_anuncio_categoria    FOREIGN KEY (categoria_id)    REFERENCES categoria (id),
  -- subcategoria tem que ser da mesma categoria
  CONSTRAINT fk_anuncio_subcategoria FOREIGN KEY (subcategoria_id, categoria_id)
                                     REFERENCES subcategoria (id, categoria_id),
  CONSTRAINT fk_anuncio_bairro       FOREIGN KEY (bairro_id)       REFERENCES bairro (id),
  CONSTRAINT ck_anuncio_preco  CHECK (preco > 0),
  CONSTRAINT ck_anuncio_titulo CHECK (TRIM(titulo) <> ''),
  CONSTRAINT ck_anuncio_publicado CHECK (
    status = 'rascunho' OR (titulo IS NOT NULL AND categoria_id IS NOT NULL AND bairro_id IS NOT NULL
      AND preco IS NOT NULL AND forma_entrega IS NOT NULL AND data_publicacao IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE foto_anuncio (
  id         INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  anuncio_id INT UNSIGNED      NOT NULL,
  arquivo    VARCHAR(64)       NOT NULL,   -- sem a largura e sem a extensão
  ordem      TINYINT UNSIGNED  NOT NULL DEFAULT 0,   -- 0 = capa
  PRIMARY KEY (id),
  KEY ix_foto_anuncio_ordem (anuncio_id, ordem),
  CONSTRAINT fk_foto_anuncio FOREIGN KEY (anuncio_id) REFERENCES anuncio (id) ON DELETE CASCADE,
  CONSTRAINT ck_foto_anuncio_arquivo CHECK (arquivo REGEXP '^[A-Za-z0-9_-]+$')   -- sem "..", "/" ou "\"
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================================
-- Localização (tabelas próprias). A coordenada exata nunca aparece para outras pessoas (LGPD).
-- ============================================================================================

-- Localização do anúncio: é de onde o produto está, não de onde o vendedor está. Só muda quando
-- o dono edita. Todo anúncio publicado tem uma (sem GPS, vale o centro do bairro: origem bairro).
CREATE TABLE localizacao_anuncio (
  id                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  anuncio_id        INT UNSIGNED    NOT NULL,
  latitude          DECIMAL(10,7)   NOT NULL,   -- ponto exato: só o dono vê
  longitude         DECIMAL(10,7)   NOT NULL,
  latitude_publica  DECIMAL(10,7)   NOT NULL,   -- ponto aproximado (grade de uns 250 m), usado na
  longitude_publica DECIMAL(10,7)   NOT NULL,   -- busca, no raio, na distância e no mapa
  precisao_m        DECIMAL(10,2)   NULL,       -- precisão do GPS, em metros
  origem            ENUM('gps', 'manual', 'bairro') NOT NULL,
  cidade_id         INT UNSIGNED    NOT NULL,
  bairro_id         INT UNSIGNED    NOT NULL,
  cidade            VARCHAR(100)    NOT NULL,
  bairro            VARCHAR(100)    NOT NULL,
  rua               VARCHAR(150)    NULL,       -- rua e CEP podem ser a casa do vendedor: só o dono vê
  cep               CHAR(8)         NULL,
  criada_em         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizada_em     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_localizacao_anuncio (anuncio_id),
  KEY ix_localizacao_anuncio_publica (latitude_publica, longitude_publica),
  KEY ix_localizacao_anuncio_cidade (cidade_id),
  CONSTRAINT fk_localizacao_anuncio        FOREIGN KEY (anuncio_id) REFERENCES anuncio (id) ON DELETE CASCADE,
  CONSTRAINT fk_localizacao_anuncio_cidade FOREIGN KEY (cidade_id)  REFERENCES cidade (id),
  CONSTRAINT fk_localizacao_anuncio_bairro FOREIGN KEY (bairro_id)  REFERENCES bairro (id),
  CONSTRAINT ck_localizacao_anuncio_coordenada CHECK (
    latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
    AND latitude_publica BETWEEN -90 AND 90 AND longitude_publica BETWEEN -180 AND 180
  ),
  CONSTRAINT ck_localizacao_anuncio_precisao CHECK (precisao_m >= 0),
  CONSTRAINT ck_localizacao_anuncio_cep      CHECK (cep REGEXP '^[0-9]{8}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Localização atual de quem compra (GPS ou escolhida). Só existe enquanto a pessoa compartilhar:
-- desativar apaga a linha, e ela some sozinha depois de 30 dias sem atualização. Uma linha por
-- pessoa, sem histórico de deslocamento.
CREATE TABLE localizacao_usuario (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  usuario_id    INT UNSIGNED    NOT NULL,
  latitude      DECIMAL(10,7)   NOT NULL,
  longitude     DECIMAL(10,7)   NOT NULL,
  precisao_m    DECIMAL(10,2)   NULL,       -- precisão do GPS, em metros
  origem        ENUM('gps', 'manual') NOT NULL,
  cidade_id     INT UNSIGNED    NOT NULL,
  bairro_id     INT UNSIGNED    NULL,
  capturada_em  DATETIME        NOT NULL,   -- quando o aparelho mediu
  atualizada_em DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_localizacao_usuario (usuario_id),
  KEY ix_localizacao_usuario_coordenada (latitude, longitude),
  KEY ix_localizacao_usuario_atualizada (atualizada_em),
  CONSTRAINT fk_localizacao_usuario        FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT fk_localizacao_usuario_cidade FOREIGN KEY (cidade_id)  REFERENCES cidade (id),
  CONSTRAINT fk_localizacao_usuario_bairro FOREIGN KEY (bairro_id)  REFERENCES bairro (id) ON DELETE SET NULL,
  CONSTRAINT ck_localizacao_usuario_coordenada CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180),
  CONSTRAINT ck_localizacao_usuario_precisao   CHECK (precisao_m >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preferências de localização de cada pessoa
CREATE TABLE preferencia_localizacao (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  usuario_id    INT UNSIGNED  NOT NULL,
  raio_km       INT UNSIGNED  NOT NULL DEFAULT 5,
  modo          VARCHAR(20)   NOT NULL DEFAULT 'manual',   -- gps ou manual
  compartilhar  BOOLEAN       NOT NULL DEFAULT FALSE,
  cidade_id     INT UNSIGNED  NULL,   -- referência escolhida à mão
  bairro_id     INT UNSIGNED  NULL,
  atualizada_em DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_preferencia_localizacao (usuario_id),
  CONSTRAINT fk_preferencia_localizacao        FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT fk_preferencia_localizacao_cidade FOREIGN KEY (cidade_id)  REFERENCES cidade (id) ON DELETE SET NULL,
  CONSTRAINT fk_preferencia_localizacao_bairro FOREIGN KEY (bairro_id)  REFERENCES bairro (id) ON DELETE SET NULL,
  CONSTRAINT ck_preferencia_localizacao_raio CHECK (raio_km BETWEEN 1 AND 300),
  CONSTRAINT ck_preferencia_localizacao_modo CHECK (modo IN ('gps', 'manual'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================================
-- Favoritos, conversas, avaliações e notificações
-- ============================================================================================

CREATE TABLE favorito (
  usuario_id INT UNSIGNED  NOT NULL,
  anuncio_id INT UNSIGNED  NOT NULL,
  criado_em  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, anuncio_id),
  KEY ix_favorito_anuncio (anuncio_id),
  CONSTRAINT fk_favorito_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT fk_favorito_anuncio FOREIGN KEY (anuncio_id) REFERENCES anuncio (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE conversa (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  anuncio_id    INT UNSIGNED  NOT NULL,
  comprador_id  INT UNSIGNED  NOT NULL,
  criada_em     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizada_em DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- hora da última mensagem
  -- "Excluir conversa" vale só para quem excluiu: guarda a hora em que cada lado apagou.
  -- A conversa some da lista dessa pessoa até chegar mensagem nova, e o que veio antes não volta para ela.
  oculta_comprador_em DATETIME NULL,
  oculta_vendedor_em  DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversa_anuncio_comprador (anuncio_id, comprador_id),
  KEY ix_conversa_comprador (comprador_id),
  CONSTRAINT fk_conversa_anuncio   FOREIGN KEY (anuncio_id)   REFERENCES anuncio (id) ON DELETE CASCADE,
  CONSTRAINT fk_conversa_comprador FOREIGN KEY (comprador_id) REFERENCES usuario (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mensagem (
  id           INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  conversa_id  INT UNSIGNED   NOT NULL,
  remetente_id INT UNSIGNED   NOT NULL,
  texto        VARCHAR(1000)  NOT NULL,                              -- vazio quando a mensagem é só a foto
  foto         CHAR(32)       NULL,                                  -- nome do arquivo da foto (sem tamanho e sem .webp)
  video        VARCHAR(40)    NULL,                                  -- nome do arquivo do vídeo, com a extensão (mp4, webm ou mov)
  enviada_em   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lida         BOOLEAN        NOT NULL DEFAULT FALSE,
  entregue_em  DATETIME       NULL,                                  -- chegou no aparelho de quem recebe (site aberto)
  editada_em   DATETIME       NULL,                                  -- quando o texto foi editado (até 15 min depois de enviar)
  apagada_em   DATETIME       NULL,                                  -- "apagar para todos": o texto e a foto saem
  PRIMARY KEY (id),
  KEY ix_mensagem_conversa (conversa_id, id),
  CONSTRAINT fk_mensagem_conversa  FOREIGN KEY (conversa_id)  REFERENCES conversa (id) ON DELETE CASCADE,
  CONSTRAINT fk_mensagem_remetente FOREIGN KEY (remetente_id) REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT ck_mensagem_texto CHECK (TRIM(texto) <> '' OR foto IS NOT NULL OR video IS NOT NULL OR apagada_em IS NOT NULL),   -- precisa ter texto, foto ou vídeo (a apagada fica vazia)
  CONSTRAINT ck_mensagem_foto  CHECK (foto IS NULL OR foto REGEXP '^[a-f0-9]{32}$'),
  CONSTRAINT ck_mensagem_video CHECK (video IS NULL OR video REGEXP '^[a-f0-9]{32}[.](mp4|webm|mov)$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "Apagar para mim": a mensagem some só para quem apagou; a outra pessoa continua vendo.
CREATE TABLE mensagem_oculta (
  mensagem_id  INT UNSIGNED   NOT NULL,
  usuario_id   INT UNSIGNED   NOT NULL,
  ocultada_em  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (mensagem_id, usuario_id),
  KEY ix_mensagem_oculta_usuario (usuario_id),
  CONSTRAINT fk_mensagem_oculta_mensagem FOREIGN KEY (mensagem_id) REFERENCES mensagem (id) ON DELETE CASCADE,
  CONSTRAINT fk_mensagem_oculta_usuario  FOREIGN KEY (usuario_id)  REFERENCES usuario (id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Avaliação do vendedor, feita por quem comprou. Fica guardada mesmo se o anúncio for excluído
-- (conversa_id vira NULL), para o vendedor não apagar uma nota ruim excluindo o anúncio.
CREATE TABLE avaliacao (
  id             INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  conversa_id    INT UNSIGNED      NULL,
  avaliador_id   INT UNSIGNED      NOT NULL,
  avaliado_id    INT UNSIGNED      NOT NULL,
  anuncio_titulo VARCHAR(80)       NOT NULL,
  nota           TINYINT UNSIGNED  NOT NULL,
  qualidades     VARCHAR(120)      NULL,                    -- pontos fortes marcados, separados por vírgula (ex.: respondeu_rapido,pontual)
  comentario     VARCHAR(300)      NULL,
  criado_em      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_avaliacao_conversa_avaliador (conversa_id, avaliador_id),
  KEY ix_avaliacao_avaliado_data (avaliado_id, criado_em, id),
  CONSTRAINT fk_avaliacao_conversa  FOREIGN KEY (conversa_id)  REFERENCES conversa (id) ON DELETE SET NULL,
  CONSTRAINT fk_avaliacao_avaliador FOREIGN KEY (avaliador_id) REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT fk_avaliacao_avaliado  FOREIGN KEY (avaliado_id)  REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT ck_avaliacao_nota     CHECK (nota BETWEEN 1 AND 5),
  CONSTRAINT ck_avaliacao_usuarios CHECK (avaliador_id <> avaliado_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Denúncia de um usuário feita por quem conversa com ele. Fica guardada para a equipe analisar,
-- mesmo se a conversa for apagada (conversa_id vira NULL). Uma denúncia por pessoa em cada conversa.
CREATE TABLE denuncia (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  conversa_id    INT UNSIGNED  NULL,
  denunciante_id INT UNSIGNED  NOT NULL,
  denunciado_id  INT UNSIGNED  NOT NULL,
  motivo         VARCHAR(20)   NOT NULL,
  descricao      VARCHAR(500)  NULL,
  situacao       VARCHAR(12)   NOT NULL DEFAULT 'aberta',
  criada_em      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_denuncia_conversa_denunciante (conversa_id, denunciante_id),
  KEY ix_denuncia_denunciado (denunciado_id, criada_em),
  KEY ix_denuncia_situacao (situacao, criada_em),
  CONSTRAINT fk_denuncia_conversa    FOREIGN KEY (conversa_id)    REFERENCES conversa (id) ON DELETE SET NULL,
  CONSTRAINT fk_denuncia_denunciante FOREIGN KEY (denunciante_id) REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT fk_denuncia_denunciado  FOREIGN KEY (denunciado_id)  REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT ck_denuncia_motivo   CHECK (motivo IN ('golpe', 'ofensa', 'spam', 'proibido', 'perfil_falso', 'outro')),
  CONSTRAINT ck_denuncia_situacao CHECK (situacao IN ('aberta', 'analisada')),
  CONSTRAINT ck_denuncia_usuarios CHECK (denunciante_id <> denunciado_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compromisso nas entregas: depois da venda, cada lado diz se o outro apareceu no combinado.
-- Fica guardado mesmo se o anúncio for excluído (conversa_id vira NULL), como a avaliação.
CREATE TABLE comparecimento (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversa_id  INT UNSIGNED NULL,
  avaliador_id INT UNSIGNED NOT NULL,
  avaliado_id  INT UNSIGNED NOT NULL,
  compareceu   BOOLEAN      NOT NULL,
  criado_em    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_comparecimento_conversa_avaliador (conversa_id, avaliador_id),
  KEY ix_comparecimento_avaliado (avaliado_id),
  CONSTRAINT fk_comparecimento_conversa  FOREIGN KEY (conversa_id)  REFERENCES conversa (id) ON DELETE SET NULL,
  CONSTRAINT fk_comparecimento_avaliador FOREIGN KEY (avaliador_id) REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT fk_comparecimento_avaliado  FOREIGN KEY (avaliado_id)  REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT ck_comparecimento_usuarios CHECK (avaliador_id <> avaliado_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Procura-se: o comprador diz o que quer e até quanto paga. Quando alguém publica um anúncio
-- compatível na cidade dele, os dois são avisados no sininho.
CREATE TABLE procura (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  usuario_id   INT UNSIGNED  NOT NULL,
  titulo       VARCHAR(80)   NOT NULL,
  categoria_id INT UNSIGNED  NULL,
  bairro_id    INT UNSIGNED  NOT NULL,
  preco_max    DECIMAL(10,2) NULL,
  criada_em    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_procura_criada (criada_em, id),
  KEY ix_procura_usuario (usuario_id),
  CONSTRAINT fk_procura_usuario   FOREIGN KEY (usuario_id)   REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT fk_procura_categoria FOREIGN KEY (categoria_id) REFERENCES categoria (id),
  CONSTRAINT fk_procura_bairro    FOREIGN KEY (bairro_id)    REFERENCES bairro (id),
  CONSTRAINT ck_procura_titulo CHECK (TRIM(titulo) <> ''),
  CONSTRAINT ck_procura_preco  CHECK (preco_max IS NULL OR preco_max > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Avisos do sininho (o histórico fica aqui; o push e o Socket.IO só entregam)
CREATE TABLE notificacao (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED  NOT NULL,
  tipo       ENUM('novo_anuncio', 'nova_avaliacao', 'procura_atendida') NOT NULL,
  anuncio_id INT UNSIGNED  NULL,
  titulo     VARCHAR(120)  NOT NULL,
  texto      VARCHAR(255)  NOT NULL,
  lida       BOOLEAN       NOT NULL DEFAULT FALSE,
  criada_em  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_notificacao_usuario (usuario_id, lida, id),
  CONSTRAINT fk_notificacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT fk_notificacao_anuncio FOREIGN KEY (anuncio_id) REFERENCES anuncio (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Aparelhos que aceitaram notificação push (Web Push). Sair da conta apaga a do aparelho.
CREATE TABLE inscricao_push (
  id            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  usuario_id    INT UNSIGNED   NOT NULL,
  endpoint      VARCHAR(1000)  NOT NULL,
  endpoint_hash CHAR(64)       NOT NULL,   -- SHA-256 do endpoint (o endpoint é longo demais para índice)
  p256dh        VARCHAR(200)   NOT NULL,
  auth          VARCHAR(100)   NOT NULL,
  criada_em     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inscricao_push_endpoint (endpoint_hash),
  KEY ix_inscricao_push_usuario (usuario_id),
  CONSTRAINT fk_inscricao_push_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
