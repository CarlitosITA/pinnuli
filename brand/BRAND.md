# Pìnnuli — identità di marca

> Versione 1 (9 novembre 2026). Tavole visive: `design/canvas/` (sorgenti) e `design/mockups/` (HTML).

## 1. Nome

**Pìnnuli** significa «compresse» in dialetto salentino. Si pronuncia con l'accento sulla prima *i*: **PÌN‑nu‑li**.

- Nel logotipo è sempre **minuscolo** e con l'**accento grave** sulla prima i: `pìnnuli`. L'accento fa parte del marchio e insegna la pronuncia.
- Nei testi correnti si scrive **Pìnnuli** (maiuscola iniziale, accento mantenuto). Il dominio e il repository restano `pinnuli` senza accento.
- Non si traduce e non si declina al singolare («un pinnulo» non esiste nel prodotto).

## 2. Marchio

Una **compressa rotonda la cui linea di rottura è un segno di spunta**. Il gesto centrale del prodotto, «l'ho presa», è il logo.

| File | Uso |
|---|---|
| `logo/pinnuli-mark.svg` | marchio su sfondi chiari (terracotta su calce) |
| `logo/pinnuli-mark-notte.svg` | marchio su sfondi scuri (terracotta notte, spunta scura) |
| `logo/pinnuli-mark-mono.svg` | monocromo, eredita `currentColor` (stampa, timbri, documenti) |
| `logo/pinnuli-lockup.svg` | marchio + logotipo orizzontale |
| `logo/pinnuli-app-icon.svg` | icona app e PWA (quadrato arrotondato terracotta, compressa chiara) |
| `logo/favicon.svg` | favicon, tratto più spesso per le dimensioni piccole |

Regole: spazio di rispetto pari a metà del diametro su ogni lato; dimensione minima 24 px; mai ruotato, mai con ombre, sfumature o contorni aggiunti; mai dentro una frase come sostituto della parola.

Il logotipo usa **Atkinson Hyperlegible Bold**, spaziatura −3 %. In `pinnuli-lockup.svg` il testo è ancora un elemento `<text>`: prima dell'uso su stampa o su piattaforme che non caricano il font, convertirlo in tracciati.

## 3. Palette «Salento»

Calce bianca, terracotta, ulivo, mare. Tutte le coppie testo/sfondo superano **4.5:1**; le informazioni chiave per la paziente superano **7:1**. Valori e usi in `tokens/tokens.json`, variabili CSS in `tokens/tokens.css`.

| Nome | Hex | Uso |
|---|---|---|
| Calce | `#FBF7F0` | sfondo di giorno |
| Sabbia | `#F1E7D6` | superfici secondarie |
| Lino | `#E6DCCB` | bordi, divisori |
| Carrubo | `#231F1A` | testo (15.3:1) |
| Pietra | `#6B625A` | testo secondario (5.6:1) |
| **Terracotta** | `#A63F19` | marchio, azione primaria, stato «adesso / da confermare» |
| Ulivo | `#3E6B2F` | stato «presa», tasto L'HO PRESA |
| Mare | `#1D5C8A` | informazioni, variazioni temporanee |
| Rubino | `#A3182E` | stato «in ritardo / non presa», avvisi |
| Notte | `#16130F` | sfondo del tema notte (accenti: `#E0744A`, `#8FBF6A`) |

Corrispondenza con la specifica funzionale (`docs/08`, § 8.4): verde = Ulivo, arancione = Terracotta, rosso = Rubino, grigio = Pietra. Il colore **non è mai da solo**: ogni stato è colore + icona + parola.

### Stati di una dose

| Stato | Colore | Icona | Parola |
|---|---|---|---|
| Presa | Ulivo | cerchio pieno con spunta | «Presa» + ora |
| Adesso / da confermare | Terracotta | orologio | «Adesso», «Prossima» |
| In ritardo / non presa | Rubino | punto esclamativo | «In ritardo» + minuti |
| Più tardi | Pietra | cerchio tratteggiato | ora prevista |
| Saltata | Pietra | X | «Saltata» + chi |
| Sospeso | Pietra | pausa | «Sospeso» + quando riprende |

## 4. Tipografia

- **Atkinson Hyperlegible** (Google Fonts, pesi 400 e 700) per tutta l'interfaccia: progettato per chi vede poco, distingue I/l/1 e O/0.
- **Young Serif** solo per sito e materiali di marca (titoli editoriali, claim). Mai nell'app.
- Interlinea ≥ 1.3; mai corsivo; maiuscolo solo sui tasti e sulle etichette brevi.
- Dimensioni minime (tablet): orologio 120, nome farmaco nel promemoria 76, testo del tasto primario 56, testo corrente 28, minimo assoluto 22. Telefono paziente: 64 / 52 / 44 / 22 / 18. Caregiver: base 17, minimo 16.

```html
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Young+Serif&display=swap" rel="stylesheet">
```

## 5. Tono di voce

**Parla come un figlio premuroso, non come un medico.**

- Tu, presente, frasi brevi. «È l'ora del Sinemet», mai «Somministrazione prevista».
- Parole intere: «compressa», «minuti», mai «cpr», «min».
- Niente gergo tecnico con la paziente: «Non riesco a collegarmi. Le medicine funzionano lo stesso.»
- Caldo ma mai infantile: «Brava!» dopo una presa va bene; faccine ed emoji no.
- Una cosa alla volta: una decisione per schermata.

Claim: **«Le tue compresse, all'ora giusta.»**

Aggettivi guida: caldo, mediterraneo · calmo, mai allarmista · dignitoso, non infantile · una cosa alla volta.

## 6. Suono (da produrre)

- Promemoria: un motivo unico di 3 note, frequenze 500–2000 Hz, volume crescente in 30 s, ripetuto ogni 2 minuti.
- Conferma: una nota breve e «positiva», diversa dal promemoria.
- Voce italiana, velocità 0.85×. Tutto ciò che è detto è anche scritto.
