#!/usr/bin/env bash
# Cópia de segurança do banco e das fotos do site publicado.
#
#   sudo bash /opt/desapegauai/servidor/copia-de-seguranca.sh                       faz uma cópia agora
#   sudo bash /opt/desapegauai/servidor/copia-de-seguranca.sh --ligar               liga a cópia automática de todo dia
#   sudo bash /opt/desapegauai/servidor/copia-de-seguranca.sh --para-baixar         deixa a cópia mais nova pronta para baixar
#   sudo bash /opt/desapegauai/servidor/copia-de-seguranca.sh --restaurar ARQUIVO   põe de volta o banco e as fotos de uma cópia
#
# As cópias ficam em /var/backups/desapegauai (as 7 mais novas). O instalar.sh e o atualizar.sh ligam a cópia
# automática, que roda todo dia de madrugada. Para não depender só do servidor, baixe uma cópia para o computador
# de vez em quando (veja "Cópia de segurança" no docs/publicacao.md).
set -euo pipefail

PASTA=/opt/desapegauai
FOTOS=/var/lib/desapegauai
USUARIO=desapegauai
COPIAS=/var/backups/desapegauai
GUARDAR="${GUARDAR:-7}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo." >&2
  exit 1
fi

# pastas temporárias: saem no fim, mesmo se der erro no meio
TEMPORARIAS=()
trap 'rm -rf "${TEMPORARIAS[@]}"' EXIT

mais_nova() { ls -1t "$COPIAS"/desapegauai-*.tar.gz 2>/dev/null | sed -n 1p || true; }

fazer_copia() {
  mkdir -p "$COPIAS"
  chmod 700 "$COPIAS"
  local temporaria destino pasta
  local pastas=()
  temporaria="$(mktemp -d)"
  TEMPORARIAS+=("$temporaria")
  destino="$COPIAS/desapegauai-$(date +%Y-%m-%d-%H%M%S).tar.gz"

  # --single-transaction: copia o banco inteiro de uma vez, sem parar o site
  mysqldump --single-transaction --default-character-set=utf8mb4 desapegauai > "$temporaria/banco.sql"
  for pasta in uploads uploads-privados; do
    if [ -d "$FOTOS/$pasta" ]; then pastas+=("$pasta"); fi
  done
  tar -czf "$destino" -C "$temporaria" banco.sql -C "$FOTOS" "${pastas[@]}"
  chmod 600 "$destino"

  # guarda só as mais novas
  ls -1t "$COPIAS"/desapegauai-*.tar.gz | sed -n "$((GUARDAR + 1)),\$p" | xargs -r rm -f
  echo "Cópia pronta: $destino ($(du -h "$destino" | cut -f1))"
}

ligar() {
  cat > /etc/systemd/system/desapegauai-copia.service <<FIM
[Unit]
Description=DesapegaUai: cópia de segurança do banco e das fotos
After=mysql.service

[Service]
Type=oneshot
ExecStart=/bin/bash $PASTA/servidor/copia-de-seguranca.sh
FIM
  cat > /etc/systemd/system/desapegauai-copia.timer <<'FIM'
[Unit]
Description=DesapegaUai: cópia de segurança todo dia de madrugada

[Timer]
OnCalendar=*-*-* 06:00:00 UTC
RandomizedDelaySec=20min
Persistent=true

[Install]
WantedBy=timers.target
FIM
  systemctl daemon-reload
  systemctl enable --now --quiet desapegauai-copia.timer
  echo "Cópia automática ligada: todo dia por volta das 3h (horário de Brasília), em $COPIAS."
}

para_baixar() {
  local arquivo dono casa
  dono="${SUDO_USER:-root}"
  arquivo="$(mais_nova)"
  if [ -z "$arquivo" ]; then
    fazer_copia >/dev/null
    arquivo="$(mais_nova)"
  fi
  casa="$(getent passwd "$dono" | cut -d: -f6)"
  install -o "$dono" -m 600 "$arquivo" "$casa/desapegauai-copia.tar.gz"
  echo "Pronta para baixar: $casa/desapegauai-copia.tar.gz ($(basename "$arquivo"))"
}

restaurar() {
  local arquivo="${1:-}" temporaria pasta
  if [ -z "$arquivo" ] || [ ! -f "$arquivo" ]; then
    echo "Informe o arquivo da cópia. Exemplo: sudo bash $0 --restaurar /home/ubuntu/desapegauai-copia.tar.gz" >&2
    exit 1
  fi
  temporaria="$(mktemp -d)"
  TEMPORARIAS+=("$temporaria")
  tar -xzf "$arquivo" -C "$temporaria"
  if [ ! -f "$temporaria/banco.sql" ]; then
    echo "Esse arquivo não é uma cópia do DesapegaUai (não tem o banco.sql)." >&2
    exit 1
  fi

  echo "Antes, uma cópia do que está no servidor agora:"
  fazer_copia

  systemctl stop desapegauai
  mysql desapegauai < "$temporaria/banco.sql"
  for pasta in uploads uploads-privados; do
    if [ -d "$temporaria/$pasta" ]; then
      rm -rf "${FOTOS:?}/$pasta"
      mv "$temporaria/$pasta" "$FOTOS/$pasta"
    fi
  done
  chown -R "$USUARIO:$USUARIO" "$FOTOS"
  systemctl start desapegauai
  echo "Banco e fotos restaurados. Quem estava logado precisa entrar de novo, e os avisos no celular precisam ser ligados outra vez."
}

case "${1:-}" in
  "") fazer_copia ;;
  --ligar) ligar ;;
  --para-baixar) para_baixar ;;
  --restaurar) restaurar "${2:-}" ;;
  *)
    echo "Opção desconhecida: $1 (use --ligar, --para-baixar ou --restaurar ARQUIVO)" >&2
    exit 1
    ;;
esac
