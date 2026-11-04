# Front-end do DesapegaUai

React + Vite. Para rodar: `npm install` e depois `npm run dev`. O site abre em <http://localhost:5173>.

A API precisa estar rodando junto (veja o [README da raiz](../README.md)). Em desenvolvimento, o Vite repassa tudo o que começa com `/api` para o back-end (`vite.config.js`).

## Onde fica cada coisa

| Pasta | O que vai nela |
| --- | --- |
| `src/pages/` | Uma tela por arquivo (`Inicio.jsx`, `Favoritos.jsx`...). Toda tela nova entra nas rotas do `src/App.jsx`. |
| `src/components/` | Partes que se repetem entre as telas: cabeçalho, rodapé, card de anúncio, botões. |
| `src/services/api.js` | Chamadas para o back-end: `api.get('/rota')`, `api.post('/rota', dados)`. |
| `src/contexts/` | Estado compartilhado entre as telas (ex.: usuário logado). |
| `src/hooks/` | Hooks próprios (`useAlgumaCoisa.js`). |
| `src/styles/global.css` | CSS global e as cores da marca em variáveis (`var(--cor-principal)`). |
| `src/assets/` | Imagens e ícones usados no código. |
| `public/` | Arquivos usados como estão, sem passar pelo código (logo, favicon). |

A `Inicio.jsx` que está aí é provisória: ela só confere se o front está falando com a API. Podem trocar pela Home do Figma.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Roda o site em modo de desenvolvimento |
| `npm run build` | Gera a versão final na pasta `dist/` |
| `npm run preview` | Abre a versão final gerada pelo build |
| `npm run lint` | Procura erros no código |

## Combinados

- Componentes e páginas com nome em PascalCase: `CardAnuncio.jsx`, `MeusAnuncios.jsx`.
- A API é chamada sempre pelo `services/api.js`, nunca com `fetch` direto nas telas.
- Cores pelas variáveis do `global.css`, sem repetir o código da cor em cada arquivo.
