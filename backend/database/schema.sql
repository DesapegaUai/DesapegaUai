-- Estrutura do banco do DesapegaUai (MySQL)
-- Apaga e recria as tabelas. Depois rode o seed.sql (ou use npm run banco, que roda os dois).
-- Só a Rhayane altera este arquivo.

USE desapegauai;
SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS mensagem, conversa, favorito, foto_anuncio, anuncio,
  subcategoria, categoria, usuario, bairro, cidade;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE cidade (
  id        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome      VARCHAR(80)   NOT NULL,
  uf        CHAR(2)       NOT NULL DEFAULT 'MG',
  latitude  DECIMAL(9,6)  NOT NULL,   -- centro da cidade
  longitude DECIMAL(9,6)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cidade_nome_uf (nome, uf)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bairro (
  id        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  cidade_id INT UNSIGNED  NOT NULL,
  nome      VARCHAR(80)   NOT NULL,
  latitude  DECIMAL(9,6)  NOT NULL,
  longitude DECIMAL(9,6)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bairro_cidade_nome (cidade_id, nome),
  CONSTRAINT fk_bairro_cidade FOREIGN KEY (cidade_id) REFERENCES cidade (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE usuario (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  google_id     VARCHAR(255)  NOT NULL,   -- "sub" do token do Google
  nome          VARCHAR(120)  NOT NULL,
  email         VARCHAR(255)  NOT NULL,
  foto_url      VARCHAR(500)  NULL,
  telefone      VARCHAR(20)   NULL,       -- só números
  bio           VARCHAR(300)  NULL,
  criado_em     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acesso DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_google_id (google_id),
  UNIQUE KEY uq_usuario_email (email),
  CONSTRAINT ck_usuario_telefone CHECK (telefone REGEXP '^[0-9]{10,11}$')
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
  categoria_id    INT UNSIGNED   NOT NULL,
  subcategoria_id INT UNSIGNED   NULL,
  bairro_id       INT UNSIGNED   NOT NULL,
  titulo          VARCHAR(80)    NOT NULL,
  descricao       VARCHAR(1000)  NULL,
  preco           DECIMAL(10,2)  NOT NULL,
  condicao        ENUM('novo', 'seminovo', 'usado') NULL,   -- NULL só em Serviços
  forma_entrega   ENUM('retirada', 'combinar')       NOT NULL,
  localizacao     VARCHAR(120)   NULL,
  status          ENUM('ativo', 'vendido')           NOT NULL DEFAULT 'ativo',
  visualizacoes   INT UNSIGNED   NOT NULL DEFAULT 0,
  data_publicacao DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  CONSTRAINT ck_anuncio_titulo CHECK (TRIM(titulo) <> '')
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
  texto        VARCHAR(1000)  NOT NULL,
  enviada_em   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lida         BOOLEAN        NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  KEY ix_mensagem_conversa (conversa_id, id),
  CONSTRAINT fk_mensagem_conversa  FOREIGN KEY (conversa_id)  REFERENCES conversa (id) ON DELETE CASCADE,
  CONSTRAINT fk_mensagem_remetente FOREIGN KEY (remetente_id) REFERENCES usuario (id) ON DELETE CASCADE,
  CONSTRAINT ck_mensagem_texto CHECK (TRIM(texto) <> '')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
