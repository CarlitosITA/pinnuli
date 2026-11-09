# 9. Inventario delle schermate

Elenco delle schermate e dei loro stati, per guidare mockup e sviluppo. I riferimenti UC rimandano a [03 – Casi d'uso](03-casi-d-uso.md). Per ogni schermata del paziente vanno disegnate due versioni: **tablet orizzontale** (10–11") e **telefono verticale**, e la variante **notte**.

## 9.1 Paziente (tablet e telefono)

| # | Schermata | Stati da disegnare | Contenuto | UC |
|---|-----------|--------------------|-----------|----|
| P1 | **Collegamento** | codice in attesa · collegato | Logo, codice a 6 cifre enorme, QR, "Chiedi a un familiare di inquadrare questo codice" | A4 |
| P2 | **Buongiorno** | mattino prima della sveglia | Saluto con nome, data, tasto "Mi sono svegliata" | C11 |
| P3 | **Giornata (riposo)** | tutto in regola · una dose da confermare · dose cambiata temporaneamente · nessuna dose rimasta oggi · pausa totale | Ora, data, momento, prossima dose con foto e "tra 25 minuti", lista dei momenti con stato | C1 |
| P4 | **Promemoria singolo** | prima chiamata · dopo ripetizioni (più evidente) · con istruzioni · mezza compressa · rinvii esauriti | Foto, nome, quantità con disegno, istruzioni con pittogramma, ora; "L'HO PRESA", "Tra 10 minuti", "Non la prendo" | C2, C3, C6 |
| P5 | **Promemoria di gruppo** | 2 farmaci · 3+ farmaci | Riquadri con foto e quantità; "LE HO PRESE TUTTE (2)", "Non tutte" | C4 |
| P6 | **Scelta singola nel gruppo** | parziale | Un tasto grande per farmaco, "Fatto" | C4 |
| P7 | **Conferma avvenuta** | con "Annulla" visibile (10 s) | Grande ✓ verde, "Fatto", ora, tasto "Annulla" | C3, C5 |
| P8 | **Non la prendo** | scelta motivo | Tre motivi grandi + "Torna indietro" | C7 |
| P9 | **Dose senza risposta** | domanda · risposta "No" con istruzione "se dimenticato" | "Il Sinemet delle 12:30 non è stato confermato. L'hai presa?" | C8 |
| P10 | **Già presa** | — | "Sì, l'hai già presa alle 08:34. Non serve prenderla di nuovo." | C9 |
| P11 | **Dose futura** | prendibile in anticipo · troppo presto | "Il Sinemet è alle 16:30, tra 2 ore" / "Vuoi segnarla come presa adesso?" | C10 |
| P12 | **Notte** | riposo notturno · promemoria notturno | Sfondo scuro, ora, prossima dose | C14 |
| P13 | **Avvisa familiare** (F1) | conferma · inviato · visto | Foto e nome del caregiver | C12 |
| P14 | **Al bisogno** (F1) | elenco · conferma | Massimo 4 farmaci con foto | C13 |
| P15 | **Problemi** | offline (funziona lo stesso) · offline da troppo tempo · audio bloccato · dispositivo scollegato | Messaggi in linguaggio semplice, mai codici d'errore | F3, H6, H16 |
| P16 | **Come mi sento** (F2) | tre opzioni | Faccine + parole | C15 |
| P17 | **Impostazioni nascoste** | PIN · menu | Volume, luminosità, test suono, ricarica, scollega. Solo per il caregiver. | A4, A8 |

## 9.2 Caregiver (telefono, poi adattato a desktop)

| # | Schermata | Contenuto | UC |
|---|-----------|-----------|----|
| C1 | Accesso | Email → link; passkey | A1 |
| C2 | Procedura guidata nuovo paziente (4 passi) | Nome e foto · routine · avvisi con anteprima · primo farmaco | A2, A3 |
| C3 | **Oggi** (home) | Scheda per paziente: semaforo, ultima dose, prossima, stato tablet | E1, E10 |
| C4 | Giornata del paziente | Lista dosi con dettagli, azioni di conferma/correzione | E1, E4 |
| C5 | Dettaglio dose | Storia degli eventi, chi/quando/da dove, correggi | E4 |
| C6 | **Terapia** | Elenco farmaci attivi, sospesi; variazioni in corso con scadenza | B1–B9 |
| C7 | Nuovo/modifica farmaco | Nome, forma, foto, istruzioni, critico, se dimenticato, scorta | B1, B15 |
| C8 | Nuova/modifica regola | Quantità, quando (fisso/routine/risveglio/al bisogno), giorni, durata | B2–B5, B10, B11 |
| C9 | Cambia per qualche giorno | Tipo, periodo, motivo, anteprima | B6 |
| C10 | Anteprima giornata / prima-dopo | Come la vedrà il paziente | B12 |
| C11 | Routine e "oggi si mangia alle…" | Momenti della giornata | A3, B8 |
| C12 | **Storico** | Calendario aderenza, indicatori, filtri | E5 |
| C13 | Report per il medico (F1) | Periodo, anteprima, scarica PDF | E6 |
| C14 | Allerta aperta | Dettaglio, "L'ha presa", "Me ne occupo io", chiama | E2, E3 |
| C15 | Dispositivi | Elenco, stato, collega nuovo (QR), scollega | A4, A5, A8, E7 |
| C16 | Persone e allerte | Membri, ruoli, inviti, catena, ore di silenzio, canali (push, Telegram, email) | A6, A7 |
| C17 | Impostazioni paziente | Testo, voce, volume, soglie, tocco (antirimbalzo, tieni premuto), notifiche discrete | A2, § 5 |
| C18 | Privacy e dati | Consenso, esportazione, cancellazione | A9, A10 |

## 9.3 Sito pinnuli.it

| # | Pagina | Contenuto |
|---|--------|-----------|
| W1 | Home | Cos'è, per chi, come funziona in 3 passi, immagine del tablet a muro, inizia |
| W2 | Come funziona | Tablet, telefono, familiari; video breve |
| W3 | Accessibilità | Perché è pensata per chi ha tremore o vede poco |
| W4 | Guida al tablet | Scelta, montaggio, configurazione chiosco |
| W5 | Privacy, termini, contatti | |
