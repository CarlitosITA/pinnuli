# Design — mockup e decisioni UI

Tavole navigabili (canvas con Play): https://claude.ai/artifact/NabqkNZtSxy4SsVfinGq3j

- `mockups/index.html` — galleria HTML statica di tutte le schermate, apribile in qualsiasi browser (i pulsanti sono collegati tra le schermate).
- `mockups/*.html` — una schermata per file, dimensioni reali (tablet 1280×800, telefono 390×844).
- `canvas/` — sorgenti delle tavole nel formato del canvas (`.dc.html` + `canvas.json`): stesso HTML, con il wrapper del canvas.

## Schermate disegnate

| File | Schermata (rif. `docs/09`) | Stato mostrato |
|---|---|---|
| `Main` | Identità di marca | — |
| `Palette` | Palette, tipografia, stati, misure di tocco | — |
| `Tablet-Giorno` | P3 Giornata (riposo) | tutto in regola, prossima dose tra 25 minuti |
| `Tablet-Giorno-DaConfermare` | P3 Giornata (riposo) | una dose da confermare (riquadro arancione 160 px che apre P9) |
| `Tablet-Promemoria` | P4 Promemoria singolo | prima chiamata |
| `Tablet-Presa` | P7 Conferma avvenuta | con «Annulla» 10 s |
| `Tablet-Ritardo` | P9 Dose senza risposta | 22 minuti, caregiver avvisato |
| `Tablet-Notte` | P12 Notte + P5 gruppo | riposo notturno, 22:30 con 2 farmaci |
| `Phone-Oggi` | C3/C4 Oggi | con allerta aperta |
| `Phone-Terapia` | C6 Terapia | 8 farmaci, uno a durata limitata, uno sospeso |
| `Phone-Farmaco` | C7/C8 Modifica farmaco e regola | antibiotico per 7 giorni |
| `Phone-Avviso` | C14 Allerta aperta | cronologia ed azioni |
| `Phone-Paziente` | P3 su telefono | — |
| `Phone-Paziente-DaConfermare` | P3 su telefono | una dose da confermare (riquadro 128 px) |
| `Phone-Paziente-Promemoria` | P4 su telefono | — |

Non ancora disegnate (prossima iterazione): P1 Collegamento, P2 Buongiorno, P6 scelta nel gruppo, P8 motivi «Non la prendo», P10 già presa, P11 conferma in anticipo (nel prototipo il riquadro «Prossima dose» porta direttamente alla conferma P7), P13–P17, C1/C2 onboarding, C9–C13, C15–C18, sito W1–W5.

## Decisioni di UX prese nei mockup

1. **Nessuna finestra «Sei sicuro?»** sulle azioni frequenti: dopo «L'HO PRESA» appare la conferma verde con «Ho sbagliato, annulla» per 10 secondi, poi si torna da soli alla giornata.
2. **Posizioni fisse**: l'ora sempre in alto; il tasto verde sempre a destra (tablet) o in basso (telefono); «Annulla» è messo in basso a sinistra, lontano dal punto in cui era il tasto verde, per non essere colpito da un secondo tocco involontario (decisione D17).
3. **Il promemoria occupa tutto lo schermo** con il colore del marchio (terracotta); il ritardo usa Rubino; la conferma usa Ulivo. Lo sfondo intero dice lo stato anche da lontano.
4. **Lista della giornata non toccabile sul tablet** (solo lettura, righe 76 px): decisione D16 della specifica. Nella schermata di riposo si toccano solo due riquadri: **«Prossima dose»** (apre la conferma in anticipo, P11) e, solo quando c'è una dose mancata, **«Da confermare»** sopra di esso (160 px sul tablet, 128 sul telefono, apre P9).
5. **Tasto primario sul tablet**: ~430 px di altezza su 800 (oltre 1/3); tasti secondari 120 px; «Non la prendo» è discreto (bordo attenuato) e, come da specifica, richiederà conferma esplicita.
6. **Disegni dei farmaci** invece di foto nei mockup: forma + colore coerenti (rotonda gialla, capsula, bustina, ovale). La foto reale, quando c'è, prende il posto del disegno.
7. **Barra del caregiver a 4 voci**: Oggi, Terapia, Storico, Altro.
8. Orari dei pasti nei dati di esempio: pranzo 13:00 (Peridon 12:45), cena 20:00 (Peridon 19:45), come in `docs/02` § 2.9.

## Regole di accessibilità applicate (riassunto di `docs/05`)

- Solo tocchi singoli; niente scorrimenti laterali, pressioni lunghe, doppi tocchi.
- Azione al rilascio del dito; tocchi ripetuti entro 800 ms ignorati; prima di tutto il primo dito.
- Testo ≥ 28 px sul tablet (22 per etichette), ≥ 22 sul telefono paziente (18 minimo), ≥ 17 nell'app caregiver.
- Contrasto ≥ 7:1 sulle informazioni chiave per la paziente, ≥ 4.5:1 ovunque.
- Stato = colore + icona + parola. Tema notte automatico. Pulsazione lenta, mai lampi.
- Elementi reali (`<a>`, `<button>`, `<input>` con `<label>`) anche nei mockup, così la struttura è già accessibile.
