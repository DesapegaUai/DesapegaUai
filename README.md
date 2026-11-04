# DesapegaUai

**Compre • Venda • Desapegue**

Plataforma web de classificados locais (um marketplace C2C hiperlocal) para Viçosa e a Zona da Mata mineira. Projeto de Extensão com o tema Cidades Inteligentes.

**Relatório do projeto:** [RELATORIO.md](RELATORIO.md)

## Tecnologias

| Parte | Tecnologia | Pasta |
| --- | --- | --- |
| Front-end | React + Vite | `frontend/` |
| Back-end (API) | Node.js + Express | `backend/` |
| Banco de dados | MySQL | `backend/database/` |

## Estrutura

```
desapegauai/
├── frontend/              equipe do front-end
│   ├── public/            logo e favicon
│   └── src/
│       ├── pages/         telas do site (uma por arquivo)
│       ├── components/    partes reutilizáveis (cabeçalho, card de anúncio...)
│       ├── services/      chamadas para a API (api.js)
│       ├── contexts/      estado compartilhado (ex.: usuário logado)
│       ├── hooks/         hooks próprios
│       ├── styles/        CSS global e cores da marca
│       └── assets/        imagens e ícones
├── backend/               equipe do back-end
│   ├── database/          scripts SQL do banco
│   └── src/
│       ├── routes/        endereços da API
│       ├── controllers/   o que cada rota faz
│       ├── models/        consultas ao banco (SQL)
│       ├── middlewares/   funções que rodam antes das rotas (login, erros)
│       ├── config/        leitura do .env e conexão com o banco
│       └── utils/         funções de apoio
├── RELATORIO.md
└── README.md
```

Cada pasta tem o seu README com mais detalhes: [frontend](frontend/README.md) e [backend](backend/README.md).

## O que precisa ter instalado

- [Node.js](https://nodejs.org) na versão LTS (no mínimo a 22.22)
- MySQL 8 ou o MySQL/MariaDB do XAMPP
- Git

## Como rodar no seu computador

1. Clone o repositório (o link está no botão **Code** do GitHub):

   ```bash
   git clone https://github.com/DesapegaUai/DesapegaUai.git
   cd DesapegaUai
   ```

2. No MySQL, crie o banco vazio:

   ```sql
   CREATE DATABASE desapegauai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. Rode o back-end (terminal 1):

   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run dev
   ```

   Depois de copiar, abra o `backend/.env` e coloque o usuário e a senha do seu MySQL. No XAMPP, normalmente é `root` sem senha, então dá para deixar como está.

   Para testar, abra <http://localhost:3333/api/saude>. Tem que aparecer `{"api":"ok","banco":"ok"}`.

4. Rode o front-end (terminal 2):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Abra <http://localhost:5173>. Tem que aparecer **Status: API e banco conectados**.

> Se aparecer `"banco":"sem conexão"`, confira o usuário, a senha e o nome do banco no `backend/.env`.

## Como a equipe trabalha

- **Cada equipe mexe só na sua pasta:** o front-end em `frontend/` e o back-end em `backend/`.
- **Ninguém trabalha direto na `main`.** Para cada tarefa, crie uma branch a partir da `main` atualizada:

  ```bash
  git checkout main
  git pull
  git checkout -b front/pagina-inicial
  ```

  Use o prefixo da sua equipe no nome: `front/...` ou `back/...`.

- Faça commits pequenos, com mensagem que diz o que mudou: `feat: cria a página inicial`, `fix: corrige o filtro de preço`, `docs: atualiza o README`.
- Ao terminar, envie a branch com `git push -u origin nome-da-branch` e abra um **Pull Request** para a `main`. Outra pessoa revisa antes do merge.
- Antes de implementar uma rota da API, as duas equipes combinam o endereço, o que ela recebe e o que ela devolve.
- O `.env` nunca vai para o GitHub (ele já está no `.gitignore`). Só o `.env.example` vai.

## Equipe

| Nome | Equipe | GitHub |
| --- | --- | --- |
| Rhayane de Freitas Eloi |  | [@devrhayaneads-maker](https://github.com/devrhayaneads-maker) |
|  |  |  |
|  |  |  |
|  |  |  |
