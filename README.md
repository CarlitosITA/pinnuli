# Pinnuli

**Pinnuli** (si legge *pìnnuli*, "compresse" in dialetto salentino) è una web app per ricordare e registrare l'assunzione dei farmaci, pensata per persone anziane e per i familiari che le seguono.

- Dashboard per tablet a muro, con promemoria a tutto schermo e un grande tasto "L'ho presa".
- Monitoraggio da telefono per i familiari.
- Progettata per l'accessibilità (tremore, vista, udito, memoria).

Siti: [pinnuli.it](https://pinnuli.it) · [pinnuli.com](https://pinnuli.com)

La documentazione di progetto è nella cartella [`docs/`](docs/).

## Provarla in locale

Servono Node 22 e un PostgreSQL (anche `docker run -p 5433:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine`).

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # poi adattare DATABASE_URL e le password
npm run db:migrate
ADMIN_PASSWORD='una-password' npm run db:seed  # crea il familiare, la paziente e la terapia di esempio
npm run dev                                    # app su http://localhost:3000
npm run worker                                 # in un altro terminale: promemoria, avvisi, Telegram
```

- **Tablet**: aprire `/t`, compare un codice di 6 cifre. Dal telefono (`/app` → *Altro*) il familiare lo inserisce e il tablet si collega.
- **Telefono al posto del tablet**: aprire `/t` anche sul telefono; si collega con lo stesso codice. Sul telefono compare la proposta «Attiva gli avvisi» (notifiche push, anche a schermo spento): Android dal browser, iPhone dopo «Aggiungi alla schermata Home». Le notifiche richiedono le chiavi VAPID (`npx web-push generate-vapid-keys`, poi `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) e il worker in esecuzione.
- **Altri familiari**: da *Altro* → *Familiari* → «Crea l’invito». Il link (vale 7 giorni, una volta sola) lo apre la persona invitata, che sceglie da sé email e password. Gli avvisi arrivano in ordine, uno dopo l’altro.
- **Familiare**: `/login`, poi *Oggi*, *Terapia*, *Storico*, *Altro*.
- La terapia di esempio (orari dei pasti 13:00 e 20:00, dosi) è modificabile da *Terapia*. `SEED_THERAPY=0` crea solo utente e paziente.

## Test

```bash
npm run typecheck
npm test                 # motore delle regole (packages/core) + integrazione con PostgreSQL (apps/web)
npm run build && npm run start &
npm run e2e -w @pinnuli/web   # tablet + telefono in un browser vero, con controllo di accessibilità (axe)
```

## Installazione sulla VPS

Vedere [`deploy/`](deploy/) e [`deploy/vps-inventario.md`](deploy/vps-inventario.md). Non è stata eseguita nessuna installazione.
