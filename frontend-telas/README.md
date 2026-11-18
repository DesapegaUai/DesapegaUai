# DesapegaUai — Front-end (React + Vite)

Marketplace de desapego de Viçosa (MG) e região.
Este pacote traz as telas de **Categorias**, **Favoritos**, **Conversas (chat)** e **Perfil**, feitas a partir do protótipo oficial (`08-prototipos/prototipo-html/`) com as medidas de `05-telas/` — computador (1440), tablet (834) e celular (390).

## Como rodar

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo.

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente http://localhost:5173).

| Comando | Para quê |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | gera a versão final em `dist/` |
| `npm run preview` | abre a versão de `dist/` para conferir |

## Telas e rotas

| Tela | Rota | Protótipo |
|---|---|---|
| Casa | `/categoria/casa` | 01-casa |
| Eletrônicos | `/categoria/eletronicos` | 02-eletronicos |
| Moda | `/categoria/moda` | 03-moda |
| Veículos | `/categoria/veiculos` | 04-veiculos |
| Livros | `/categoria/livros` | 05-livros |
| Games | `/categoria/games` | 06-games |
| Serviços | `/categoria/servicos` | 07-servicos |
| Favoritos | `/favoritos` | 09-favoritos |
| Conversas | `/conversas` e `/conversas/:id` | 10-conversas, 10b-conversa-aberta |
| Meu perfil | `/perfil` | 11-perfil |

`/` abre Casa por enquanto — no projeto final, `/` é a **Home do Henrique**.

## O que funciona

- **Responsivo** nos 3 tamanhos, com os pontos de quebra do projeto: `max-width: 1024px` (tablet) e `max-width: 600px` (celular).
- **Categorias:** chips de subcategoria, filtros (preço, tipo, condição, bairro, distância), ordenação, paginação, favoritar. No tablet os filtros abrem numa gaveta à direita; no celular, em tela cheia.
- **Favoritos:** listas (todos / salvos recentemente / alertas de preço), filtro por categoria, ordenação, remover com “Desfazer”.
- **Conversas:** busca, filtros (todas / não lidas / vendendo), marcar como lida, enviar mensagem (Enter envia, Shift+Enter quebra linha), respostas rápidas e:
  - **Emoji** — botão 🙂 dentro do campo, com 4 grupos; o emoji entra onde está o cursor.
  - **Anexar arquivos** — botão 📎: fotos, vídeos, PDF, Word, Excel, PowerPoint, TXT e ZIP; até 5 por mensagem, 10 MB cada, com prévia antes de enviar.
  - **Tirar foto** — botão 📷 ao lado do 📎: no computador abre uma janela com a webcam ao vivo (tirar, conferir, “Tirar outra” ou “Anexar foto”; troca de câmera quando houver mais de uma); no celular/tablet abre a câmera do próprio aparelho. A foto entra nos anexos (JPEG, mesmos limites) e vai junto com a mensagem. Se a câmera for bloqueada ou não existir, a janela explica e oferece “Escolher uma foto”. A câmera do navegador só funciona em `localhost` ou `https`.
  - No celular: lista **ou** conversa, com botão de voltar.
- **Perfil:** layout de painel com menu lateral (260 px no computador, só ícones no tablet, menu inferior no celular), trocar foto, layout enxuto do celular (revisão de 26/10).
- **Menu ☰** abre o menu lateral em qualquer tela; a **lupa** do celular abre a busca.
- **Acessibilidade:** foco visível, Esc fecha gavetas e o painel de emojis, áreas de toque de 44 px, textos alternativos, `prefers-reduced-motion`.

## Estrutura

```
src/
├── main.jsx                 entrada (carrega a base do design system)
├── App.jsx                  rotas
├── paginas/                 uma tela por arquivo
│   ├── PaginaCategoria.jsx  modelo das 7 categorias (Casa.jsx, Moda.jsx… só passam o slug)
│   ├── Favoritos.jsx
│   ├── Conversas.jsx
│   └── Perfil.jsx
├── componentes/             peças reaproveitadas
│   ├── LayoutMarketplace.jsx  cabeçalho + abas + rodapé + botão "Anunciar"
│   ├── Cabecalho.jsx · AbasCategorias.jsx · Rodape.jsx · MenuLateral.jsx
│   ├── CardAnuncio.jsx · PainelFiltros.jsx · BarraChips.jsx · SeletorOrdem.jsx · Paginacao.jsx
│   ├── CaixaMensagem.jsx · SeletorEmoji.jsx     (chat)
│   └── Icone.jsx            todos os ícones (SVG do protótipo)
├── dados/                   dados de exemplo (trocar pela API)
├── estilos/                 CSS em português, como no protótipo
│   ├── base.css             tokens (--marca, --e4…), fonte, tipografia
│   ├── marketplace.css · rodape.css · menu-lateral.css
│   └── favoritos.css · conversas.css · perfil.css
├── utils/                   formatar preço/tamanho, media query, gaveta
└── assets/                  logos, fotos de exemplo, fonte Plus Jakarta Sans
```

## Juntando com a Home do Henrique

1. Copie `src/componentes`, `src/paginas`, `src/dados`, `src/estilos`, `src/utils` e `src/assets` para o projeto principal (se algum nome já existir, compare antes de substituir).
2. Importe `estilos/base.css` **antes** de qualquer outro CSS (no `main.jsx`).
3. Copie as rotas de `src/App.jsx` para o roteador do projeto e troque o `/` pela Home.
4. Precisa do `react-router-dom` 6 (`npm install react-router-dom@6`).
5. Se a Home já tiver cabeçalho/rodapé próprios, vale usar um só em todas as telas.

## Para o back-end

Os dados estão em `src/dados/`. Cada arquivo diz o que trocar:
- `anuncios.js` → `listarAnuncios(slug, { pagina, ordem, filtros })`: trocar por chamada à API mantendo o mesmo retorno.
- `conversas.js`, `favoritos.js`, `perfil.js` → dados do usuário logado.
- Procure por `TODO` no código: favoritar/remover, enviar mensagem e anexos (`anexos[].arquivo` é o `File`), trocar foto, sair.

## Decisões e pendências

- **Serviços:** no protótipo o contador veio vazio e o grupo de filtro “Valor” veio sem opções. Usei **58 anúncios** e **Por hora / Por serviço / A combinar** como provisórios (marcados com `ATENÇÃO` em `dados/anuncios.js`) — confirmar com o design.
- **Moda:** a tela foi feita à parte (pacote `DesapegaUai-Moda`) e entrou aqui usando o mesmo modelo das outras categorias — mesmo cabeçalho, abas, filtros, card e rodapé. Dela vieram os 6 anúncios, as 6 fotos (`assets/fotos/foto-exemplo-*.webp`), os chips de tamanho P/M/G/GG, o filtro “Tamanho” e o total de 246 anúncios (`dados/anuncios.js`).
- **Preços** seguem a regra de `10-especificacoes-tecnicas`: `R$ 450` (sem centavos quando inteiro). O protótipo do Perfil mostrava `R$ 450,00`.
- **Números** (favoritos, conversas, não lidas) são calculados a partir dos dados, então batem entre as telas.
- **Sem tela desenhada ainda** (botões já existem, sem ação): seletor de cidade, notificações, editar perfil, criar nova lista, menu “…” dos anúncios, ligar/denunciar no chat. Rotas que outras telas usam e ainda não existem neste pacote: `/anuncio/:id`, `/anunciar`, `/busca`, `/categoria/outros`.
- **Altura do chat:** cabe na tela (máximo 1006 px, a altura do protótipo) e as mensagens rolam por dentro, para a caixa de mensagem ficar sempre visível.

## Subir no GitHub

```bash
git init
git add .
git commit -m "Telas de categorias, favoritos, conversas e perfil"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

A pasta `node_modules` não vai para o GitHub (está no `.gitignore`); quem baixar roda `npm install`.
