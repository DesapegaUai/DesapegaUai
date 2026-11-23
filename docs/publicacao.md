# Como publicar o DesapegaUai

O site, a API e o banco rodam juntos em um servidor Linux (Ubuntu 24.04). Em produção a API também entrega o site, então tudo fica no mesmo endereço, e o login (cookie) e o chat em tempo real funcionam.

Endereço oficial: <https://desapegauai.com.br> (o `www` leva para ele)

## O que o projeto precisa da hospedagem

| Precisa de | Por quê |
| --- | --- |
| Servidor sempre ligado | O chat e os avisos usam Socket.IO |
| Disco que não apaga | As fotos dos anúncios, do perfil e do chat são arquivos |
| MySQL 8 | A busca por distância usa `ST_Distance_Sphere` |
| Site e API no mesmo endereço | O cookie de login é `sameSite=lax` |

Por isso a Vercel e os planos gratuitos que "dormem" não servem. Usamos uma máquina virtual Linux da [conta gratuita da Azure](https://azure.microsoft.com/free/), que inclui uma máquina pequena grátis por 12 meses.

Até 23/11/2026 o site ficou no plano gratuito da AWS. A AWS suspendeu a conta para uma verificação de cadastro e o site passou para a Azure, com o banco começando do zero (os dados até ali eram de teste).

## O que fica no servidor

| Onde | O quê |
| --- | --- |
| `/opt/desapegauai` | O código |
| `/var/lib/desapegauai` | As fotos enviadas pelo site |
| `/etc/desapegauai.env` | Senhas e chaves (o `.env` da produção). Só o servidor tem esse arquivo |
| Serviço `desapegauai` | A API, que também entrega o site, na porta 3333 |
| Caddy | Recebe os acessos em HTTPS (portas 80 e 443), renova o certificado sozinho e repassa para a API |
| MySQL | Aceita conexão só de dentro do servidor |

## Primeira vez

### 1. Máquina virtual na Azure

- No portal da Azure, em **Máquinas virtuais > Criar**, use a imagem **Ubuntu Server 24.04 LTS (x64)** e um tamanho que entre no gratuito. A nossa é a **B2ats v2** (2 processadores e 1 GB de memória), na região **West US 2**. Com 1 GB de memória basta, porque o instalador cria uma memória extra no disco.
- No disco do sistema, use **SSD Premium de 64 GB (P6)**, o tamanho que entra no gratuito.
- Em **Autenticação**, escolha **Chave pública SSH**, com o usuário `ubuntu`. Dá para usar uma chave que já existe no computador (a nossa é `~/.ssh/desapegauai_oracle`, a mesma da primeira publicação).
- Em **Portas de entrada**, libere **SSH (22)**, **HTTP (80)** e **HTTPS (443)**.
- Deixe o **IP público** como **Estático**. Assim o IP não muda quando a máquina reinicia.

### 2. Endereço do site

A Azure dá só o número do IP. O domínio oficial, `desapegauai.com.br`, foi registrado no [Registro.br](https://registro.br). No painel do domínio, em **DNS** (modo avançado), ficam estes registros:

| Nome | Tipo | Valor |
| --- | --- | --- |
| (vazio, o próprio domínio) | A | IP público da máquina |
| www | CNAME | desapegauai.com.br |
| (vazio) | TXT | `v=spf1 -all` (avisa que nenhum e-mail sai do domínio, o que dificulta e-mail falso em nome do site) |
| (vazio) | TXT | o código `google-site-verification` do Search Console |

Ao trocar de servidor, basta mudar o IP do registro **A**. A mudança pode levar de alguns minutos a algumas horas para valer na internet.

Antes do domínio próprio, o site usou um endereço gratuito do [DuckDNS](https://www.duckdns.org) (`desapegauai.duckdns.org`), que não é mais usado.

### 3. Instalar

Entre no servidor por SSH (usuário `ubuntu`, com a chave escolhida na criação da máquina) e rode o instalador com o endereço e o ID do cliente OAuth do Google:

```bash
curl -fsSLO https://raw.githubusercontent.com/DesapegaUai/DesapegaUai/main/servidor/instalar.sh
sudo DOMINIO=desapegauai.com.br REDIRECIONAR="www.desapegauai.com.br" GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com bash instalar.sh
```

Ele instala o Node.js, o MySQL e o Caddy, baixa o projeto, gera as senhas e as chaves, cria as tabelas com os dados de demonstração e liga tudo. Leva uns 10 minutos. Pode rodar de novo: o que já está pronto fica como está.

Para instalar um código que ainda não está no GitHub, mande um `.tar.gz` do projeto para o servidor (sem os `.env`) e acrescente `CODIGO=/tmp/arquivo.tar.gz` no comando.

### 4. Login com o Google

No [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

- No cliente OAuth do projeto, adicione o endereço do site (`https://desapegauai.com.br`, sem barra no fim) em **Origens JavaScript autorizadas**.
- Na tela de consentimento (Branding), coloque `desapegauai.com.br` em **Domínios autorizados** e use o domínio novo nos links da página inicial, da Política de Privacidade e dos Termos de Uso.
- Na tela de consentimento (Público-alvo), publique o app (status **Em produção**). Enquanto ele estiver em teste, só os e-mails da lista de testadores conseguem entrar.

## Conferir

- `https://SEU-ENDERECO/api/saude` tem que mostrar `{"api":"ok","banco":"ok"}`.
- O site abre no mesmo endereço, sem o `/api`.

## Atualizar o site

Depois que a mudança estiver no GitHub:

```bash
sudo bash /opt/desapegauai/servidor/atualizar.sh
```

Ele baixa a última versão do mesmo ramo, monta o site e reinicia a API. O banco e as fotos ficam como estão.

Do computador, dá para rodar sem entrar no servidor (no PowerShell):

```powershell
ssh -i $HOME\.ssh\desapegauai_oracle ubuntu@20.69.91.127 "sudo bash /opt/desapegauai/servidor/atualizar.sh"
```

- Para trocar de ramo (por exemplo, para a `main` depois do merge): `sudo RAMO=main bash /opt/desapegauai/servidor/atualizar.sh`
- Quando o `schema.sql` mudar, acrescente `--banco` no fim. Ele roda o `npm run atualizar`, que ajusta as tabelas sem apagar dados.
- Se o código foi instalado por arquivo (`CODIGO=`), a primeira atualização pelo GitHub é com o instalador: `sudo DOMINIO=desapegauai.com.br RAMO=main bash /opt/desapegauai/servidor/instalar.sh`

## Trocar o endereço do site

Depois de apontar o domínio novo para o servidor (veja "Endereço do site"):

```bash
sudo NOVO=desapegauai.com.br bash /opt/desapegauai/servidor/trocar-dominio.sh
```

Ele confere se o domínio novo já aponta para o servidor. Se não aponta, para sem mexer em nada. Se aponta, troca o endereço, pega o certificado HTTPS do domínio novo e faz o `www` e o endereço antigo levarem para o novo. Depois, cadastre o endereço novo no Google Cloud (veja "Login com o Google").

## Aparecer no Google

O site já entrega o que o Google precisa: o `robots.txt` (o que ele pode ler), o `sitemap.xml` (a lista de páginas e anúncios ativos, que se atualiza sozinha) e, em cada página, o título, a descrição e a foto dela. As telas da conta e os perfis das pessoas ficam fora do Google.

Para o Google começar a mostrar o site:

1. Entre em search.google.com/search-console com a conta Google do grupo.
2. Clique em **Adicionar propriedade**, escolha **Domínio** e digite `desapegauai.com.br`.
3. Copie o código **TXT** que o Google mostrar. No Registro.br, abra o **DNS** do domínio e adicione um registro **TXT** com esse código. Volte ao Search Console e clique em **Verificar** (às vezes leva alguns minutos).
4. Em **Sitemaps**, envie `https://desapegauai.com.br/sitemap.xml`.
5. Em **Inspeção de URL**, cole `https://desapegauai.com.br` e clique em **Solicitar indexação**.

O Google leva de alguns dias a algumas semanas para mostrar o site. Para ver o que ele já guardou, pesquise `site:desapegauai.com.br` no Google.

## Tirar os anúncios de exemplo

O instalador coloca no banco as contas de exemplo do `seed.sql` (Diego, Larissa e Usuário Teste) e os anúncios delas, para o site não abrir vazio. Para deixar no ar só os anúncios de verdade:

```bash
sudo bash /opt/desapegauai/servidor/remover-demonstracao.sh
sudo bash /opt/desapegauai/servidor/remover-demonstracao.sh --confirmar
```

O primeiro comando só mostra o que seria apagado. O segundo apaga essas três contas com os anúncios, as conversas, os favoritos e as fotos delas, como o "Excluir minha conta" do site. As contas criadas pelo login do Google não são tocadas.

## Fim do período gratuito

Na conta gratuita da Azure, o crédito inicial vale 30 dias. Enquanto a conta é de avaliação, o limite de gastos fica ligado e nada é cobrado no cartão. Para continuar com os serviços gratuitos de 12 meses, como a máquina pequena, a conta precisa ser convertida para **pagamento conforme o uso** antes desse prazo; o que passar do limite gratuito é cobrado no cartão. Os gastos aparecem no portal, em **Gerenciamento de Custos**. De tempos em tempos, e antes do fim dos 12 meses, guarde uma cópia do banco e das fotos:

```bash
sudo mysqldump desapegauai > desapegauai.sql
sudo tar -czf fotos.tar.gz /var/lib/desapegauai
```

## Quando algo der errado

| Comando | Mostra |
| --- | --- |
| `sudo systemctl status desapegauai` | Se a API está ligada |
| `sudo journalctl -u desapegauai -n 50` | As últimas mensagens da API |
| `sudo journalctl -u caddy -n 50` | Problemas com o HTTPS |
