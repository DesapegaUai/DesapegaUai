#!/usr/bin/env bash
# Tira do site publicado as contas de exemplo (Diego, Larissa e Usuário Teste) e tudo delas.
#
#   sudo bash /opt/desapegauai/servidor/remover-demonstracao.sh              mostra o que seria apagado
#   sudo bash /opt/desapegauai/servidor/remover-demonstracao.sh --confirmar  apaga
#
# As contas e os anúncios de verdade ficam como estão.
set -euo pipefail

PASTA=/opt/desapegauai
AMBIENTE=/etc/desapegauai.env
USUARIO=desapegauai

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo." >&2
  exit 1
fi

cd "$PASTA/backend"
set -a
# shellcheck disable=SC1090
. "$AMBIENTE"
set +a
sudo -H -u "$USUARIO" --preserve-env=NODE_ENV,DB_HOST,DB_PORT,DB_USER,DB_PASSWORD,DB_NAME,PASTA_UPLOADS,PASTA_UPLOADS_PRIVADOS \
  node database/remover-demonstracao.js "$@"
