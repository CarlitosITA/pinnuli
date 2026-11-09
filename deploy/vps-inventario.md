# Installazione sulla VPS — piano (da approvare prima di eseguire)

Stato: **non eseguita**. Mancano le credenziali della VPS. Pìnnuli aggiunge, non modifica: niente di ciò che c'è già va toccato.

## 1. Sola lettura: cosa c'è già sulla VPS

Da compilare dopo il primo accesso, senza segreti.

| Cosa | Comando (solo lettura) | Risultato |
|------|------------------------|-----------|
| Sistema, RAM, disco | `cat /etc/os-release; free -h; df -h` | |
| Docker e Compose | `docker --version; docker compose version` | |
| Reverse proxy in uso e certificati | `systemctl status nginx caddy traefik apache2` | |
| Porte occupate | `ss -tlnp` | |
| Reti e container esistenti | `docker network ls; docker ps -a` | |
| Firewall | `ufw status` o `iptables -S` | |
| Backup già presenti | `crontab -l; ls /etc/cron.d` | |

## 2. Installazione (dopo l'approvazione)

1. Utente di sistema `pinnuli` e cartella `/opt/pinnuli`.
2. Copiare `deploy/docker-compose.yml`, `deploy/.env.example` (come `.env`, compilato) e `deploy/backup.sh`.
3. Scegliere una porta libera e metterla in `PINNULI_PORT`.
4. `docker compose up -d` (crea database, migrazioni, sito, worker).
5. Creare il primo familiare e il paziente: `docker compose run --rm pinnuli_migrate npm run db:seed` con `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PATIENT_NAME` (e `SEED_THERAPY=0` se non si vuole la terapia di esempio).
6. Aggiungere **un solo file** di virtual host (`deploy/nginx-app.pinnuli.it.conf`), `nginx -t`, `reload`.
7. Certificato TLS con lo strumento già in uso.
8. Pianificare `deploy/backup.sh` e provare un ripristino.
9. Telegram (facoltativo): impostare il token e registrare il webhook `https://app.pinnuli.it/api/telegram/webhook` con il segreto scelto.

## 3. Cosa non si fa

Nessuna modifica ai virtual host esistenti, al firewall, ai container o ai database già presenti. Nessun riavvio del reverse proxy (solo `reload` dopo `nginx -t`).

## 4. Annullare tutto

`docker compose -p pinnuli down -v`, rimuovere `/opt/pinnuli` e il file di virtual host aggiunto.
