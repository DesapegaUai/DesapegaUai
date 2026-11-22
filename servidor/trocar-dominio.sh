#!/usr/bin/env bash
# Troca o endereço do site (por exemplo, de desapegauai.duckdns.org para desapegauai.com.br).
#
#   sudo NOVO=desapegauai.com.br bash /opt/desapegauai/servidor/trocar-dominio.sh
#
# Antes de mudar, confere se o domínio novo já aponta para este servidor: se o DNS ainda não estiver pronto,
# para sem mexer em nada (o site continua no endereço de antes). Depois da troca, o "www" do domínio novo e
# o endereço antigo levam para o novo. As senhas, o banco e as fotos ficam como estão.
set -euo pipefail

NOVO="${NOVO:?Informe o domínio novo. Exemplo: sudo NOVO=desapegauai.com.br bash trocar-dominio.sh}"
AMBIENTE=/etc/desapegauai.env
PASTA=/opt/desapegauai

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo." >&2
  exit 1
fi

# o IP público deste servidor e o IP para onde o domínio aponta
meu_ip="$(curl -fsS --max-time 10 https://checkip.amazonaws.com | tr -d '[:space:]')"
ip_do_dominio() { getent ahostsv4 "$1" | awk 'NR == 1 { print $1 }'; }

echo "IP deste servidor: $meu_ip"
apontado="$(ip_do_dominio "$NOVO" || true)"
if [ "$apontado" != "$meu_ip" ]; then
  echo "O domínio $NOVO ainda não aponta para este servidor (aponta para: ${apontado:-nada})." >&2
  echo "No Registro.br, crie o registro A de $NOVO para $meu_ip e rode este comando de novo daqui a alguns minutos." >&2
  echo "Nada foi mudado: o site continua no endereço de antes." >&2
  exit 1
fi
echo "OK: $NOVO aponta para este servidor."

# quem vai levar para o endereço novo: o www (se já aponta para cá) e o endereço de antes
redirecionar=""
if [ "$(ip_do_dominio "www.$NOVO" || true)" = "$meu_ip" ]; then
  redirecionar="www.$NOVO"
  echo "OK: www.$NOVO aponta para este servidor e vai levar para $NOVO."
else
  echo "Aviso: www.$NOVO ainda não aponta para cá. Crie o registro A do www e rode este comando de novo depois." >&2
fi
antigo="$(grep '^FRONTEND_URL=' "$AMBIENTE" | cut -d= -f2- | sed 's|^https\?://||; s|/.*$||')"
if [ -n "$antigo" ] && [ "$antigo" != "$NOVO" ]; then
  redirecionar="$redirecionar $antigo"
  echo "OK: o endereço de antes ($antigo) vai levar para $NOVO."
fi

# o instalador refaz o Caddy (com o certificado do domínio novo), troca o FRONTEND_URL, baixa a versão da
# main do GitHub, monta o site e reinicia a API, sem mudar as senhas, o banco nem as fotos
DOMINIO="$NOVO" REDIRECIONAR="$redirecionar" bash "$PASTA/servidor/instalar.sh"
