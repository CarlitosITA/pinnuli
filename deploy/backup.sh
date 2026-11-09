#!/usr/bin/env bash
# Dump notturno del database di Pìnnuli, compresso, con rotazione a 30 giorni.
# Da lanciare da cron come utente `pinnuli`, ad es.:  15 3 * * * /opt/pinnuli/deploy/backup.sh
# Il file va poi copiato fuori dalla VPS e cifrato (age o restic): vedi docs/06 § 6.7.
set -euo pipefail
DIR="${BACKUP_DIR:-/opt/pinnuli/backup}"
mkdir -p "$DIR"
STAMP="$(date +%Y%m%d-%H%M)"
docker exec pinnuli_db pg_dump -U pinnuli -d pinnuli --no-owner | gzip -9 > "$DIR/pinnuli-$STAMP.sql.gz"
find "$DIR" -name 'pinnuli-*.sql.gz' -mtime +30 -delete
echo "Backup scritto in $DIR/pinnuli-$STAMP.sql.gz"
