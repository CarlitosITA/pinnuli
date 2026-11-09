# Installazione sulla VPS — piano (da approvare prima di eseguire)

Stato: inventario in sola lettura fatto il 9 novembre 2026; installazione **non ancora eseguita**. Pìnnuli aggiunge, non modifica: niente di ciò che c'è già va toccato.

## 1. Sola lettura: cosa c'è già sulla VPS (VPS-1 OVH «Votia», Gravelines)

Risultato del 9 novembre 2026, senza segreti:

- Ubuntu 26.04.1 LTS, 2 vCPU, RAM 3,7 GiB (circa 2,2 GiB disponibili), swap 2 GiB, disco 38 GB con 16 GB liberi.
- Docker 29.9.2, Compose v5.6.1.
- Nessun proxy sull'host: il reverse proxy è il container `votia-caddy-1` (Caddy), unico a pubblicare 80 e 443. I vhost degli altri progetti sono file in `~/caddy-extra/`.
- Porte in ascolto: 22, 80, 443; 127.0.0.1:3010 (strato). **38100 libera.**
- Reti: `strato_internal`, `votia_default`. Container di altri progetti: votia-*, strato-*, civitask-demo.
- UFW attivo: solo OpenSSH, 80, 443.
- Cron dell'utente `ubuntu`: backup e prova di ripristino di Votia, `docker builder prune` la domenica.
- Da non toccare per nessun motivo: `~/votia` e i suoi container, civitask, strato, salentolights.

Per ripetere il controllo:

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
4. Le immagini si costruiscono su GitHub Actions (non sulla VPS, che ha poca RAM libera) e si scaricano da GHCR: `PINNULI_WEB_IMAGE`/`PINNULI_WORKER_IMAGE` nel `.env`, poi `docker compose pull && docker compose up -d` (crea database, migrazioni, sito, worker).
5. Creare il primo familiare e il paziente: `docker compose run --rm pinnuli_migrate npm run db:seed` con `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PATIENT_NAME` (e `SEED_THERAPY=0` se non si vuole la terapia di esempio).
6. Aggiungere **un solo file** `~/caddy-extra/pinnuli.caddy` (da `deploy/pinnuli.caddy`), `caddy validate`, poi `caddy reload` a caldo sul Caddy di Votia (stesso schema di civitask e strato). Se il proxy fosse un altro, `deploy/nginx-app.pinnuli.it.conf` è l'equivalente per nginx.
7. Certificato TLS: lo ottiene Caddy da solo, ma il DNS di `app.pinnuli.it` deve già puntare a 51.254.222.11.
8. Pianificare `deploy/backup.sh` e provare un ripristino.
9. Notifiche sul telefono: generare le chiavi VAPID (`npx web-push generate-vapid-keys`, anche da un altro computer), metterle in `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) e `docker compose up -d`. Il worker scrive nel log se le notifiche sono attive. Se si cambiano le chiavi, i telefoni devono riattivare gli avvisi.
10. Telegram (facoltativo): impostare il token e registrare il webhook `https://app.pinnuli.it/api/telegram/webhook` con il segreto scelto.

## 3. Cosa non si fa

Nessuna modifica ai virtual host esistenti, al firewall, ai container o ai database già presenti. Nessun riavvio del reverse proxy (solo `reload` dopo `nginx -t`).

## 4. Annullare tutto

`docker compose -p pinnuli down -v`, rimuovere `/opt/pinnuli` e il file di virtual host aggiunto.
