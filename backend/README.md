# Back-end (API) do DesapegaUai

Node.js + Express + MySQL. Para rodar:

1. Copie o `.env.example` para `.env` e preencha os dados do seu MySQL.
2. Rode `npm install` e depois `npm run dev`.
3. Teste em <http://localhost:3333/api/saude>.

## Caminho de uma requisição

```
routes/  →  controllers/  →  models/
(URL)       (regra: valida,   (SQL no banco)
            decide e responde)
```

O exemplo que já funciona é o `GET /api/saude`: `routes/index.js` chama `controllers/saudeController.js`.

## Onde fica cada coisa

| Pasta | O que vai nela |
| --- | --- |
| `src/routes/` | Um arquivo de rotas por módulo (ex.: `anuncioRoutes.js`), ligado no `routes/index.js`. |
| `src/controllers/` | Um arquivo por módulo, com uma função para cada rota. |
| `src/models/` | Um arquivo por tabela, com as consultas SQL. |
| `src/middlewares/` | Funções que rodam antes das rotas (ex.: exigir login). O tratamento de erros já está pronto no `erros.js`. |
| `src/config/` | Leitura do `.env` (`env.js`) e conexão com o MySQL (`db.js`). |
| `src/utils/` | Funções de apoio usadas em vários lugares. |
| `database/` | Scripts SQL do banco (ex.: `schema.sql` com as tabelas). |
| `src/app.js` | Monta o Express: segurança, CORS, JSON e rotas. |
| `src/server.js` | Liga a API na porta do `.env`. |

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Roda a API e reinicia sozinha quando um arquivo muda |
| `npm start` | Roda a API sem reiniciar (produção) |

## Combinados

- Toda rota começa com `/api`.
- As respostas são em JSON, e todo erro sai no formato `{ "erro": "mensagem" }`.
- No SQL, os valores vão sempre pelo `?`: `db.query('SELECT * FROM anuncio WHERE id = ?', [id])`. Nunca junte texto que veio do usuário dentro da SQL.
- Senhas e chaves ficam só no `.env`, nunca no código.
