# Como publicar o DesapegaUai

O site, a API e o banco rodam juntos em um servidor Linux (Ubuntu 24.04). Em produção a API também entrega o site, então tudo fica no mesmo endereço, e o login (cookie) e o chat em tempo real funcionam.

Endereço atual: <https://desapegauai.duckdns.org>

## O que o projeto precisa da hospedagem

| Precisa de | Por quê |
| --- | --- |
| Servidor sempre ligado | O chat e os avisos usam Socket.IO |
| Disco que não apaga | As fotos dos anúncios, do perfil e do chat são arquivos |
| MySQL 8 | A busca por distância usa `ST_Distance_Sphere` |
| Site e API no mesmo endereço | O cookie de login é `sameSite=lax` |

Por isso a Vercel e os planos gratuitos que "dormem" não servem. Usamos uma máquina virtual do [plano gratuito da AWS](https://aws.amazon.com/free/): US$ 100 em créditos (e até mais US$ 100 em tarefas) por 6 meses, sem cobrança no cartão.

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

### 1. Máquina virtual na AWS

- No EC2, crie a máquina com a imagem **Ubuntu 24.04 (arm64)**, o tipo **t4g.micro** (entra no plano gratuito) e disco de 20 GB.
- No grupo de segurança, libere a entrada TCP nas portas **22**, **80** e **443**.
- Reserve um **IP elástico** e associe à máquina. Assim o IP não muda quando ela reinicia.

### 2. Endereço com o DuckDNS

A AWS dá só o número do IP. O nome do site vem do [DuckDNS](https://www.duckdns.org), que é gratuito:

1. Entre com a conta do GitHub.
2. Crie o subdomínio. Por exemplo, `desapegauai` vira `desapegauai.duckdns.org`.
3. No campo **current ip**, coloque o IP elástico da máquina e clique em **update ip**.

### 3. Instalar

Entre no servidor por SSH (usuário `ubuntu`) e rode o instalador com o endereço e o ID do cliente OAuth do Google:

```bash
curl -fsSLO https://raw.githubusercontent.com/DesapegaUai/DesapegaUai/main/servidor/instalar.sh
sudo DOMINIO=desapegauai.duckdns.org GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com bash instalar.sh
```

Ele instala o Node.js, o MySQL e o Caddy, baixa o projeto, gera as senhas e as chaves, cria as tabelas com os dados de demonstração e liga tudo. Leva uns 10 minutos. Pode rodar de novo: o que já está pronto fica como está.

Para instalar um código que ainda não está no GitHub, mande um `.tar.gz` do projeto para o servidor (sem os `.env`) e acrescente `CODIGO=/tmp/arquivo.tar.gz` no comando.

### 4. Login com o Google

No [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

- No cliente OAuth do projeto, adicione o endereço do site (por exemplo `https://desapegauai.duckdns.org`, sem barra no fim) em **Origens JavaScript autorizadas**.
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

- Para trocar de ramo (por exemplo, para a `main` depois do merge): `sudo RAMO=main bash /opt/desapegauai/servidor/atualizar.sh`
- Quando o `schema.sql` mudar, acrescente `--banco` no fim. Ele roda o `npm run atualizar`, que ajusta as tabelas sem apagar dados.
- Se o código foi instalado por arquivo (`CODIGO=`), a primeira atualização pelo GitHub é com o instalador: `sudo DOMINIO=desapegauai.duckdns.org RAMO=main bash /opt/desapegauai/servidor/instalar.sh`

## Fim do plano gratuito

O plano gratuito da AWS acaba 6 meses depois do cadastro ou quando os créditos acabam, o que vier primeiro. O saldo aparece no console da AWS, em **Faturamento > Créditos**. Antes do fim, guarde uma cópia do banco e das fotos:

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
