# Back-end (API) do DesapegaUai

Node.js + Express + MySQL.

## Como rodar

1. Copie o `.env.example` para `.env`, preencha o usuário e a senha do seu MySQL e gere o seu `JWT_SEGREDO` (o comando está no próprio `.env.example`).
2. `npm install`
3. `npm run banco`: cria as tabelas e os dados de teste. Também dá para rodar o `database/schema.sql` e depois o `database/seed.sql` no Workbench.
4. `npm run dev` e abra <http://localhost:3333/api/saude>. Tem que aparecer `{"api":"ok","banco":"ok"}`.

No Windows, se o PowerShell disser que "a execução de scripts foi desabilitada", rode uma vez:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

## Como testar

- `npm test`: testes automáticos. Rode `npm run banco` antes.
- Login de teste: `POST /api/auth/teste` com `{ "usuario_id": 1 }` (1 Diego, 2 Larissa, 3 Usuário Teste). Os pedidos seguintes já vão com o cookie do login.
- Pedidos prontos: `test/api.http` (extensão REST Client do VS Code) e a coleção do Postman em `test/DesapegaUai - API (Rhayane)/`.
- Rota que ainda responde `501 Ainda não implementado.` é rota que falta fazer.

## Rotas

| Rota | Login | Quem faz |
| --- | --- | --- |
| `GET /api/saude` | não | pronta |
| `POST /api/auth/google` | não | Rhayane |
| `GET /api/auth/sessao` | opcional | Rhayane |
| `POST /api/auth/logout` | não | Rhayane |
| `POST /api/auth/teste` | só em desenvolvimento | Rhayane |
| `GET /api/perfil` | sim | Rhayane |
| `PUT /api/perfil` | sim | Rhayane |
| `GET /api/categorias` | não | Rhayane |
| `GET /api/cidades` | não | Rhayane |
| `GET /api/cidades/:id/bairros` | não | Rhayane |
| `GET /api/anuncios` (busca) | opcional | Anthony |
| `GET /api/anuncios/:id` | opcional | Marina |
| `POST /api/anuncios` | sim | Marina |
| `PUT /api/anuncios/:id` | dono | Marina |
| `PATCH /api/anuncios/:id/status` | dono | Marina |
| `DELETE /api/anuncios/:id` | dono | Marina |
| `POST /api/anuncios/:id/fotos` | dono | Marina |
| `DELETE /api/anuncios/:id/fotos/:fotoId` | dono | Marina |
| `GET /api/meus-anuncios` | sim | Marina |
| `GET /api/favoritos` | sim | Marina |
| `POST /api/favoritos/:anuncioId` | sim | Marina |
| `DELETE /api/favoritos/:anuncioId` | sim | Marina |
| `POST /api/conversas` | sim | Anthony |
| `GET /api/conversas` | sim | Anthony |
| `GET /api/conversas/nao-lidas` | sim | Anthony |
| `GET /api/conversas/:id/mensagens` | participante | Anthony |
| `POST /api/conversas/:id/mensagens` | participante | Anthony |

As fotos ficam em `/api/uploads/anuncios/<id do anúncio>/<arquivo>-400.webp` (e `-800`, `-1600`).

## Caminho de uma requisição

```
routes/  -> controllers/  -> models/
(URL)       (regra: valida,   (SQL no banco)
            decide e responde)
```

## Onde fica cada coisa

| Pasta | O que vai nela |
| --- | --- |
| `src/routes/` | Um arquivo de rotas por módulo, todos já ligados no `routes/index.js`. |
| `src/controllers/` | Um arquivo por módulo, com uma função para cada rota. |
| `src/models/` | As consultas SQL. |
| `src/middlewares/` | Login (`autenticacao.js`), fotos (`upload.js`) e tratamento de erros (`erros.js`). |
| `src/config/` | Leitura do `.env` (`env.js`) e conexão com o MySQL (`db.js`). |
| `src/utils/` | Funções de apoio: `erroHttp`, `validacao`, `token` e `fotos`. |
| `database/` | `schema.sql` (tabelas), `seed.sql` (dados iniciais) e o script do `npm run banco`. |
| `test/` | Testes automáticos e os pedidos prontos para o REST Client e o Postman. |

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Roda a API e reinicia sozinha quando um arquivo muda |
| `npm start` | Roda a API sem reiniciar (produção) |
| `npm run banco` | Apaga e recria as tabelas do banco do `.env` com os dados de teste. Só em desenvolvimento |
| `npm test` | Roda os testes automáticos |

## Combinados

- Toda rota começa com `/api`.
- As respostas são em JSON, e todo erro sai no formato `{ "erro": "mensagem" }`.
- No SQL, os valores vão sempre pelo `?`: `db.query('SELECT * FROM anuncio WHERE id = ?', [id])`. Nunca junte texto que veio do usuário dentro da SQL.
- Senhas e chaves ficam só no `.env`, nunca no código.
