# Sito pinnuli.it

Landing statica di Pìnnuli: un solo file, `index.html`, senza build e senza dipendenze (i font arrivano da Google Fonts).

- Colori e caratteri sono quelli di `brand/tokens/tokens.css`; gli schermi dell'app sono ridisegnati in HTML e CSS a partire da `design/mockups/`.
- Per vederla basta aprire `index.html` nel browser.
- Online su https://pinnuli.it dall'11 novembre 2026. Per aggiornarla basta copiare `index.html` (e `favicon.svg`) in `~/caddy-extra/pinnuli-site/` sulla VPS: non serve ricaricare Caddy. La regola è in `deploy/pinnuli.caddy`.
