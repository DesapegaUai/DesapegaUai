#!/usr/bin/env bash
# Prepara um servidor Ubuntu 24.04 novo para rodar o DesapegaUai inteiro: site, API e MySQL.
#
#   sudo DOMINIO=desapegauai.com.br GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com bash instalar.sh
#
# REDIRECIONAR (opcional): outros endereços que levam para o DOMINIO, separados por espaço.
#   sudo DOMINIO=desapegauai.com.br REDIRECIONAR="www.desapegauai.com.br desapegauai.duckdns.org" bash instalar.sh
#
# Pode rodar de novo sem medo: o que já está pronto fica como está (as senhas, as chaves e os dados
# do banco não mudam). O passo a passo está em docs/publicacao.md.
set -euo pipefail

DOMINIO="${DOMINIO:?Informe o endereço do site. Exemplo: sudo DOMINIO=desapegauai.com.br bash instalar.sh}"
REDIRECIONAR="${REDIRECIONAR:-}"
REPOSITORIO="${REPOSITORIO:-https://github.com/DesapegaUai/DesapegaUai.git}"
RAMO="${RAMO:-main}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"

PASTA=/opt/desapegauai            # o código (cópia do GitHub)
FOTOS=/var/lib/desapegauai        # as fotos enviadas pelo site
AMBIENTE=/etc/desapegauai.env     # senhas e chaves (o .env da produção)
USUARIO=desapegauai               # a API não roda como root

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo." >&2
  exit 1
fi

etapa() { printf '\n==> %s\n' "$1"; }
# no primeiro boot o Ubuntu fica atualizando sozinho; aqui espera ele terminar em vez de dar erro
apt_get() { apt-get -q -o DPkg::Lock::Timeout=600 "$@"; }

etapa "Esperando o servidor terminar de ligar"
if command -v cloud-init >/dev/null; then
  cloud-init status --wait >/dev/null 2>&1 || true
fi

etapa "Memória de troca (ajuda nos servidores com pouca memória)"
if ! swapon --show | grep -q .; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

etapa "Programas: Git, MySQL, Caddy (HTTPS) e Node.js 24"
export DEBIAN_FRONTEND=noninteractive
apt_get update
apt_get install -y ca-certificates curl git openssl mysql-server caddy
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt_get install -y nodejs
fi

etapa "Firewall do próprio servidor: libera as portas 80 e 443"
# As imagens Ubuntu da Oracle Cloud vêm com uma regra que recusa tudo, menos o SSH.
# As regras novas entram antes dela.
if command -v iptables >/dev/null && iptables -S INPUT | grep -q -- '-j REJECT'; then
  for porta in 443 80; do
    regra=(-p tcp -m state --state NEW -m tcp --dport "$porta" -j ACCEPT)
    iptables -C INPUT "${regra[@]}" 2>/dev/null || iptables -I INPUT 1 "${regra[@]}"
  done
  if command -v netfilter-persistent >/dev/null; then
    netfilter-persistent save >/dev/null 2>&1
  fi
fi
if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

etapa "MySQL com pouca memória, aceitando conexão só do próprio servidor"
cat > /etc/mysql/mysql.conf.d/zz-desapegauai.cnf <<'FIM'
[mysqld]
bind-address = 127.0.0.1
mysqlx = OFF
performance_schema = OFF
innodb_buffer_pool_size = 128M
max_connections = 40
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
FIM
systemctl restart mysql

etapa "Usuário e pastas"
id "$USUARIO" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$USUARIO"
mkdir -p "$PASTA" "$FOTOS/uploads" "$FOTOS/uploads-privados"
chown -R "$USUARIO:$USUARIO" "$PASTA" "$FOTOS"

if [ -n "${CODIGO:-}" ]; then
  # código enviado num .tar.gz (por exemplo, antes de ele estar no GitHub)
  etapa "Código do arquivo $CODIGO"
  if [ ! -f "$CODIGO" ]; then
    echo "Arquivo não encontrado: $CODIGO" >&2
    exit 1
  fi
  find "$PASTA" -mindepth 1 -delete
  sudo -H -u "$USUARIO" tar -xzf "$CODIGO" -C "$PASTA"
elif [ -d "$PASTA/.git" ]; then
  etapa "Código do GitHub ($RAMO)"
  sudo -H -u "$USUARIO" git -C "$PASTA" fetch --quiet origin "$RAMO"
  sudo -H -u "$USUARIO" git -C "$PASTA" checkout --quiet -B "$RAMO" "origin/$RAMO"
else
  # pasta vazia, ou com código que veio por arquivo: daqui em diante segue o GitHub
  etapa "Código do GitHub ($RAMO)"
  find "$PASTA" -mindepth 1 -delete
  sudo -H -u "$USUARIO" git clone --quiet --branch "$RAMO" "$REPOSITORIO" "$PASTA"
fi

etapa "Dependências da API"
(cd "$PASTA/backend" && sudo -H -u "$USUARIO" npm ci --omit=dev --no-audit --no-fund)

etapa "Senhas e chaves em $AMBIENTE"
if [ ! -f "$AMBIENTE" ]; then
  chaves_push="$(cd "$PASTA/backend" && sudo -H -u "$USUARIO" node_modules/.bin/web-push generate-vapid-keys --json)"
  umask 077
  cat > "$AMBIENTE" <<FIM
NODE_ENV=production
PORT=3333
FRONTEND_URL=https://$DOMINIO
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=desapegauai
DB_PASSWORD=$(openssl rand -hex 16)
DB_NAME=desapegauai
JWT_SEGREDO=$(openssl rand -hex 32)
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
VAPID_PUBLIC_KEY=$(node -p 'JSON.parse(process.argv[1]).publicKey' "$chaves_push")
VAPID_PRIVATE_KEY=$(node -p 'JSON.parse(process.argv[1]).privateKey' "$chaves_push")
VAPID_CONTATO=https://github.com/DesapegaUai/DesapegaUai
PASTA_UPLOADS=$FOTOS/uploads
PASTA_UPLOADS_PRIVADOS=$FOTOS/uploads-privados
FIM
  umask 022
else
  # o endereço e o ID do Google podem mudar; as senhas e as chaves ficam
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$DOMINIO|" "$AMBIENTE"
  if [ -n "$GOOGLE_CLIENT_ID" ]; then
    sed -i "s|^GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID|" "$AMBIENTE"
  fi
fi
chown root:"$USUARIO" "$AMBIENTE"
chmod 640 "$AMBIENTE"

etapa "Banco e usuário do MySQL"
senha_do_banco="$(grep '^DB_PASSWORD=' "$AMBIENTE" | cut -d= -f2-)"
mysql <<FIM
CREATE DATABASE IF NOT EXISTS desapegauai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'desapegauai'@'localhost' IDENTIFIED BY '$senha_do_banco';
CREATE USER IF NOT EXISTS 'desapegauai'@'127.0.0.1' IDENTIFIED BY '$senha_do_banco';
ALTER USER 'desapegauai'@'localhost' IDENTIFIED BY '$senha_do_banco';
ALTER USER 'desapegauai'@'127.0.0.1' IDENTIFIED BY '$senha_do_banco';
GRANT ALL PRIVILEGES ON desapegauai.* TO 'desapegauai'@'localhost';
GRANT ALL PRIVILEGES ON desapegauai.* TO 'desapegauai'@'127.0.0.1';
FLUSH PRIVILEGES;
FIM

etapa "Tabelas do banco"
tem_tabelas="$(mysql -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'desapegauai' AND table_name = 'categoria'")"
if [ "$tem_tabelas" = 0 ]; then
  echo "Banco vazio: criando as tabelas, as categorias, os locais da Zona da Mata e os dados de demonstração."
  (
    cd "$PASTA/backend"
    set -a
    # shellcheck disable=SC1090
    . "$AMBIENTE"
    set +a
    # o npm run banco não roda com NODE_ENV=production, porque apaga tudo; aqui o banco está vazio
    sudo -H -u "$USUARIO" --preserve-env=DB_HOST,DB_PORT,DB_USER,DB_PASSWORD,DB_NAME env -u NODE_ENV node database/recriar-banco.js
  )
else
  echo "O banco já tem as tabelas: os dados ficam como estão."
fi

etapa "Serviço da API (liga sozinho quando o servidor reinicia)"
cat > /etc/systemd/system/desapegauai.service <<FIM
[Unit]
Description=DesapegaUai (site e API)
After=network-online.target mysql.service
Wants=network-online.target

[Service]
User=$USUARIO
WorkingDirectory=$PASTA/backend
EnvironmentFile=$AMBIENTE
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
FIM
systemctl daemon-reload
systemctl enable --quiet desapegauai

etapa "HTTPS: o Caddy pega o certificado sozinho e repassa tudo para a API"
cat > /etc/caddy/Caddyfile <<FIM
$DOMINIO {
	encode gzip
	reverse_proxy 127.0.0.1:3333
}
FIM
# os outros endereços (www, endereço antigo) levam para o principal, mantendo o caminho da página
if [ -n "$REDIRECIONAR" ]; then
  cat >> /etc/caddy/Caddyfile <<FIM

$(echo "$REDIRECIONAR" | xargs | sed 's/ /, /g') {
	redir https://$DOMINIO{uri} permanent
}
FIM
fi
systemctl reload caddy || systemctl restart caddy

# monta o site e liga a API
bash "$PASTA/servidor/atualizar.sh" --sem-baixar

etapa "Conferindo o HTTPS (o certificado pode levar um ou dois minutos)"
for _ in $(seq 1 36); do
  if curl -fsS --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/api/saude" >/dev/null 2>&1; then
    echo "Pronto: https://$DOMINIO"
    exit 0
  fi
  sleep 5
done
echo "O certificado HTTPS ainda não saiu para $DOMINIO." >&2
echo "Confira se o endereço aponta para este servidor e se as portas 80 e 443 estão liberadas na rede da hospedagem." >&2
echo "Mensagens do Caddy: sudo journalctl -u caddy -n 50" >&2
exit 1
