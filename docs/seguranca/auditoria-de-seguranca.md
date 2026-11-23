# Auditoria de segurança e testes do DesapegaUai

Conferência feita em 21/11/2026, na versão que vai para o GitHub.

Este documento registra o que foi testado, o que foi aprovado e quais riscos ainda existem antes de publicar a plataforma. Cada cenário tem identificação, objetivo, requisição, resultado esperado, resultado obtido, evidência e status.

Um aviso importante: os números abaixo mostram que os cenários definidos passaram. Eles não provam que a aplicação está livre de falhas. A lista de riscos da seção 9 faz parte do resultado.

## 1. Resumo

| Conferência | Cenários | Aprovados | Reprovados |
| --- | --- | --- | --- |
| Autenticação | 12 | 12 | 0 |
| Autorização e IDOR | 19 | 19 | 0 |
| CSRF e CORS | 6 | 6 | 0 |
| XSS | 7 | 7 | 0 |
| Validação de dados | 8 | 8 | 0 |
| Upload de imagens | 9 | 9 | 0 |
| Exclusão de imagens | 9 | 9 | 0 |
| Privacidade | 6 | 6 | 0 |
| Geolocalização | 8 | 8 | 0 |
| Cabeçalhos HTTP | 7 | 7 | 0 |
| Limite de requisições | 8 | 8 | 0 |
| Desempenho e carga | 4 | 4 | 0 |
| **Total da auditoria de segurança** | **103** | **103** | **0** |

| Outras conferências | Resultado |
| --- | --- |
| SQL injection | 1.441 pedidos de ataque, nenhuma injeção funcionou |
| Testes automáticos da API (`npm test`) | 276 de 276 aprovados, em 28 arquivos |
| Testes de navegador (`npm run e2e`, Chrome) | 44 de 44 aprovados |
| Outros navegadores (seção 5) | 44 de 44 no Edge, no WebKit, no tablet e nos dois celulares; 43 de 44 no Firefox |
| Tempo de resposta (seção 7) | 24 rotas, 29 telas e 13 ações dentro do limite |
| Verificação do código do site (`npm run lint` e `npm run build`) | Sem erros |
| Dependências com falha conhecida (`npm audit`) | Nenhuma, na API e no site |

## 2. Como os testes foram feitos

- **Banco separado.** Tudo rodou no banco `desapegauai_conferencia`, recriado do zero com os dados de exemplo. O banco de desenvolvimento não foi usado.
- **Fotos separadas.** As fotos dos testes ficaram em pastas temporárias, fora das fotos do site.
- **Três APIs temporárias.** Uma em modo de desenvolvimento (com o login de teste), uma em modo de produção (`NODE_ENV=production`, para conferir cookie, cabeçalhos e limites como vão ficar no ar) e uma sem limite de pedidos, só para o teste de carga.
- **Site temporário** ligado na API de desenvolvimento, aberto no Chrome para os cenários de XSS.
- **Contas usadas:** Diego (id 1, dono dos anúncios de exemplo), Larissa (id 2, compradora da conversa 1) e Usuário Teste (id 3, que não participa da conversa 1). Nos cenários de autorização, uma conta sempre tenta mexer no que é da outra.
- **Evidência.** Cada cenário guarda o código HTTP e um trecho da resposta, ou a contagem no banco e no disco depois do pedido.
- **Ambiente:** Windows 11, Node.js 24, MySQL 8, Chrome, Edge, Firefox e WebKit (motor do Safari) pelo Playwright.

## 3. Cenários da auditoria de segurança

### 3.1 Autenticação

O login é só com a conta Google. A API confere a credencial com o Google e guarda a sessão em um cookie que o JavaScript da página não lê.

#### AUT-01
- **Objetivo:** Rotas da conta não respondem sem login.
- **Requisição:** GET /perfil, /meus-anuncios, /favoritos, /conversas, /notificacoes, /localizacao/atual; POST /procuras, /conversas, /anuncios; PUT /perfil (sem cookie)
- **Resultado esperado:** HTTP 401 em todas
- **Resultado obtido:** 13 de 13 rotas responderam 401
- **Evidência:** Códigos: 401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 401
- **Status:** Aprovado

#### AUT-02
- **Objetivo:** Token com a assinatura adulterada não vale.
- **Requisição:** GET /perfil com o cookie token forjado
- **Resultado esperado:** HTTP 401
- **Resultado obtido:** HTTP 401
- **Evidência:** HTTP 401 {"erro":"Faça login para continuar.","codigo":"NAO_AUTENTICADO","status":401}
- **Status:** Aprovado

#### AUT-03
- **Objetivo:** Token sem assinatura ("alg": "none") não vale.
- **Requisição:** GET /perfil com o cookie token forjado
- **Resultado esperado:** HTTP 401
- **Resultado obtido:** HTTP 401
- **Evidência:** HTTP 401 {"erro":"Faça login para continuar.","codigo":"NAO_AUTENTICADO","status":401}
- **Status:** Aprovado

#### AUT-04
- **Objetivo:** Token assinado com outro segredo não vale.
- **Requisição:** GET /perfil com o cookie token forjado
- **Resultado esperado:** HTTP 401
- **Resultado obtido:** HTTP 401
- **Evidência:** HTTP 401 {"erro":"Faça login para continuar.","codigo":"NAO_AUTENTICADO","status":401}
- **Status:** Aprovado

#### AUT-05
- **Objetivo:** Token vencido não vale.
- **Requisição:** GET /perfil com o cookie token forjado
- **Resultado esperado:** HTTP 401
- **Resultado obtido:** HTTP 401
- **Evidência:** HTTP 401 {"erro":"Faça login para continuar.","codigo":"NAO_AUTENTICADO","status":401}
- **Status:** Aprovado

#### AUT-06
- **Objetivo:** Token válido de uma conta que não existe não vale.
- **Requisição:** GET /perfil com o cookie token forjado
- **Resultado esperado:** HTTP 401
- **Resultado obtido:** HTTP 401
- **Evidência:** HTTP 401 {"erro":"Faça login para continuar.","codigo":"NAO_AUTENTICADO","status":401}
- **Status:** Aprovado

#### AUT-07
- **Objetivo:** Trocar o id dentro do token (sem reassinar) não dá acesso a outra conta.
- **Requisição:** GET /perfil com o cookie token forjado
- **Resultado esperado:** HTTP 401
- **Resultado obtido:** HTTP 401
- **Evidência:** HTTP 401 {"erro":"Faça login para continuar.","codigo":"NAO_AUTENTICADO","status":401}
- **Status:** Aprovado

#### AUT-08
- **Objetivo:** Login Google recusa credencial inventada ou ausente.
- **Requisição:** POST /auth/google com credential "abc", com um JWT forjado e sem o campo
- **Resultado esperado:** HTTP 401 ou 400, sem cookie de login
- **Resultado obtido:** HTTP 401, 401, 400; cookie criado: não
- **Evidência:** HTTP 401 {"erro":"Não foi possível confirmar o login com o Google. Tente de novo.","codigo":"NAO_AUTENTICADO","status":401}
- **Status:** Aprovado

#### AUT-09
- **Objetivo:** O cookie de login não pode ser lido por JavaScript nem enviado por outro site.
- **Requisição:** POST /auth/teste e leitura do cabeçalho Set-Cookie
- **Resultado esperado:** HttpOnly e SameSite=Lax
- **Resultado obtido:** HttpOnly: sim; SameSite=Lax: sim
- **Evidência:** token=(oculto); Max-Age=604800; Path=/; Expires=Sat, 28 Nov 2026 19:28:48 GMT; HttpOnly; SameSite=Lax
- **Status:** Aprovado

#### AUT-10
- **Objetivo:** Em produção o cookie só trafega por HTTPS.
- **Requisição:** POST /auth/logout na API em modo de produção e leitura do Set-Cookie
- **Resultado esperado:** Atributo Secure
- **Resultado obtido:** Secure: sim
- **Evidência:** HTTP 204 Set-Cookie: token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax
- **Status:** Aprovado

#### AUT-11
- **Objetivo:** O login de teste não existe em produção.
- **Requisição:** POST /auth/teste { usuario_id: 1 } na API em modo de produção
- **Resultado esperado:** Recusado (sem cookie de login)
- **Resultado obtido:** HTTP 404, sem cookie
- **Evidência:** HTTP 404 {"erro":"Rota não encontrada: POST /api/auth/teste","codigo":"NAO_ENCONTRADO","status":404}
- **Status:** Aprovado

#### AUT-12
- **Objetivo:** Depois de sair da conta, o token antigo deixa de valer.
- **Requisição:** POST /auth/logout e, em seguida, GET /perfil com o token de antes
- **Resultado esperado:** HTTP 401
- **Resultado obtido:** HTTP 401
- **Evidência:** HTTP 401 {"erro":"Faça login para continuar.","codigo":"NAO_AUTENTICADO","status":401}
- **Status:** Aprovado

### 3.2 Autorização e IDOR

Aqui a pergunta não é se o pedido é válido, e sim se quem pede é o dono. Em todos os cenários uma conta com login válido tenta ler, mudar ou apagar o que é de outra conta trocando o id.

#### IDOR-01
- **Objetivo:** Editar o anúncio de outra pessoa trocando o id.
- **Requisição:** PUT /anuncios/1 { titulo: "Invadido" } com a conta da Larissa (o anúncio é do Diego)
- **Resultado esperado:** HTTP 403 e nada muda
- **Resultado obtido:** HTTP 403; dado alheio intacto
- **Evidência:** HTTP 403 {"erro":"Você não tem permissão para alterar este anúncio.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-02
- **Objetivo:** Marcar como vendido ou reservado o anúncio de outra pessoa.
- **Requisição:** PATCH /anuncios/1/status { status: "vendido" } com a conta da Larissa
- **Resultado esperado:** HTTP 403 e nada muda
- **Resultado obtido:** HTTP 403; dado alheio intacto
- **Evidência:** HTTP 403 {"erro":"Você não tem permissão para alterar este anúncio.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-03
- **Objetivo:** Excluir o anúncio de outra pessoa.
- **Requisição:** DELETE /anuncios/1 com a conta da Larissa
- **Resultado esperado:** HTTP 403 e nada muda
- **Resultado obtido:** HTTP 403; dado alheio intacto
- **Evidência:** HTTP 403 {"erro":"Você não tem permissão para alterar este anúncio.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-04
- **Objetivo:** Enviar foto para o anúncio de outra pessoa.
- **Requisição:** POST /anuncios/1/fotos (multipart) com a conta da Larissa
- **Resultado esperado:** HTTP 403 e nada muda
- **Resultado obtido:** HTTP 403; dado alheio intacto
- **Evidência:** HTTP 403 {"erro":"Você não tem permissão para alterar este anúncio.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-05
- **Objetivo:** Mudar a localização do anúncio de outra pessoa.
- **Requisição:** PATCH /localizacao/anuncios/1 { origem: "bairro", bairro_id: 24 } com a conta da Larissa
- **Resultado esperado:** HTTP 403 e nada muda
- **Resultado obtido:** HTTP 403; dado alheio intacto
- **Evidência:** HTTP 403 {"erro":"Só o dono pode alterar a localização deste anúncio.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-06
- **Objetivo:** Ver o rascunho de outra pessoa.
- **Requisição:** GET /anuncios/12 com a conta da Larissa (rascunho do Diego)
- **Resultado esperado:** HTTP 404 e nada muda
- **Resultado obtido:** HTTP 404; dado alheio intacto
- **Evidência:** HTTP 404 {"erro":"Anúncio não encontrado.","codigo":"NAO_ENCONTRADO","status":404}
- **Status:** Aprovado

#### IDOR-07
- **Objetivo:** Ler as mensagens de uma conversa da qual não participo.
- **Requisição:** GET /conversas/1/mensagens com a conta do Usuário Teste
- **Resultado esperado:** HTTP 403 e nada muda
- **Resultado obtido:** HTTP 403; dado alheio intacto
- **Evidência:** HTTP 403 {"erro":"Você não participa desta conversa.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-08
- **Objetivo:** Escrever em uma conversa da qual não participo.
- **Requisição:** POST /conversas/1/mensagens { texto } com a conta do Usuário Teste
- **Resultado esperado:** HTTP 403 e nada muda
- **Resultado obtido:** HTTP 403; dado alheio intacto
- **Evidência:** HTTP 403 {"erro":"Você não participa desta conversa.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-09
- **Objetivo:** Mandar foto em uma conversa da qual não participo.
- **Requisição:** POST /conversas/1/fotos (multipart) com a conta do Usuário Teste
- **Resultado esperado:** HTTP 403 e nada muda
- **Resultado obtido:** HTTP 403; dado alheio intacto
- **Evidência:** HTTP 403 {"erro":"Você não participa desta conversa.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-10
- **Objetivo:** Abrir a foto de um chat do qual não participo, sabendo o endereço dela.
- **Requisição:** A Larissa envia uma foto na conversa 1; o Usuário Teste e um visitante pedem GET /conversas/1/fotos/&lt;arquivo&gt;
- **Resultado esperado:** HTTP 403 para quem não participa e 401 sem login; 200 para quem participa
- **Resultado obtido:** De fora: HTTP 403; sem login: HTTP 401; participante: HTTP 200
- **Evidência:** /conversas/1/fotos/142ed009316d460a99e293e680fdccd3-1600.webp -&gt; HTTP 403 {"erro":"Você não participa desta conversa.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-11
- **Objetivo:** Tirar da lista a conversa de outras pessoas.
- **Requisição:** DELETE /conversas/1 com a conta do Usuário Teste
- **Resultado esperado:** HTTP 403 ou 404 e nada muda
- **Resultado obtido:** HTTP 403; dado alheio intacto
- **Evidência:** HTTP 403 {"erro":"Você não participa desta conversa.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-12
- **Objetivo:** Denunciar por uma conversa da qual não participo.
- **Requisição:** POST /conversas/1/denuncia { motivo: "golpe" } com a conta do Usuário Teste
- **Resultado esperado:** HTTP 403 ou 404 e nada muda
- **Resultado obtido:** HTTP 403; dado alheio intacto
- **Evidência:** HTTP 403 {"erro":"Você não participa desta conversa.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-13
- **Objetivo:** Avaliar um vendedor por uma conversa que não é minha.
- **Requisição:** POST /avaliacoes/conversas/1 { nota: 1 } com a conta do Usuário Teste
- **Resultado esperado:** HTTP 403 ou 404 ou 409 e nada muda
- **Resultado obtido:** HTTP 403; dado alheio intacto
- **Evidência:** HTTP 403 {"erro":"Somente quem comprou pode avaliar esta negociação.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-14
- **Objetivo:** Responder ao compromisso de uma conversa que não é minha.
- **Requisição:** POST /conversas/1/comparecimento { compareceu: false } com a conta do Usuário Teste
- **Resultado esperado:** HTTP 403 e nada muda
- **Resultado obtido:** HTTP 403; dado alheio intacto
- **Evidência:** HTTP 403 {"erro":"Você não participa desta conversa.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-15
- **Objetivo:** Excluir o pedido do Procura-se de outra pessoa.
- **Requisição:** A Larissa publica um pedido; o Usuário Teste chama DELETE /procuras/&lt;id&gt;
- **Resultado esperado:** HTTP 403 e o pedido continua lá
- **Resultado obtido:** HTTP 403; pedido intacto
- **Evidência:** HTTP 403 {"erro":"Só quem publicou pode excluir este pedido.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IDOR-16
- **Objetivo:** Marcar como lido o aviso de outra pessoa passando o id dele.
- **Requisição:** Aviso criado para o Diego; a Larissa chama PATCH /notificacoes/lidas { ids: [&lt;id&gt;] }
- **Resultado esperado:** O aviso do Diego continua não lido
- **Resultado obtido:** HTTP 200; aviso do Diego continua não lido
- **Evidência:** HTTP 200 {"nao_lidas":0}
- **Status:** Aprovado

#### IDOR-17
- **Objetivo:** Listas pessoais não aceitam o id de outra conta.
- **Requisição:** GET /meus-anuncios?usuario_id=1 e GET /favoritos?usuario_id=2 com a conta do Usuário Teste
- **Resultado esperado:** Só os dados da própria conta
- **Resultado obtido:** Anúncios do Diego na resposta: 0; favoritos da Larissa na resposta: 0
- **Evidência:** HTTP 200 com 0 anúncio(s) da própria conta
- **Status:** Aprovado

#### IDOR-18
- **Objetivo:** Editar o perfil de outra pessoa mandando o id dela no corpo.
- **Requisição:** PUT /perfil { id: 1, usuario_id: 1, nome: "Invadido" } com a conta do Usuário Teste
- **Resultado esperado:** Só o próprio perfil muda
- **Resultado obtido:** Nome do Diego no banco: Diego Martins
- **Evidência:** HTTP 200 {"id":3,"nome":"Invadido","email":"usuario.teste@example.com","foto_url":null,"telefone":null,"bio":null,"criado_em":"2026-11-16T16:28:40.000Z","ultim
- **Status:** Aprovado

#### IDOR-19
- **Objetivo:** Mandar mensagem pelo tempo real em uma conversa da qual não participo.
- **Requisição:** Socket.IO: evento enviar_mensagem { conversa_id: 1 } com a conta do Usuário Teste
- **Resultado esperado:** Recusado, sem gravar a mensagem
- **Resultado obtido:** Resposta: recusado; mensagem gravada: não
- **Evidência:** {"ok":false,"erro":"Você não participa desta conversa."}
- **Status:** Aprovado

### 3.3 CSRF e CORS

#### CSRF-01
- **Objetivo:** Outro site não consegue gravar usando o login de quem está navegando.
- **Requisição:** POST /procuras, PUT /perfil, PATCH /anuncios/1/status e DELETE /anuncios/1 com o cookie do Diego e Origin: https://site-malicioso.example
- **Resultado esperado:** HTTP 403 (ORIGEM_NAO_PERMITIDA) e nada muda
- **Resultado obtido:** HTTP 403, 403, 403, 403; dados intactos
- **Evidência:** HTTP 403 {"erro":"Pedido de outra origem recusado.","codigo":"ORIGEM_NAO_PERMITIDA","status":403}
- **Status:** Aprovado

#### CSRF-02
- **Objetivo:** Formulário HTML comum de outro site (sem JSON) não grava nada.
- **Requisição:** POST /procuras com Content-Type application/x-www-form-urlencoded, cookie do Diego e Origin de outro site
- **Resultado esperado:** HTTP 403
- **Resultado obtido:** HTTP 403
- **Evidência:** HTTP 403 {"erro":"Pedido de outra origem recusado.","codigo":"ORIGEM_NAO_PERMITIDA","status":403}
- **Status:** Aprovado

#### CSRF-03
- **Objetivo:** O tempo real recusa conexão vinda de outro site.
- **Requisição:** Socket.IO: conexão com Origin: https://site-malicioso.example e o cookie do Diego
- **Resultado esperado:** Conexão recusada
- **Resultado obtido:** Conexão recusada (websocket error)
- **Evidência:** recusada (websocket error)
- **Status:** Aprovado

#### CSRF-04
- **Objetivo:** Um link em outro site apontando para a API não altera dados de quem clica.
- **Requisição:** GET /conversas/1/mensagens com o cookie do Diego e os cabeçalhos de navegação vinda de outro site (Sec-Fetch-Site: cross-site, Sec-Fetch-Mode: navigate)
- **Resultado esperado:** HTTP 403 e nenhuma mensagem muda de estado
- **Resultado obtido:** HTTP 403; mensagens não lidas: 4 antes, 4 depois
- **Evidência:** HTTP 403 {"erro":"Pedido de outra origem recusado.","codigo":"ORIGEM_NAO_PERMITIDA","status":403}
- **Status:** Aprovado

#### COR-01
- **Objetivo:** Só o endereço do site pode ler as respostas da API no navegador.
- **Requisição:** GET /categorias com Origin do site e com Origin de outro site
- **Resultado esperado:** Access-Control-Allow-Origin só para o site, com credenciais, sem curinga
- **Resultado obtido:** Site: http://127.0.0.1:5174; outro site: sem cabeçalho; origem nula: sem cabeçalho
- **Evidência:** Access-Control-Allow-Credentials: true
- **Status:** Aprovado

#### COR-02
- **Objetivo:** A consulta prévia (preflight) de outro site não é autorizada.
- **Requisição:** OPTIONS /perfil com Origin de outro site e Access-Control-Request-Method: PUT
- **Resultado esperado:** Sem Access-Control-Allow-Origin
- **Resultado obtido:** Access-Control-Allow-Origin: ausente
- **Evidência:** HTTP 204
- **Status:** Aprovado

### 3.4 XSS

Feito no navegador (Chrome), com textos de ataque gravados pela API e depois abertos nas telas do site. O cenário passa quando nenhum script roda e o texto aparece como texto comum.

#### XSS-01
- **Objetivo:** Título, descrição e ponto de referência do anúncio com HTML e script.
- **Requisição:** Abrir /anuncio/26 no Chrome com o conteúdo malicioso já gravado
- **Resultado esperado:** O código aparece como texto e não é executado
- **Resultado obtido:** Executou: não; elementos injetados: 0; aparece como texto: sim
- **Evidência:** Trecho na tela: &lt;img src=x onerror="window.__xssExecutou=1"&gt;&lt;script&gt;window.__xssExecutou=1&lt; Descrição Des
- **Status:** Aprovado

#### XSS-02
- **Objetivo:** O mesmo anúncio na lista da busca.
- **Requisição:** Abrir /busca?q=Sof%C3%A1 no Chrome com o conteúdo malicioso já gravado
- **Resultado esperado:** O código aparece como texto e não é executado
- **Resultado obtido:** Executou: não; elementos injetados: 0; aparece como texto: sim
- **Evidência:** Trecho na tela: &lt;img src=x onerror="window.__xssExecutou=1"&gt;&lt;script&gt;window.__xssExecutou=1&lt; R$ 50 Centro,
- **Status:** Aprovado

#### XSS-03
- **Objetivo:** Nome e bio do perfil com HTML e script, no perfil público.
- **Requisição:** Abrir /usuario/3 no Chrome com o conteúdo malicioso já gravado
- **Resultado esperado:** O código aparece como texto e não é executado
- **Resultado obtido:** Executou: não; elementos injetados: 0; aparece como texto: sim
- **Evidência:** Trecho na tela: &lt;img src=x onerror="window.__xssExecutou=4"&gt;&lt;script&gt;window.__xssExecutou=4&lt;/script&gt;&lt;svg on
- **Status:** Aprovado

#### XSS-04
- **Objetivo:** Pedido do Procura-se com HTML e script.
- **Requisição:** Abrir /procura-se no Chrome com o conteúdo malicioso já gravado
- **Resultado esperado:** O código aparece como texto e não é executado
- **Resultado obtido:** Executou: não; elementos injetados: 0; aparece como texto: sim
- **Evidência:** Trecho na tela: &lt;img src=x onerror="window.__xssExecutou=6"&gt;&lt;script&gt;window.__xssExecutou=6&lt; Valor a combin
- **Status:** Aprovado

#### XSS-05
- **Objetivo:** Mensagem do chat com HTML e script.
- **Requisição:** Abrir /conversas/1 no Chrome com o conteúdo malicioso já gravado
- **Resultado esperado:** O código aparece como texto e não é executado
- **Resultado obtido:** Executou: não; elementos injetados: 0; aparece como texto: sim
- **Evidência:** Trecho na tela: &lt;img src=x onerror="window.__xssExecutou=7"&gt;&lt;script&gt;window.__xssExecutou=7&lt;/script&gt;&lt;svg on
- **Status:** Aprovado

#### XSS-06
- **Objetivo:** Texto da busca refletido na página.
- **Requisição:** Abrir /busca?q=%3Cimg%20src%3Dx%20onerror%3D%22window.__xssExecutou%3D8%22%3E no Chrome com o conteúdo malicioso já gravado
- **Resultado esperado:** O código aparece como texto e não é executado
- **Resultado obtido:** Executou: não; elementos injetados: 0; aparece como texto: sim
- **Evidência:** Trecho na tela: onerror="window.__xssExecutou=8"&gt;” Ver no mapa Ordenar por: Mais próximos Mais próximos Ma
- **Status:** Aprovado

#### XSS-07
- **Objetivo:** Título com HTML no balão do mapa (o mapa monta HTML à mão).
- **Requisição:** Abrir /mapa no Chrome com o conteúdo malicioso já gravado
- **Resultado esperado:** O código aparece como texto e não é executado
- **Resultado obtido:** Executou: não; elementos injetados: 0; aparece como texto: sim
- **Evidência:** Trecho na tela: &lt;img src=x onerror="window.__xssExecutou=1"&gt;&lt;script&gt;window.__xssExecutou=1&lt; R$ 50 · Centro
- **Status:** Aprovado

### 3.5 Validação de dados

#### VAL-01
- **Objetivo:** Anúncio sem os campos obrigatórios não é publicado.
- **Requisição:** POST /anuncios (multipart) só com a foto
- **Resultado esperado:** HTTP 400 com mensagem em português
- **Resultado obtido:** HTTP 400
- **Evidência:** HTTP 400 {"erro":"O campo titulo é obrigatório.","codigo":"DADOS_INVALIDOS","status":400}
- **Status:** Aprovado

#### VAL-02
- **Objetivo:** Limites de tamanho do título.
- **Requisição:** POST /anuncios com título de 2 letras e de 81 letras
- **Resultado esperado:** HTTP 400 nos dois
- **Resultado obtido:** 2 letras: HTTP 400; 81 letras: HTTP 400
- **Evidência:** HTTP 400 {"erro":"O campo titulo pode ter no máximo 80 caracteres.","codigo":"DADOS_INVALIDOS","status":400}
- **Status:** Aprovado

#### VAL-03
- **Objetivo:** Preço inválido não entra.
- **Requisição:** POST /anuncios com preço 0, -5, "abc", 1e9 e 100000000
- **Resultado esperado:** HTTP 400 em todos
- **Resultado obtido:** HTTP 400, 400, 400, 400, 400
- **Evidência:** Preços enviados: 0, -5, abc, 1e9 e 100000000
- **Status:** Aprovado

#### VAL-04
- **Objetivo:** Subcategoria tem que ser da categoria escolhida; opções fora da lista são recusadas.
- **Requisição:** POST /anuncios com subcategoria de outra categoria, condição "quebrado", entrega "motoboy" e transporte "aviao"
- **Resultado esperado:** HTTP 400 em todos
- **Resultado obtido:** HTTP 400, 400, 400, 400
- **Evidência:** HTTP 400 {"erro":"Essa subcategoria não é da categoria escolhida.","codigo":"DADOS_INVALIDOS","status":400}
- **Status:** Aprovado

#### VAL-05
- **Objetivo:** Corpo grande demais ou JSON quebrado não derruba a API.
- **Requisição:** PUT /perfil com 200 kB de JSON e com o texto {"nome":
- **Resultado esperado:** HTTP 413 e HTTP 400
- **Resultado obtido:** 200 kB: HTTP 413; JSON quebrado: HTTP 400
- **Evidência:** HTTP 400 {"erro":"JSON inválido no corpo da requisição.","codigo":"JSON_INVALIDO","status":400}
- **Status:** Aprovado

#### VAL-06
- **Objetivo:** Objeto ou lista no lugar de número ou texto dá erro de validação, não erro interno.
- **Requisição:** POST /auth/teste, /conversas e /procuras e PUT /perfil com { "toString": "x" }, [1] e { "id": 1 } nos campos
- **Resultado esperado:** HTTP 400 em todos, nenhum 500
- **Resultado obtido:** 16 de 16 respostas com HTTP 400; erros 500: 0
- **Evidência:** Códigos: 400
- **Status:** Aprovado

#### VAL-07
- **Objetivo:** Mensagem vazia ou com mais de 1000 letras é recusada.
- **Requisição:** POST /conversas/1/mensagens com texto vazio, só espaços e 1001 letras
- **Resultado esperado:** HTTP 400 em todos
- **Resultado obtido:** HTTP 400, 400, 400
- **Evidência:** HTTP 400 {"erro":"O campo texto pode ter no máximo 1000 caracteres.","codigo":"DADOS_INVALIDOS","status":400}
- **Status:** Aprovado

#### VAL-08
- **Objetivo:** Paginação fora do limite não devolve o banco inteiro.
- **Requisição:** GET /anuncios?por_pagina=100000 e GET /anuncios?pagina=0
- **Resultado esperado:** No máximo 50 por página; página 0 recusada
- **Resultado obtido:** por_pagina=100000: limitado a 50; pagina=0: HTTP 400
- **Evidência:** HTTP 400 {"erro":"O número da página precisa ser um número inteiro positivo.","codigo":"DADOS_INVALIDOS","status":400}
- **Status:** Aprovado

### 3.6 Upload de imagens

#### UPL-01
- **Objetivo:** Arquivo de texto com nome e tipo de imagem é recusado.
- **Requisição:** POST /anuncios com foto.jpg (image/jpeg) cujo conteúdo é texto
- **Resultado esperado:** HTTP 400
- **Resultado obtido:** HTTP 400
- **Evidência:** HTTP 400 {"erro":"Uma das fotos não abriu. Envie fotos JPG, PNG ou WebP.","codigo":"DADOS_INVALIDOS","status":400}
- **Status:** Aprovado

#### UPL-02
- **Objetivo:** SVG com script não é aceito, nem declarado como PNG.
- **Requisição:** POST /anuncios com &lt;svg onload=...&gt; como image/svg+xml e como image/png
- **Resultado esperado:** HTTP 400 nos dois
- **Resultado obtido:** HTTP 400, 400
- **Evidência:** HTTP 400 {"erro":"Uma das fotos não abriu. Envie fotos JPG, PNG ou WebP.","codigo":"DADOS_INVALIDOS","status":400}
- **Status:** Aprovado

#### UPL-03
- **Objetivo:** Página HTML ou programa disfarçado de foto é recusado.
- **Requisição:** POST /anuncios com HTML e com um executável (cabeçalho MZ) declarados como image/jpeg
- **Resultado esperado:** HTTP 400 nos dois
- **Resultado obtido:** HTTP 400, 400
- **Evidência:** HTTP 400 {"erro":"Uma das fotos não abriu. Envie fotos JPG, PNG ou WebP.","codigo":"DADOS_INVALIDOS","status":400}
- **Status:** Aprovado

#### UPL-04
- **Objetivo:** Foto maior que 8 MB e mais de 8 fotos são recusadas.
- **Requisição:** POST /anuncios com uma foto de 9 MB e com 9 fotos
- **Resultado esperado:** HTTP 400 nos dois
- **Resultado obtido:** 9 MB: HTTP 400; 9 fotos: HTTP 400
- **Evidência:** HTTP 400 {"erro":"Cada foto pode ter no máximo 8 MB.","codigo":"DADOS_INVALIDOS","status":400} / {"erro":"Você pode enviar no máximo 8 fotos.","codigo":"DADOS_INVALIDO
- **Status:** Aprovado

#### UPL-05
- **Objetivo:** Imagem pequena no arquivo e enorme ao abrir ("bomba de pixels") não trava o servidor.
- **Requisição:** POST /anuncios com um PNG de 8000 x 8000 pixels (64 milhões de pixels, poucos kB)
- **Resultado esperado:** HTTP 400 em poucos segundos
- **Resultado obtido:** HTTP 400 em 0.0 s
- **Evidência:** Arquivo de 183 kB. HTTP 400 {"erro":"Uma das fotos não abriu. Envie fotos JPG, PNG ou WebP.","codigo":"DADOS_INVALIDOS","status":400}
- **Status:** Aprovado

#### UPL-06
- **Objetivo:** O nome do arquivo enviado não decide onde a foto é gravada.
- **Requisição:** POST /anuncios com a foto chamada ../../../invasao.jpg
- **Resultado esperado:** Foto gravada com nome aleatório, dentro da pasta do anúncio
- **Resultado obtido:** HTTP 201; arquivo fora da pasta: não
- **Evidência:** /api/uploads/anuncios/13/12ff3760bb4b4cd2ab688ac3d23ca5f5-400.webp
- **Status:** Aprovado

#### UPL-07
- **Objetivo:** A localização gravada dentro da foto (EXIF/GPS) é removida.
- **Requisição:** POST /anuncios com um JPEG que traz GPS no EXIF; depois o WebP publicado é baixado e lido
- **Resultado esperado:** Foto publicada sem EXIF
- **Resultado obtido:** EXIF no arquivo enviado: sim; EXIF na foto publicada: não
- **Evidência:** Foto publicada em webp, 800 x 600
- **Status:** Aprovado

#### UPL-08
- **Objetivo:** A foto publicada é servida como imagem e o navegador não tenta adivinhar o tipo.
- **Requisição:** GET da foto publicada e leitura dos cabeçalhos
- **Resultado esperado:** Content-Type image/webp e X-Content-Type-Options: nosniff
- **Resultado obtido:** Content-Type: image/webp; X-Content-Type-Options: nosniff
- **Evidência:** HTTP 200, 296 bytes
- **Status:** Aprovado

#### UPL-09
- **Objetivo:** A foto de perfil e a foto do chat passam pelo mesmo filtro.
- **Requisição:** PUT /perfil/foto e POST /conversas/1/fotos com um arquivo de texto declarado como image/png
- **Resultado esperado:** HTTP 400 nos dois
- **Resultado obtido:** Perfil: HTTP 400; chat: HTTP 400
- **Evidência:** HTTP 400 {"erro":"A foto não é válida. Envie uma imagem JPG, PNG ou WebP.","codigo":"DADOS_INVALIDOS","status":400}
- **Status:** Aprovado

### 3.7 Exclusão de imagens

Regra da API: o registro sai do banco primeiro e o arquivo sai do disco depois. Se o disco falhar, o pedido termina bem, a falha vai para o log e a conferência de fotos (`npm run fotos`) apaga o que sobrou.

#### IMG-01
- **Objetivo:** Excluir uma foto do anúncio apaga o registro do banco e os arquivos dela, e só dela.
- **Requisição:** Anúncio com 3 fotos; DELETE /anuncios/:id/fotos/:fotoId (a segunda foto) com o login do dono
- **Resultado esperado:** HTTP 200; 2 registros e 6 arquivos (3 tamanhos por foto); a foto excluída responde 404
- **Resultado obtido:** HTTP 200; registros: 2; arquivos: 9 antes, 6 depois; foto excluída: HTTP 404; foto vizinha: HTTP 200
- **Evidência:** Arquivo excluído: /api/uploads/anuncios/15/7c05f1d1fded440082f88093575abb2c-400.webp
- **Status:** Aprovado

#### IMG-02
- **Objetivo:** Ninguém exclui a foto do anúncio de outra pessoa.
- **Requisição:** Anúncio da Larissa com 3 fotos; DELETE /anuncios/:id/fotos/:fotoId com o login do Usuário Teste e sem login
- **Resultado esperado:** HTTP 403 e 401; nenhum registro e nenhum arquivo apagado
- **Resultado obtido:** Outra conta: HTTP 403; sem login: HTTP 401; registros: 3; arquivos: 9
- **Evidência:** HTTP 403 {"erro":"Você não tem permissão para alterar este anúncio.","codigo":"SEM_PERMISSAO","status":403}
- **Status:** Aprovado

#### IMG-03
- **Objetivo:** O id de uma foto de outro anúncio não vale no meu anúncio.
- **Requisição:** DELETE /anuncios/&lt;meu anúncio&gt;/fotos/&lt;id da foto do anúncio da Larissa&gt; com o login do Usuário Teste
- **Resultado esperado:** HTTP 404; a foto da Larissa continua no banco e no disco
- **Resultado obtido:** HTTP 404; fotos da Larissa: 3 registros e 9 arquivos
- **Evidência:** HTTP 404 {"erro":"Foto não encontrada neste anúncio.","codigo":"NAO_ENCONTRADO","status":404}
- **Status:** Aprovado

#### IMG-04
- **Objetivo:** Arquivo que já não existe no disco não vira erro interno.
- **Requisição:** Os arquivos da foto são apagados direto na pasta; depois DELETE /anuncios/:id/fotos/:fotoId
- **Resultado esperado:** HTTP 200 e o registro sai do banco (nunca 500)
- **Resultado obtido:** HTTP 200; registros restantes: 2
- **Evidência:** Pasta do anúncio 19 removida antes do pedido
- **Status:** Aprovado

#### IMG-05
- **Objetivo:** Excluir o anúncio apaga todas as fotos dele e as fotos mandadas nas conversas dele.
- **Requisição:** Anúncio com 3 fotos e uma conversa com 2 fotos; DELETE /anuncios/:id com o login do dono
- **Resultado esperado:** HTTP 204; nenhuma foto do anúncio ou da conversa no banco e no disco
- **Resultado obtido:** HTTP 204; arquivos do anúncio: 9 antes, 0 depois; arquivos do chat: 4 antes, 0 depois; registros: 0
- **Evidência:** Foto do anúncio depois da exclusão: HTTP 404
- **Status:** Aprovado

#### IMG-06
- **Objetivo:** Trocar a foto de perfil apaga a antiga; remover apaga o arquivo e limpa o registro.
- **Requisição:** PUT /perfil/foto duas vezes e DELETE /perfil/foto com o login do Usuário Teste
- **Resultado esperado:** Sempre no máximo 1 arquivo na pasta do perfil; no fim, nenhum arquivo e foto_url vazio
- **Resultado obtido:** Depois da troca: 1 arquivo; foto antiga: HTTP 404; depois de remover: 0 arquivos, foto_url null
- **Evidência:** Antiga: /api/uploads/perfis/3/bda773608be741fc869a29dc6acb525b.webp
- **Status:** Aprovado

#### IMG-07
- **Objetivo:** Excluir a conta apaga a conta, os anúncios e todas as fotos dela, e só dela.
- **Requisição:** Conta nova com foto de perfil e anúncio com 3 fotos; DELETE /perfil sem confirmação e depois com { confirmar: "EXCLUIR", usuario_id: 1 }
- **Resultado esperado:** HTTP 400 sem a confirmação; HTTP 204 com ela; conta, anúncio e arquivos apagados; o token antigo responde 401; a conta do Diego (id 1) continua
- **Resultado obtido:** Sem confirmação: HTTP 400; com confirmação: HTTP 204; registros que sobraram: 0; arquivos que sobraram: 0; token antigo: HTTP 401; conta do Diego: continua
- **Evidência:** HTTP 400 {"erro":"Para excluir a conta, envie o campo confirmar com o valor EXCLUIR.","codigo":"DADOS_INVALIDOS","status":400}
- **Status:** Aprovado

#### IMG-08
- **Objetivo:** A conferência de fotos acha e apaga arquivo sem registro, sem tocar nas fotos válidas.
- **Requisição:** Um arquivo é gravado direto na pasta de um anúncio que não existe (com data de 2 horas atrás); npm run fotos e npm run fotos -- --apagar
- **Resultado esperado:** A primeira execução só lista o arquivo; a segunda apaga; as fotos com registro continuam
- **Resultado obtido:** Só listar: arquivo continua; com --apagar: apagado; fotos válidas do anúncio 22: 9 arquivos
- **Evidência:** apagado: anuncios/987654 (pasta de anúncio que não existe mais no banco)
- **Status:** Aprovado

#### IMG-09
- **Objetivo:** A foto excluída deixa de ser entregue pelo servidor na mesma hora.
- **Requisição:** GET da foto antes e logo depois do DELETE /anuncios/:id/fotos/:fotoId, lendo o Cache-Control
- **Resultado esperado:** HTTP 200 antes e HTTP 404 depois, sem esperar o cache vencer no servidor
- **Resultado obtido:** Antes: HTTP 200; depois: HTTP 404
- **Evidência:** Cache-Control da foto: public, max-age=2592000, immutable
- **Observação:** O navegador de quem já abriu a foto pode guardar a cópia dele até o prazo do cache vencer. O servidor não tem como apagar essa cópia.
- **Status:** Aprovado

### 3.8 Privacidade

#### PRV-01
- **Objetivo:** Respostas públicas não trazem e-mail, telefone nem o id do Google de ninguém.
- **Requisição:** GET /usuarios/1, /anuncios/1, /anuncios?por_pagina=50, /procuras, /avaliacoes/usuarios/1 e /localizacao/mapa (sem login)
- **Resultado esperado:** Nenhum dado pessoal nas respostas
- **Resultado obtido:** 7 rotas sem dado pessoal
- **Evidência:** Procurado: e-mails das contas, telefone do Diego, ids do Google e os campos "email" e "telefone"
- **Status:** Aprovado

#### PRV-02
- **Objetivo:** Na conversa, a outra pessoa aparece sem e-mail e sem telefone.
- **Requisição:** GET /conversas e GET /conversas/1/mensagens com a conta da Larissa
- **Resultado esperado:** Só nome, foto e presença do outro usuário
- **Resultado obtido:** Sem e-mail e sem telefone
- **Evidência:** Campos do outro usuário: id, nome, foto_url, ultimo_acesso, online
- **Status:** Aprovado

#### PRV-03
- **Objetivo:** Quem não é o dono não recebe a rua, o CEP nem o ponto exato do anúncio.
- **Requisição:** Anúncio publicado com GPS; visitante e outra conta pedem GET /anuncios/&lt;id&gt; e GET /localizacao/anuncios/&lt;id&gt;
- **Resultado esperado:** Só o ponto aproximado, sem rua e sem CEP
- **Resultado obtido:** Para os outros: só o ponto aproximado; para o dono: endereço completo
- **Evidência:** Ponto público: -20.7575, -42.875 (aproximada: true)
- **Status:** Aprovado

#### PRV-04
- **Objetivo:** O aviso em tempo real de anúncio novo não leva o ponto exato.
- **Requisição:** Socket.IO como visitante; outra conta publica um anúncio com GPS; leitura do evento anuncio_publicado
- **Resultado esperado:** Coordenada do evento diferente da exata
- **Resultado obtido:** O evento levou só o ponto aproximado
- **Evidência:** Campos do evento: id, titulo, preco, status, categoria_id, subcategoria_id, condicao, cidade_id, bairro_id, latitude, longitude
- **Status:** Aprovado

#### PRV-05
- **Objetivo:** A sessão devolve o e-mail só para o próprio dono da conta.
- **Requisição:** GET /auth/sessao sem login e com a conta do Usuário Teste
- **Resultado esperado:** Sem login: usuario nulo; com login: só os próprios dados
- **Resultado obtido:** Sem login: {"usuario":null}; com login: conta 3
- **Evidência:** Campos: id, nome, email, foto_url
- **Status:** Aprovado

#### PRV-06
- **Objetivo:** Erro da API não mostra SQL, pilha de erro nem caminho de arquivo.
- **Requisição:** GET /rota-que-nao-existe, GET /anuncios/abc e POST /auth/teste com JSON quebrado
- **Resultado esperado:** Só a mensagem de erro em português
- **Resultado obtido:** HTTP 404, 400, 400, sem detalhe interno
- **Evidência:** HTTP 404 {"erro":"Rota não encontrada: GET /api/rota-que-nao-existe","codigo":"ROTA_NAO_ENCONTRADA","status":404}
- **Status:** Aprovado

### 3.9 Geolocalização

#### GEO-01
- **Objetivo:** Coordenada fora da Zona da Mata mineira é recusada.
- **Requisição:** POST /localizacao/atual com São Paulo (-23.55, -46.63) e GET /localizacao/proximos com a mesma coordenada
- **Resultado esperado:** HTTP 422 (FORA_DA_AREA)
- **Resultado obtido:** Gravar: HTTP 422; buscar: HTTP 422
- **Evidência:** HTTP 422 {"erro":"Essa localização fica fora da Zona da Mata mineira. O DesapegaUai atende só os municípios da região.","codigo":"FORA_DA_AREA","status":422,"c
- **Status:** Aprovado

#### GEO-02
- **Objetivo:** Coordenada impossível é recusada.
- **Requisição:** POST /localizacao/atual com latitude 91, longitude 181, (0, 0), texto e só a latitude
- **Resultado esperado:** HTTP 400 em todos
- **Resultado obtido:** HTTP 400, 400, 400, 400, 400
- **Evidência:** Enviado: latitude 91; longitude 181; (0, 0); texto; só a latitude
- **Status:** Aprovado

#### GEO-03
- **Objetivo:** Precisão e data do GPS manipuladas são recusadas.
- **Requisição:** POST /localizacao/atual com precisão -1 e 1000000 m, data de amanhã e data de 3 dias atrás
- **Resultado esperado:** HTTP 400 em todos
- **Resultado obtido:** HTTP 400, 400, 400, 400
- **Evidência:** HTTP 400 {"erro":"A data da localização está no futuro.","codigo":"DADOS_INVALIDOS","status":400,"campos":["capturada_em"]}
- **Status:** Aprovado

#### GEO-04
- **Objetivo:** Raio e área do mapa fora do limite são recusados.
- **Requisição:** GET /localizacao/proximos com raio 0, 301 e "mil"; GET /localizacao/mapa com área de 20 graus
- **Resultado esperado:** HTTP 400 em todos
- **Resultado obtido:** HTTP 400, 400, 400, 400
- **Evidência:** HTTP 400 {"erro":"A área do mapa é grande demais (máximo de 5 graus).","codigo":"DADOS_INVALIDOS","status":400,"campos":["bbox"]}
- **Status:** Aprovado

#### GEO-05
- **Objetivo:** O ponto público do anúncio é sempre o mesmo e fica afastado do ponto real.
- **Requisição:** 10 pedidos de GET /localizacao/anuncios/&lt;id&gt; para o anúncio publicado com GPS
- **Resultado esperado:** Mesmo ponto nas 10 respostas, a mais de 20 m do ponto exato
- **Resultado obtido:** 1 ponto(s) diferente(s) em 10 respostas; distância até o ponto exato: 65 m
- **Evidência:** Se o ponto mudasse a cada pedido, a média de muitos pedidos revelaria o endereço
- **Status:** Aprovado

#### GEO-06
- **Objetivo:** A distância até o anúncio é calculada pelo ponto aproximado.
- **Requisição:** GET /localizacao/distancia a partir do ponto exato do anúncio
- **Resultado esperado:** Distância maior que zero e marcada como aproximada
- **Resultado obtido:** HTTP 200; distância informada: 0.1 km; aproximado: true
- **Evidência:** {"distancia_km":0.1,"metodo":"haversine","ate":{"tipo":"anuncio","id":24,"aproximado":true}}
- **Status:** Aprovado

#### GEO-07
- **Objetivo:** O ponto do anúncio tem que ficar na cidade do bairro escolhido.
- **Requisição:** POST /anuncios com o bairro Centro de Viçosa e o GPS em Ponte Nova (-20.4161, -42.9087)
- **Resultado esperado:** HTTP 400 ou 422
- **Resultado obtido:** HTTP 422
- **Evidência:** HTTP 422 {"erro":"A localização enviada não fica em Viçosa, a cidade do bairro escolhido.","codigo":"FORA_DA_CIDADE","status":422,"campos":["latitude"]}
- **Status:** Aprovado

#### GEO-08
- **Objetivo:** Ninguém consulta a localização de outra conta.
- **Requisição:** GET /localizacao/atual?usuario_id=1 com a conta do Usuário Teste
- **Resultado esperado:** Só a localização da própria conta
- **Resultado obtido:** HTTP 200, sem a localização do Diego
- **Evidência:** {"localizacao":null}
- **Status:** Aprovado

### 3.10 Cabeçalhos HTTP

Conferidos na API em modo de produção.

#### HDR-01
- **Objetivo:** O navegador não adivinha o tipo dos arquivos.
- **Requisição:** GET /saude na API em modo de produção, cabeçalho x-content-type-options
- **Resultado esperado:** nosniff
- **Resultado obtido:** x-content-type-options: nosniff
- **Evidência:** x-content-type-options: nosniff
- **Status:** Aprovado

#### HDR-02
- **Objetivo:** A API não pode ser embutida em quadro de outro site (clickjacking).
- **Requisição:** GET /saude na API em modo de produção, cabeçalho x-frame-options
- **Resultado esperado:** SAMEORIGIN ou DENY
- **Resultado obtido:** x-frame-options: SAMEORIGIN
- **Evidência:** x-frame-options: SAMEORIGIN
- **Status:** Aprovado

#### HDR-03
- **Objetivo:** O navegador é instruído a usar sempre HTTPS.
- **Requisição:** GET /saude na API em modo de produção, cabeçalho strict-transport-security
- **Resultado esperado:** max-age de pelo menos 6 meses
- **Resultado obtido:** strict-transport-security: max-age=31536000; includeSubDomains
- **Evidência:** strict-transport-security: max-age=31536000; includeSubDomains
- **Status:** Aprovado

#### HDR-04
- **Objetivo:** Existe política de conteúdo (CSP).
- **Requisição:** GET /saude na API em modo de produção, cabeçalho content-security-policy
- **Resultado esperado:** default-src 'self'
- **Resultado obtido:** content-security-policy: default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests
- **Evidência:** content-security-policy: default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'sel
- **Status:** Aprovado

#### HDR-05
- **Objetivo:** A API não anuncia a tecnologia do servidor.
- **Requisição:** GET /saude na API em modo de produção, cabeçalho x-powered-by
- **Resultado esperado:** Cabeçalho ausente
- **Resultado obtido:** x-powered-by: ausente
- **Evidência:** x-powered-by: ausente
- **Status:** Aprovado

#### HDR-06
- **Objetivo:** O endereço da página não vaza para outros sites.
- **Requisição:** GET /saude na API em modo de produção, cabeçalho referrer-policy
- **Resultado esperado:** no-referrer
- **Resultado obtido:** referrer-policy: no-referrer
- **Evidência:** referrer-policy: no-referrer
- **Status:** Aprovado

#### HDR-07
- **Objetivo:** Em produção, o erro não traz detalhe interno.
- **Requisição:** POST /auth/google com JSON quebrado e GET /rota-que-nao-existe na API em modo de produção
- **Resultado esperado:** Resposta sem o campo detalhe e sem pilha de erro
- **Resultado obtido:** HTTP 400, 404, sem detalhe interno
- **Evidência:** HTTP 400 {"erro":"JSON inválido no corpo da requisição.","codigo":"JSON_INVALIDO","status":400}
- **Status:** Aprovado

### 3.11 Limite de requisições

Os limites são por minuto. Quando o 429 aparece antes do número esperado é porque os cenários anteriores já tinham usado parte do limite no mesmo minuto.

#### RL-01
- **Objetivo:** Consulta de endereço por coordenada (usa serviço externo).
- **Requisição:** GET /localizacao/endereco 35 vezes em sequência
- **Resultado esperado:** HTTP 429 até o 31º pedido no mesmo minuto
- **Resultado obtido:** HTTP 429 no 31º pedido
- **Evidência:** HTTP 429 {"erro":"Muitas consultas de endereço em pouco tempo. Aguarde um pouco.","codigo":"MUITAS_REQUISICOES","status":429}
- **Status:** Aprovado

#### RL-02
- **Objetivo:** Gravação da localização do usuário.
- **Requisição:** POST /localizacao/atual 65 vezes em sequência com a mesma conta
- **Resultado esperado:** HTTP 429 até o 61º pedido no mesmo minuto
- **Resultado obtido:** HTTP 429 no 61º pedido
- **Evidência:** HTTP 429 {"erro":"Muitas atualizações de localização em pouco tempo. Aguarde um pouco.","codigo":"MUITAS_REQUISICOES","status":429}
- **Status:** Aprovado

#### RL-03
- **Objetivo:** Busca por proximidade.
- **Requisição:** GET /localizacao/proximos 245 vezes em sequência
- **Resultado esperado:** HTTP 429 até o 241º pedido no mesmo minuto
- **Resultado obtido:** HTTP 429 no 231º pedido (os cenários anteriores já tinham usado 10 do limite neste minuto)
- **Evidência:** HTTP 429 {"erro":"Muitas buscas em pouco tempo. Aguarde alguns segundos.","codigo":"MUITAS_REQUISICOES","status":429}
- **Status:** Aprovado

#### RL-04
- **Objetivo:** Tentativas de login (produção).
- **Requisição:** POST /auth/google 105 vezes em sequência na API em modo de produção
- **Resultado esperado:** HTTP 429 até o 101º pedido no mesmo minuto
- **Resultado obtido:** HTTP 429 no 101º pedido
- **Evidência:** HTTP 429 {"erro":"Muitas tentativas de login. Aguarde alguns minutos e tente de novo.","codigo":"MUITAS_REQUISICOES","status":429}
- **Status:** Aprovado

#### RL-05
- **Objetivo:** Publicação de anúncios pela mesma conta (produção).
- **Requisição:** POST /anuncios (rascunho) 35 vezes em sequência na API em modo de produção
- **Resultado esperado:** HTTP 429 até o 31º pedido no mesmo minuto
- **Resultado obtido:** HTTP 429 no 31º pedido
- **Evidência:** HTTP 429 {"erro":"Você salvou muitos anúncios em pouco tempo. Aguarde um pouco e tente de novo.","codigo":"MUITAS_REQUISICOES","status":429}
- **Status:** Aprovado

#### RL-06
- **Objetivo:** Mensagens do chat enviadas pela API (sem passar pelo tempo real).
- **Requisição:** POST /conversas/1/mensagens 70 vezes em sequência com a mesma conta
- **Resultado esperado:** HTTP 429 até o 61º pedido no mesmo minuto
- **Resultado obtido:** HTTP 429 no 54º pedido (os cenários anteriores já tinham usado 7 do limite neste minuto)
- **Evidência:** HTTP 429 {"erro":"Muitas mensagens em pouco tempo. Aguarde alguns segundos.","codigo":"MUITAS_REQUISICOES","status":429}
- **Status:** Aprovado

#### RL-07
- **Objetivo:** Busca de anúncios por texto (GET /anuncios).
- **Requisição:** GET /anuncios?busca=mesa 245 vezes em sequência
- **Resultado esperado:** HTTP 429 até o 241º pedido no mesmo minuto
- **Resultado obtido:** HTTP 429 no 1º pedido (os cenários anteriores já tinham usado 240 do limite neste minuto)
- **Evidência:** HTTP 429 {"erro":"Muitas buscas em pouco tempo. Aguarde alguns segundos.","codigo":"MUITAS_REQUISICOES","status":429}
- **Status:** Aprovado

#### RL-08
- **Objetivo:** Pedidos de gravação variados pela mesma conta (favoritar e desfavoritar).
- **Requisição:** POST /favoritos/1 e DELETE /favoritos/1 alternados, 130 vezes
- **Resultado esperado:** HTTP 429 até o 121º pedido no mesmo minuto
- **Resultado obtido:** HTTP 429 no 118º pedido (os cenários anteriores já tinham usado 3 do limite neste minuto)
- **Evidência:** HTTP 429 {"erro":"Muitas ações em pouco tempo. Aguarde alguns segundos.","codigo":"MUITAS_REQUISICOES","status":429}
- **Status:** Aprovado

### 3.12 Desempenho e carga

Medido neste computador, com os dados de exemplo, em uma API sem limite de pedidos. Serve para achar consulta lenta, não para prever o comportamento na hospedagem.

#### CRG-01
- **Objetivo:** Busca de anúncios por texto com 30 pedidos ao mesmo tempo.
- **Requisição:** 600 pedidos de GET /anuncios?busca=mesa&ordenar=recentes, 30 simultâneos
- **Resultado esperado:** Nenhum erro e 95% das respostas em menos de 1 segundo
- **Resultado obtido:** Erros: 0; mediana 28 ms; 95% em até 60 ms; pior caso 93 ms
- **Evidência:** 933 pedidos por segundo neste computador, com o banco de exemplo
- **Status:** Aprovado

#### CRG-02
- **Objetivo:** Página do anúncio com 30 pedidos ao mesmo tempo.
- **Requisição:** 600 pedidos de GET /anuncios/1, 30 simultâneos
- **Resultado esperado:** Nenhum erro e 95% das respostas em menos de 1 segundo
- **Resultado obtido:** Erros: 0; mediana 31 ms; 95% em até 42 ms; pior caso 63 ms
- **Evidência:** 914 pedidos por segundo neste computador, com o banco de exemplo
- **Status:** Aprovado

#### CRG-03
- **Objetivo:** Lista de categorias com 30 pedidos ao mesmo tempo.
- **Requisição:** 600 pedidos de GET /categorias, 30 simultâneos
- **Resultado esperado:** Nenhum erro e 95% das respostas em menos de 1 segundo
- **Resultado obtido:** Erros: 0; mediana 16 ms; 95% em até 19 ms; pior caso 21 ms
- **Evidência:** 1914 pedidos por segundo neste computador, com o banco de exemplo
- **Status:** Aprovado

#### CRG-04
- **Objetivo:** Sugestão de bairros (7.962 no banco) com 30 pedidos ao mesmo tempo.
- **Requisição:** 600 pedidos de GET /cidades/1/bairros?busca=cen, 30 simultâneos
- **Resultado esperado:** Nenhum erro e 95% das respostas em menos de 1 segundo
- **Resultado obtido:** Erros: 0; mediana 15 ms; 95% em até 24 ms; pior caso 31 ms
- **Evidência:** 1883 pedidos por segundo neste computador, com o banco de exemplo
- **Status:** Aprovado

## 4. SQL injection

- **Identificação:** SQL-01.
- **Objetivo:** Nenhum texto enviado pelo usuário pode ser executado como SQL.
- **Requisição:** 22 textos de ataque (`' OR '1'='1`, `UNION SELECT`, `DROP TABLE`, `SLEEP(4)` e variações) em 42 parâmetros de consulta e em 18 rotas de gravação. No total, 1.441 pedidos.
- **Resultado esperado:** Nenhum erro 500, nenhuma mensagem de SQL na resposta, nenhum atraso causado por `SLEEP`, nenhum dado de outra conta na resposta e nenhuma tabela alterada.
- **Resultado obtido:** Nenhuma injeção funcionou. O texto de ataque gravado em um anúncio voltou como texto comum.
- **Evidência:** Resposta mais lenta: 0,19 s (os ataques com `SLEEP` pediam 4 s). Banco depois dos ataques: 20 tabelas, 3 usuários, 12 anúncios, 8 categorias e 7.962 bairros, igual a antes.
- **Status:** Aprovado

SQL injection e IDOR são problemas diferentes. A API pode estar protegida contra SQL injection e ainda deixar uma conta mexer no anúncio de outra. Por isso a autorização tem cenários próprios, na seção 3.2.

## 5. Integração entre o site e a API e navegadores

Os testes de navegador abrem o site de verdade, ligado em uma API de verdade, e fazem o caminho do usuário: buscar por proximidade, trocar a distância, usar sem GPS, publicar anúncio com foto, conversar entre duas contas ao mesmo tempo, receber aviso, perder a conexão e voltar, publicar pedido no Procura-se e reservar anúncio.

| Navegador | Resultado |
| --- | --- |
| Chrome | 44 de 44 |
| Edge | 44 de 44 |
| Firefox | 43 de 44 |
| WebKit (motor do Safari) | 44 de 44 |
| Tablet (Galaxy Tab S4) | 44 de 44 |
| Celular Android (Pixel 7) | 44 de 44 |
| Celular iPhone (iPhone 14, WebKit) | 44 de 44 |

Até 23/11/2026, três testes não passavam nos celulares (localização manual, aviso no sininho e Procura-se): em tela de até 600 px, o botão da cidade e o sininho não apareciam no cabeçalho, nem no menu, nem na barra de baixo. Era um ajuste do site, não do teste. Nesse dia, o celular e o tablet passaram a mostrar no alto o Início, o sininho e as mensagens, com a cidade no menu que desce do ☰, e os três testes passaram nos dois aparelhos. Um teste novo (`menu-celular.spec.js`) confere o menu, os atalhos, o número de mensagens novas chegando na hora e que o computador continua com todos os ícones. No Firefox, o teste de colar print e arrastar imagem fica de fora, porque o Firefox não deixa um teste automático simular colar ou arrastar arquivo.

Falhas reais que os outros navegadores mostraram e que foram corrigidas no site: no Firefox e no WebKit a conexão do tempo real era refeita na carga da página e derrubava o primeiro pedido, o interruptor de avisos ficava preso quando o navegador não respondia, e uma tela quebrava quando as categorias ainda não tinham chegado.

## 6. Testes automáticos da API

São 276 testes em 28 arquivos, na pasta `backend/test`. Cobrem login, perfil, anúncios, rascunho, favoritos, busca, localização, conversas, chat em tempo real, fotos do chat, avaliações, denúncias, notificações, Procura-se, compromisso nas entregas, tag de transporte, status reservado, selo de vínculo acadêmico, segurança, falha do banco e exclusão de imagens.

Os testes de exclusão de imagens (`exclusao-de-imagens.test.js`) incluem dois casos que a auditoria por fora não consegue provocar:

- **Falha ao apagar o arquivo.** O disco é forçado a falhar. O pedido termina com HTTP 200, os 3 arquivos ficam no disco e a conferência de fotos apaga os 3 depois.
- **Falha ao apagar o registro.** O banco é forçado a recusar a exclusão. O pedido termina com HTTP 500 e nada é apagado: os 2 registros e os 6 arquivos continuam.

O último teste roda a conferência de fotos e confirma que não sobrou arquivo sem registro nem registro sem arquivo.

## 7. Tempo de resposta

Aqui a pergunta é se o sistema responde sem atraso. Foram medidas as rotas da API (5 pedidos em cada uma), as telas abertas no Chrome e as ações principais. Limites usados: 500 ms para uma rota da API e 3 segundos para a tela terminar de carregar.

| O que foi medido | Quantidade | Pior caso | Resultado |
| --- | --- | --- | --- |
| Rotas da API, sem login e com login | 24 | 23 ms | Todas com HTTP 200 e dentro do limite |
| Telas do site (públicas e da conta) | 29 | 1166 ms até ficar pronta | Nenhuma tela travada, vazia ou com erro do site |
| Site e API de desenvolvimento, só leitura e sem login | 11 rotas e 18 telas | 35 ms nas rotas e 2385 ms nas telas | Tudo dentro do limite |

| Tela | Aparece em | Pronta em | Pedidos à API | Status |
| --- | --- | --- | --- | --- |
| Início | 198 ms | 309 ms | 3 | Aprovado |
| Busca | 266 ms | 382 ms | 2 | Aprovado |
| Mapa | 274 ms | 990 ms | 5 | Aprovado |
| Procura-se | 240 ms | 356 ms | 6 | Aprovado |
| Página do anúncio | 421 ms | 632 ms | 7 | Aprovado |
| Perfil público do vendedor | 398 ms | 527 ms | 5 | Aprovado |
| Perfil | 565 ms | 786 ms | 10 | Aprovado |
| Meus anúncios | 362 ms | 474 ms | 7 | Aprovado |
| Publicar anúncio | 377 ms | 507 ms | 7 | Aprovado |
| Favoritos | 303 ms | 431 ms | 7 | Aprovado |
| Mensagens | 447 ms | 706 ms | 12 | Aprovado |
| Conversa aberta | 383 ms | 580 ms | 11 | Aprovado |

| Ação | Tempo | Limite | Status |
| --- | --- | --- | --- |
| Enviar mensagem no chat (resposta da API) | 75 ms | 500 ms | Aprovado |
| Mensagem aparecer na tela da outra pessoa (tempo real) | 143 ms | 1500 ms | Aprovado |
| Favoritar um anúncio | 12 ms | 500 ms | Aprovado |
| Tirar dos favoritos | 64 ms | 500 ms | Aprovado |
| Salvar o perfil | 19 ms | 500 ms | Aprovado |
| Publicar anúncio com 3 fotos de 6.3 MB cada | 3120 ms | 6000 ms | Aprovado |
| Anúncio novo aparecer no Início de quem está navegando | 75 ms | 2000 ms | Aprovado |
| Abrir a foto publicada (tamanho médio) | 8 ms | 500 ms | Aprovado |
| Marcar o anúncio como reservado | 13 ms | 500 ms | Aprovado |
| Excluir o anúncio com as fotos | 19 ms | 1000 ms | Aprovado |
| Anúncio excluído sumir do Início de quem está navegando | 50 ms | 2000 ms | Aprovado |
| Publicar pedido no Procura-se | 19 ms | 500 ms | Aprovado |
| Excluir a conta pela tela do Perfil e voltar ao Início sem login | 357 ms | 3000 ms | Aprovado |

Observações:

- A tela Entrar é a mais demorada (1166 ms na cópia de testes e 2385 ms no endereço de desenvolvimento) porque carrega o botão do Google, que vem de fora. Na cópia de testes o Google recusa o botão com HTTP 403, porque o endereço temporário não está cadastrado. No endereço de desenvolvimento o botão carrega normalmente.
- As telas Início, Busca e Mapa cancelam um pedido e fazem de novo quando a cidade do visitante é definida. Não causa erro nem atraso visível, mas é um pedido a mais.
- A publicação com 3 fotos grandes leva alguns segundos porque a API gera 3 tamanhos de cada foto. O botão do formulário mostra que está enviando.
- O site foi medido em modo de desenvolvimento. A versão final (`npm run build`) tem 213 kB de JavaScript e 39 kB de CSS compactados.
- Tudo foi medido neste computador. Na internet entra o tempo da rede, que aqui é zero.

## 8. Defeitos encontrados e corrigidos

| Defeito | Como aparecia | Correção |
| --- | --- | --- |
| O token continuava valendo depois de sair da conta | Quem tivesse copiado o cookie usava a conta até o token vencer | Cada conta tem um número de sessão. Sair da conta troca o número e os tokens antigos param de valer |
| Um link em outro site marcava mensagens como lidas | Abrir a lista de mensagens por um link de fora mudava o estado da conversa | A API recusa navegação vinda de outro site (HTTP 403) |
| Rotas sem limite de pedidos | Mensagens pela API, busca de anúncios por texto e gravações em geral aceitavam pedidos sem parar | Limite de 60 mensagens por minuto, 240 buscas por minuto e 120 gravações por minuto por conta |
| Objeto no lugar de número dava erro interno | `{ "preco": { "a": 1 } }` respondia HTTP 500 | Os validadores conferem o tipo antes de converter. A resposta agora é HTTP 400 |
| Fotos de conta excluída e falhas ao apagar | Não havia como excluir a conta, e um erro do disco ao apagar a foto ficava sem registro | Exclusão de conta (`DELETE /api/perfil`), log da falha e conferência de fotos (`npm run fotos`) |
| Testes gravavam fotos na pasta do site | As fotos dos testes ficavam misturadas com as fotos reais | Nos testes as fotos vão para uma pasta temporária |

## 9. Riscos que ainda existem

Nenhum cenário ficou reprovado. Mesmo assim, estes pontos não foram cobertos ou dependem da publicação:

1. **Parte dos cenários só foi testada em ambiente local.** O site publicado foi conferido de fora e por dentro do servidor (seção 11): HTTPS, cabeçalhos, portas, injeção, arquivos escondidos e pedidos sem login. O cookie de sessão e o limite de pedidos não foram repetidos no endereço real: o cookie precisa de uma conta Google de verdade, e estourar o limite bloquearia por alguns minutos a internet de quem testa.
2. **Login Google com conta real.** A auditoria confere que credencial inventada é recusada. O login com uma conta Google de verdade é feito à mão, não por teste automático.
3. **Não houve teste de invasão feito por terceiros.** Os cenários foram definidos pela própria equipe. Uma revisão externa pode achar o que a equipe não pensou em testar.
4. **O limite de pedidos fica na memória da API.** Reiniciar a API zera a contagem, e com mais de uma cópia da API rodando cada uma conta separado.
5. **Cópia da foto no navegador de quem já viu.** A foto excluída some do servidor na hora (cenário IMG-09), mas o navegador de quem já abriu pode guardar a cópia dele por até 30 dias. O servidor não consegue apagar essa cópia.
6. **A conferência de fotos é manual.** `npm run fotos -- --apagar` precisa ser rodado de tempos em tempos. Ela não roda sozinha de propósito: com o banco errado no `.env`, toda foto pareceria sem registro.
7. **As fotos ficam no disco do servidor.** O servidor faz uma cópia do banco e das fotos todo dia (`servidor/copia-de-seguranca.sh`), mas ela fica na mesma máquina. Se a hospedagem cair, só se salva a cópia que tiver sido baixada para outro computador.
8. **A documentação da API (`/api/docs`) é pública.** Ela mostra só as rotas, sem dados. Se a equipe preferir, dá para desligar em produção.
9. **Denúncias sem tela de administração.** Elas ficam gravadas no banco, mas ninguém é avisado. Alguém precisa olhar a tabela.
10. **Carga medida em um computador só.** 30 pedidos ao mesmo tempo, com os dados de exemplo. Não representa a hospedagem nem um banco com milhares de anúncios.
11. **Aparelhos reais.** O Safari foi testado pelo motor WebKit no Windows. iPhone e Mac de verdade, e o GPS de um celular na rua, ainda não foram testados.
12. **Celular e tablet testados por simulação.** O menu do celular, o sininho e as mensagens foram testados em telas simuladas de celular e tablet nos navegadores da seção 5; no aparelho de verdade, foram conferidos à mão.
13. **Sair da conta encerra a sessão em todos os aparelhos.** É o comportamento escolhido por segurança, mas o usuário pode estranhar.
14. **Arquivar conversa fica só no navegador.** Em outro aparelho a conversa aparece de novo na lista.

## 10. Como repetir os testes

Na pasta `backend`, com um banco só para os testes (os testes recriam e alteram os dados):

```
npm run banco
npm test
```

Na pasta `frontend`:

```
npm run lint
npm run build
npm run e2e
```

Conferência de fotos, na pasta `backend`:

```
npm run fotos
npm run fotos -- --apagar
```

## 11. Conferência do site publicado (Azure, 23/11/2026)

Depois da mudança para a Azure, o site publicado (<https://desapegauai.com.br>) foi conferido de fora, como um visitante, e por dentro do servidor. Foi tudo só leitura: nenhum dado foi criado ou apagado.

| Conferência | Resultado |
| --- | --- |
| Telas públicas em 7 navegadores (Chrome, Edge, Firefox, WebKit, celular Android, iPhone e tablet): início, acessibilidade, VLibras, categorias com filtros, busca, mapa, Procura-se, ajuda, termos, privacidade e página que não existe | Todas abriram, sem erro do site no navegador |
| Telas da conta sem login (perfil, anunciar, conversas e favoritos) | Levam para a tela de entrar, com o botão do Google |
| Chat em tempo real (wss) | Conecta nos 7 navegadores |
| API: cidades, bairros, busca, anúncios perto de um ponto, mapa, endereço de um ponto, CEP de rua, Procura-se e chave dos avisos | Respondem certo |
| Cabeçalhos de segurança | CSP, HSTS (1 ano), X-Content-Type-Options, X-Frame-Options, Referrer-Policy e Cross-Origin presentes |
| HTTPS | Certificado do Let's Encrypt válido até fevereiro de 2027; TLS 1.2 e 1.3 aceitos, TLS 1.1 recusado; o endereço com http leva para o https |
| Portas abertas para a internet | Só 22 (SSH), 80 e 443. O MySQL (3306) e a API (3333) ficam fechados |
| SQL injection na busca e nos ids | Nenhum efeito: o texto vira busca comum e id inválido dá 400, sem erro do banco na resposta |
| Arquivos escondidos (`.env`, `.git`, `package.json` e `../` no caminho das fotos) | Nada vazou |
| Corpo gigante e JSON quebrado | 413 e 400 |
| Login do Google falso, cookie de sessão falso e sessão sem assinatura | 401 |
| Gravar sem login (anúncio, perfil, favorito e exclusão) | 401 |
| Outro site chamando a API | Sem permissão (CORS) |
| Login de teste | Desligado no site publicado (404) |
| Servidor por dentro | API, Caddy e MySQL ligados; a API roda com usuário próprio, sem ser root; SSH só com chave; MySQL só em 127.0.0.1; arquivo de senhas legível só pelo root e pelo grupo da API (640), com todos os segredos preenchidos; atualizações de segurança automáticas ligadas; nenhum erro da API nas últimas 12 horas |
| Fotos no servidor | A biblioteca de imagens (sharp) funciona na máquina nova |
| Dependências com falha conhecida (`npm audit --omit=dev`) | Nenhuma, na API e no site |

O VLibras tenta carregar um rastreador de estatísticas (PostHog) do jsDelivr. A CSP do site bloqueia de propósito, para os dados de quem visita não irem para terceiros. O VLibras funciona normalmente.

**Ajuste feito nesse dia:** a API passou a escutar só por dentro da máquina (`HOST=127.0.0.1`), e quem vem da internet passa pelo Caddy. O firewall da Azure já fechava a porta 3333; agora ela também fica fechada por dentro. Também entrou a cópia de segurança automática do banco e das fotos, todo dia de madrugada, com um comando para baixar a cópia para o computador e outro para restaurar num servidor novo (`docs/publicacao.md`, "Cópia de segurança").
