#!/bin/sh
set -eu
umask 077
cd "$(dirname "$0")/.."
destination=${1:?Usage: sh deploy/backup.sh /absolute/backup/directory}
case "$destination" in /*) ;; *) echo 'Backup directory must be absolute.' >&2; exit 1 ;; esac
mkdir -p "$destination"
docker compose exec -T app node scripts/admin.mjs backup
filename=$(docker compose exec -T app node --input-type=module -e "import {readdirSync} from 'node:fs'; const files=readdirSync('/app/data/backups').filter(f=>/^zaruriyat-.*\.sqlite$/.test(f)).sort(); if(!files.length)process.exit(1); console.log(files.at(-1));")
docker compose cp "app:/app/data/backups/$filename" "$destination/$filename"
chmod 600 "$destination/$filename"
printf 'Backup saved: %s\n' "$destination/$filename"
