#!/usr/bin/env bash
# Atualiza o site no servidor: baixa a última versão do GitHub, monta o site e reinicia a API.
#
#   sudo bash /opt/desapegauai/servidor/atualizar.sh            mesmo ramo de antes
#   sudo RAMO=main bash /opt/desapegauai/servidor/atualizar.sh  troca de ramo
#   sudo bash /opt/desapegauai/servidor/atualizar.sh --banco    também ajusta o banco ao schema.sql
#
# As fotos e os dados do banco ficam como estão.
set -euo pipefail

PASTA=/opt/desapegauai
AMBIENTE=/etc/desapegauai.env
USUARIO=desapegauai

baixar=sim
banco=nao
for opcao in "$@"; do
  case "$opcao" in
    --sem-baixar) baixar=nao ;; # o instalar.sh usa: ele já baixou o código
    --banco) banco=sim ;;
    *)
      echo "Opção desconhecida: $opcao (a única opção é --banco)" >&2
      exit 1
      ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo." >&2
  exit 1
fi

etapa() { printf '\n==> %s\n' "$1"; }

if [ "$baixar" = sim ]; then
  if [ ! -d "$PASTA/.git" ]; then
    echo "O código deste servidor veio por arquivo, sem o GitHub." >&2
    echo "Para atualizar, rode o instalar.sh de novo com CODIGO=<arquivo .tar.gz> ou com RAMO=<ramo do GitHub>." >&2
    exit 1
  fi
  RAMO="${RAMO:-$(sudo -H -u "$USUARIO" git -C "$PASTA" rev-parse --abbrev-ref HEAD)}"
  etapa "Baixando a última versão ($RAMO)"
  sudo -H -u "$USUARIO" git -C "$PASTA" fetch --quiet origin "$RAMO"
  # o servidor não tem mudança própria: fica igual ao GitHub
  sudo -H -u "$USUARIO" git -C "$PASTA" checkout --quiet -B "$RAMO" "origin/$RAMO"
fi

etapa "Dependências da API"
(cd "$PASTA/backend" && sudo -H -u "$USUARIO" npm ci --omit=dev --no-audit --no-fund)

if [ "$banco" = sim ]; then
  etapa "Ajustando o banco ao schema.sql (sem apagar dados)"
  (
    cd "$PASTA/backend"
    set -a
    # shellcheck disable=SC1090
    . "$AMBIENTE"
    set +a
    sudo -H -u "$USUARIO" --preserve-env=NODE_ENV,DB_HOST,DB_PORT,DB_USER,DB_PASSWORD,DB_NAME node database/atualizar-banco.js
  )
fi

etapa "Montando o site"
# o código do botão "Entrar com o Google" entra no site na hora do build
google="$(grep '^GOOGLE_CLIENT_ID=' "$AMBIENTE" | cut -d= -f2-)"
(
  cd "$PASTA/frontend"
  sudo -H -u "$USUARIO" npm ci --no-audit --no-fund
  sudo -H -u "$USUARIO" env VITE_GOOGLE_CLIENT_ID="$google" npm run build
)

etapa "Reiniciando a API"
systemctl restart desapegauai
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3333/api/saude 2>/dev/null; then
    echo
    exit 0
  fi
  sleep 1
done
echo "A API não respondeu. Veja as mensagens com: sudo journalctl -u desapegauai -n 50" >&2
exit 1
