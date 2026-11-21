# Back-end (API) do DesapegaUai

Node.js + Express + MySQL.

## Como rodar

1. Copie o `.env.example` para `.env`, preencha o usuário e a senha do seu MySQL e gere o seu `JWT_SEGREDO` (o comando está no próprio `.env.example`).
2. `npm install`
3. `npm run banco`: recria as tabelas e os dados de teste. Em um banco que já tem dados, use `npm run atualizar` para adicionar tabelas novas sem apagar nada.
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
| `DELETE /api/perfil` (excluir a conta e as fotos) | sim | Rhayane |
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
| `GET /api/usuarios/:id` | não | Rhayane |
| `POST /api/conversas` | sim | Anthony |
| `GET /api/conversas` | sim | Anthony |
| `GET /api/conversas/nao-lidas` | sim | Anthony |
| `DELETE /api/conversas/:id` | participante (some só para quem excluiu) | Rhayane |
| `GET /api/conversas/:id/mensagens` | participante | Anthony |
| `POST /api/conversas/:id/mensagens` | participante | Anthony |
| `POST /api/conversas/:id/fotos` | participante | Rhayane |
| `GET /api/conversas/:id/fotos/:arquivo` | participante | Rhayane |
| `GET /api/conversas/:id/denuncia` | participante | Rhayane |
| `POST /api/conversas/:id/denuncia` | participante | Rhayane |
| `GET /api/conversas/:id/comparecimento` | participante | Rhayane |
| `POST /api/conversas/:id/comparecimento` | participante, depois da venda | Rhayane |
| `GET /api/procuras` | opcional | Rhayane |
| `POST /api/procuras` | sim | Rhayane |
| `DELETE /api/procuras/:id` | dono | Rhayane |
| `GET /api/avaliacoes/usuarios/:id` | não | API |
| `GET /api/avaliacoes/minhas` | sim | API |
| `POST /api/avaliacoes/conversas/:id` | comprador após venda | API |

As fotos ficam em `/api/uploads/anuncios/<id do anúncio>/<arquivo>-400.webp` (e `-800`, `-1600`).

As fotos mandadas no chat são privadas: ficam em `backend/uploads-privados/` (fora da pasta pública) e só quem participa da conversa consegue abrir, por `GET /api/conversas/:id/fotos/<foto>-480.webp` (e `-1600`). O envio é `multipart/form-data` com até 5 imagens JPG, PNG ou WebP de até 8 MB no campo `fotos` e, se quiser, a legenda no campo `texto`. Cada foto vira uma mensagem com `foto: { pequena, grande }`.

A denúncia (`POST /api/conversas/:id/denuncia`) recebe `{ motivo, descricao }`, com `motivo` em `golpe`, `ofensa`, `spam`, `proibido`, `perfil_falso` ou `outro` (em `outro` a `descricao` é obrigatória). Fica na tabela `denuncia` com a situação `aberta`; cada pessoa denuncia uma vez por conversa.

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
| `npm run atualizar` | Adiciona tabelas e colunas novas em um banco que já tem dados, sem apagar nada |
| `npm run fotos` | Confere as fotos do disco com o banco e mostra arquivo sem registro e registro sem arquivo. Com `npm run fotos -- --apagar`, corrige |
| `npm test` | Roda os testes automáticos. Use um banco só para os testes |

## Exclusão de fotos

- Excluir uma foto, um anúncio ou a conta apaga o registro do banco e o arquivo do disco. Só o dono consegue.
- O registro sai primeiro e o arquivo depois. Se o disco falhar, o pedido termina bem, a falha vai para o log (`foto.arquivo_nao_apagado`) e o `npm run fotos -- --apagar` apaga o que sobrou.
- Arquivo que já não existe não é erro.
- Nos testes as fotos vão para uma pasta temporária. `PASTA_UPLOADS` e `PASTA_UPLOADS_PRIVADOS` no ambiente trocam o lugar das fotos.

## Combinados

- Toda rota começa com `/api`.
- As respostas são em JSON, e todo erro sai no formato `{ "erro": "mensagem" }`.
- No SQL, os valores vão sempre pelo `?`: `db.query('SELECT * FROM anuncio WHERE id = ?', [id])`. Nunca junte texto que veio do usuário dentro da SQL.
- Senhas e chaves ficam só no `.env`, nunca no código.
