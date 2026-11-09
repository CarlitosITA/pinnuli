# 3. Casi d'uso

Ogni caso d'uso ha un codice (UC-xx) usato nel resto della documentazione e, in seguito, nei ticket di sviluppo. La colonna **Fase** dice in quale rilascio entra: **MVP** (la mamma di Giovanni), **F1** (beta SaaS aperta ad altre famiglie), **F2** (evoluzioni). Vedi [08 – Roadmap](08-roadmap-e-decisioni.md).

Sommario:

- [A. Account e configurazione](#a-account-e-configurazione)
- [B. Gestione della terapia (caregiver)](#b-gestione-della-terapia-caregiver)
- [C. Paziente sul tablet a muro](#c-paziente-sul-tablet-a-muro)
- [D. Paziente sul telefono](#d-paziente-sul-telefono)
- [E. Caregiver: monitoraggio e allerte](#e-caregiver-monitoraggio-e-allerte)
- [F. Comportamenti del sistema](#f-comportamenti-del-sistema)
- [G. Amministrazione della piattaforma](#g-amministrazione-della-piattaforma)
- [H. Situazioni limite](#h-situazioni-limite)

---

## A. Account e configurazione

| Codice | Caso d'uso | Attore | Fase |
|--------|-----------|--------|------|
| UC-A1 | Registrarsi come caregiver | Caregiver | MVP |
| UC-A2 | Creare il profilo del paziente | Caregiver amm. | MVP |
| UC-A3 | Impostare la routine del paziente | Caregiver amm. | MVP |
| UC-A4 | Collegare il tablet a muro | Caregiver amm. | MVP |
| UC-A5 | Collegare il telefono del paziente | Caregiver amm. | F1 |
| UC-A6 | Invitare altri caregiver e assegnare ruoli | Caregiver amm. | F1 |
| UC-A7 | Scegliere chi riceve le allerte e quando | Caregiver | MVP (base), F1 (catena) |
| UC-A8 | Scollegare un dispositivo | Caregiver amm. | MVP |
| UC-A9 | Raccogliere il consenso del paziente | Caregiver amm. | F1 |
| UC-A10 | Esportare o cancellare tutti i dati | Caregiver amm. | F1 |

### UC-A1 · Registrarsi come caregiver
1. Il caregiver apre pinnuli.it e tocca "Inizia".
2. Inserisce nome ed email. Riceve un link di accesso (nessuna password da ricordare).
3. Al primo accesso gli viene proposto di creare una **passkey** (impronta o volto) per gli accessi successivi.
4. Viene creato automaticamente un cerchio di cura di cui è amministratore.

### UC-A2 · Creare il profilo del paziente
Procedura guidata in 4 passi, ognuno su una schermata:
1. **Come si chiama?** Nome con cui l'app la saluterà ("Anna", "Mamma"). Foto facoltativa.
2. **La sua giornata.** Orari abituali di sveglia, pranzo, cena, coricarsi (UC-A3).
3. **Come vuole essere avvisata.** Volume, voce sì/no, testo grande o grandissimo. Anteprima del promemoria con la voce vera.
4. **Primo farmaco.** Porta direttamente a UC-B1.

### UC-A3 · Impostare la routine
Elenco dei momenti della giornata con orario modificabile tramite selettore a rotella. Possibilità di orari diversi nel weekend. Ogni modifica mostra quante dosi si spostano ("Spostando il pranzo alle 13:30 si spostano 1 dose: Peridon").

### UC-A4 · Collegare il tablet a muro
1. Sul tablet si apre `pinnuli.it/collega`. Appare un **codice di 6 cifre** grandissimo e un QR.
2. Dal telefono il caregiver, nella scheda del paziente, tocca "Collega un tablet" e inquadra il QR (o digita il codice).
3. Sceglie il nome del dispositivo ("Tablet cucina") e la modalità: **tablet a muro**.
4. Il tablet riceve un token permanente e mostra la schermata del paziente. Da quel momento non chiederà mai più nulla.
5. Una guida passo passo spiega come attivare la modalità chiosco, lo schermo sempre acceso e il volume (vedi [06 – Architettura](06-architettura-e-stack.md#69-il-tablet-a-muro)).

Il codice scade dopo 10 minuti. Il token del tablet vale solo per quel paziente e consente solo le azioni del paziente.

### UC-A5 · Collegare il telefono del paziente
Come UC-A4, ma in modalità **telefono del paziente**: stessa interfaccia semplificata, adattata allo schermo piccolo, con notifiche push. Una dose confermata dal telefono risulta confermata anche sul tablet, e viceversa.

### UC-A6 · Invitare altri caregiver
L'amministratore inserisce un'email o condivide un link d'invito e sceglie il ruolo:

| Permesso | Amministratore | Caregiver | Osservatore |
|----------|:-:|:-:|:-:|
| Vedere stato e storico | ✓ | ✓ | ✓ |
| Ricevere allerte | ✓ | ✓ | facoltativo |
| Confermare una dose per conto del paziente | ✓ | ✓ | — |
| Variazioni temporanee e routine di oggi | ✓ | ✓ | — |
| Modificare la terapia di base | ✓ | facoltativo | — |
| Gestire dispositivi, membri, dati | ✓ | — | — |

### UC-A7 · Scegliere chi riceve le allerte e quando
Ogni caregiver sceglie i propri canali (notifica app, Telegram, email; SMS in F2) e le ore di silenzio. L'amministratore definisce l'ordine di escalation: "prima Giovanni; se non risponde entro 15 minuti, Maria". Dettagli in [04 – Promemoria ed escalation](04-promemoria-ed-escalation.md).

### UC-A8 · Scollegare un dispositivo
Dalla lista dispositivi del paziente: nome, ultimo contatto, batteria, versione. "Scollega" invalida subito il token; il dispositivo torna alla schermata di collegamento. Da usare se il tablet viene perso, rotto o sostituito.

### UC-A9 · Consenso del paziente
Prima di attivare il servizio, il paziente (o chi lo rappresenta legalmente) deve dare il consenso al trattamento dei dati sanitari. Pinnuli presenta un testo breve in linguaggio semplice, leggibile anche ad alta voce sul tablet, e registra chi ha dato il consenso, come e quando. Vedi [07](07-privacy-sicurezza-regolatorio.md).

### UC-A10 · Esportare o cancellare i dati
Esportazione completa (JSON + PDF leggibile) e cancellazione definitiva del paziente o dell'intero cerchio, con conferma via email.

---

## B. Gestione della terapia (caregiver)

| Codice | Caso d'uso | Fase |
|--------|-----------|------|
| UC-B1 | Aggiungere un farmaco | MVP |
| UC-B2 | Programmare un'assunzione a orario fisso | MVP |
| UC-B3 | Programmare un'assunzione legata alla routine (pasti, risveglio) | MVP |
| UC-B4 | Stesso farmaco, quantità diverse in orari diversi | MVP |
| UC-B5 | Terapia a durata limitata (es. antibiotico) | MVP |
| UC-B6 | Variazione temporanea (sospendi, cambia dose, cambia orario) | MVP |
| UC-B7 | Sospendere e riprendere un farmaco | MVP |
| UC-B8 | Spostare un pasto solo per oggi | MVP |
| UC-B9 | Aggiungere una dose una tantum | MVP |
| UC-B10 | Farmaco al bisogno | F1 |
| UC-B11 | Giorni specifici, alterni, cicli | F1 |
| UC-B12 | Anteprima della giornata e dell'effetto di una modifica | MVP |
| UC-B13 | Consultare lo storico delle versioni della terapia | F1 |
| UC-B14 | Mettere in pausa tutta la terapia (ricovero, viaggio) | F1 |
| UC-B15 | Gestire le scorte | F1 |
| UC-B16 | Inserire la terapia partendo da una foto del foglio del medico | F2 |

### UC-B1 · Aggiungere un farmaco
1. "Aggiungi farmaco". Campo nome con suggerimenti (in F2 dalla banca dati AIFA; nell'MVP dai farmaci già usati nel cerchio).
2. Forma (icone grandi: compressa, capsula, bustina, gocce…).
3. Foto della confezione e della compressa (fotocamera del telefono). Facoltative ma fortemente suggerite.
4. Istruzioni sempre valide, scelte da un elenco con pittogrammi (a digiuno, a stomaco pieno, con acqua, sciogliere in acqua, dopo aver urinato, non masticare, spezzare) più testo libero.
5. Orario critico sì/no; comportamento se dimenticato.
6. Prosegue con la prima regola di assunzione (UC-B2/B3).

### UC-B2 · Orario fisso
Quantità (con frazioni) + ora. Pulsante "Aggiungi un altro orario" per lo stesso farmaco con la stessa quantità (es. Sinemet 08:30, 12:30, 16:30). Per quantità diverse si crea una regola separata (UC-B4).

### UC-B3 · Legato alla routine
"Quando?" → "Legato a un momento della giornata" → momento (pranzo) → prima/dopo → minuti (5, 10, 15, 30, 45, 60, altro). L'app mostra subito l'orario risultante ("Oggi alle 12:45").

### UC-B4 · Stesso farmaco, quantità diverse
Nella scheda del farmaco le regole sono elencate in ordine di orario, ciascuna con la propria quantità (es. tre Sinemet da 1 compressa e uno da ½). Il promemoria della dose da ½ mostra il disegno di mezza compressa e la scritta "**MEZZA** compressa".

### UC-B5 · Terapia a durata limitata
Nella regola: "Fino a quando?" → *sempre* / *per N giorni* / *fino al giorno…*. Il caregiver vede sulla dashboard "Neo Furadantin: ancora 4 giorni". Il giorno prima della fine riceve un avviso; il giorno dopo la regola è conclusa e il farmaco passa a *sospeso* (non cancellato), pronto per un nuovo ciclo.

### UC-B6 · Variazione temporanea
1. Dalla dose o dal farmaco: "Cambia per qualche giorno".
2. Cosa: *non prenderla* / *quantità diversa* / *orario diverso*.
3. Periodo: *solo oggi* / *fino a…* (calendario).
4. Motivo facoltativo ("indicazione del neurologo").
5. Anteprima delle dosi coinvolte, poi conferma.
Il tablet mostra l'etichetta "cambiata fino a ven 13". Alla scadenza la terapia torna quella di base senza interventi. Tutti i caregiver ricevono una notifica informativa della variazione.

### UC-B7 · Sospendere e riprendere
"Sospendi" su un farmaco: nessuna dose da domani (o da subito), il farmaco resta in un elenco "Sospesi" con la data di sospensione. "Riprendi" lo riattiva con le regole che aveva. È il caso del gastroprotettore.

### UC-B8 · Spostare un pasto solo per oggi
Dalla dashboard: "Oggi il pranzo è alle…". Tutte le dosi legate al pranzo si spostano. Le dosi a orario fisso restano dove sono. Domani si torna all'orario abituale.

### UC-B9 · Dose una tantum
"Aggiungi una dose per oggi": farmaco, quantità, ora. Utile per indicazioni estemporanee del medico.

### UC-B10 · Farmaco al bisogno
Nessun promemoria. Sul tablet compare un tasto secondario "Ho preso un farmaco al bisogno" che mostra solo i farmaci al bisogno del paziente (al massimo 3–4, con foto). Se si supera il massimo giornaliero impostato, il tablet mostra un avviso e il caregiver riceve una notifica informativa. L'app non impedisce l'assunzione.

### UC-B11 · Giorni specifici, alterni, cicli
Vedi [02 – § 2.3](02-modello-terapia.md#23-regola-di-assunzione).

### UC-B12 · Anteprima della giornata
Vista "Giornata tipo" e "Domani" con tutte le dosi in ordine, raggruppate per momento, come le vedrà il paziente. Ogni modifica alla terapia mostra un riepilogo prima/dopo e chiede conferma. È anche la vista da mostrare al medico per verificare che la terapia sia stata inserita bene.

### UC-B13 · Storico versioni
Ogni modifica crea una nuova versione con autore, data e motivo. Si può vedere "che terapia era in vigore il 3 ottobre". Non si può tornare indietro nel passato, ma si può ripristinare una versione precedente come nuova versione.

### UC-B14 · Pausa totale
"Mamma è in ospedale / in vacanza con me": sospende tutte le dosi e tutte le allerte per un periodo. Il tablet mostra un messaggio sereno ("Pinnuli è in pausa fino a domenica") invece della lista.

### UC-B15 · Scorte
Il caregiver inserisce quante unità ci sono in casa (o "una scatola da 30"). Ogni dose presa scala la scorta. Quando restano meno di N giorni (default 7), allerta "Sinemet: restano 6 giorni. Serve la ricetta?". "Ho comprato una scatola" riporta su la scorta.

### UC-B16 · Terapia da foto (F2)
Il caregiver fotografa il foglio del medico; l'app propone una bozza di farmaci e orari che il caregiver **deve verificare riga per riga** prima che diventi attiva. Nessun dato estratto automaticamente diventa operativo senza conferma umana.

---

## C. Paziente sul tablet a muro

| Codice | Caso d'uso | Fase |
|--------|-----------|------|
| UC-C1 | Vedere la giornata a colpo d'occhio | MVP |
| UC-C2 | Ricevere il promemoria a tutto schermo | MVP |
| UC-C3 | Confermare "L'ho presa" | MVP |
| UC-C4 | Confermare un gruppo di dosi | MVP |
| UC-C5 | Annullare una conferma sbagliata | MVP |
| UC-C6 | Posticipare di qualche minuto | MVP |
| UC-C7 | Dire "Non la prendo" | MVP |
| UC-C8 | Rispondere su una dose rimasta senza risposta | MVP |
| UC-C9 | Chiedersi "l'ho già presa?" | MVP |
| UC-C10 | Prendere in anticipo la prossima dose | MVP |
| UC-C11 | Dare il "Buongiorno" (risveglio) | MVP |
| UC-C12 | Avvisare un familiare | F1 |
| UC-C13 | Registrare un farmaco al bisogno | F1 |
| UC-C14 | Modalità notte | MVP |
| UC-C15 | Diario "Come mi sento" (ON/OFF del Parkinson) | F2 |

### UC-C1 · La giornata a colpo d'occhio (schermata di riposo)
Sempre visibile quando non c'è un promemoria attivo. Contenuto, dall'alto:
1. **Ora** grandissima, giorno della settimana e data per esteso ("Lunedì 9 novembre"), con indicazione del momento (mattina / pomeriggio / sera) e saluto per nome.
2. **Da confermare** (solo se c'è una dose rimasta senza risposta): riquadro arancione in evidenza, toccabile, che apre UC-C8. Ha la precedenza sulla prossima dose.
3. **Prossima dose**: riquadro toccabile con nome, foto, quantità, ora e quanto manca ("tra 25 minuti"). Toccandolo si apre UC-C10.
4. **Oggi**: la lista dei momenti della giornata, con stato chiaro: ✓ verde "presa alle 08:34", ○ grigio "alle 16:30", ! arancione "da confermare". **La lista è solo da leggere**: le righe non reagiscono al tocco, così una mano che trema appoggiata sullo schermo non può cambiare nulla. Le uniche zone toccabili della schermata sono i riquadri dei punti 2 e 3.
5. In basso, piccoli e distanti dal resto: indicatore di connessione e, se previsto, il tasto "Avvisa Giovanni".

Nessun menu, nessuna impostazione, nessun link. L'accesso alle impostazioni del tablet è nascosto (pressione prolungata di 5 secondi in un angolo + PIN del caregiver).

### UC-C2 · Promemoria a tutto schermo
All'ora prevista:
1. Lo schermo si accende (se spento) alla massima luminosità.
2. Suona un **suono riconoscibile**, sempre lo stesso, con volume che sale progressivamente.
3. Una **voce** dice: "Anna, sono le otto e mezza. È l'ora del Sinemet: una compressa."
4. La schermata occupa tutto il display: foto del farmaco, nome grande, quantità con disegno, istruzioni con pittogramma, ora.
5. In basso un tasto enorme **"L'HO PRESA"** (almeno un terzo dello schermo) e, sopra, separato, un tasto più piccolo **"Tra 10 minuti"**. Il tasto "Non la prendo" è ancora più discreto, per non essere toccato per errore.
6. Il promemoria si ripete (suono e voce) secondo le regole di [04](04-promemoria-ed-escalation.md) finché non c'è una risposta.

### UC-C3 · "L'ho presa"
1. Il paziente tocca il tasto. Basta un tocco ovunque sulla superficie del tasto; i tocchi multipli ravvicinati (tremore) contano come uno solo.
2. Il tasto diventa verde con un grande ✓, un suono positivo breve e la voce "Fatto, brava." (formula configurabile).
3. Per 10 secondi resta visibile il tasto **"Annulla"**.
4. Poi la schermata torna alla giornata, dove la dose appare come "presa alle 08:34".

### UC-C4 · Gruppo di dosi
Se il momento ha più farmaci, la schermata mostra tutte le foto in riquadri e il tasto diventa **"LE HO PRESE TUTTE (2)"**. Un tasto secondario "Non tutte" apre la lista con un tasto grande per ciascun farmaco. Le dosi non confermate restano dovute.

### UC-C5 · Annullare
Entro 10 secondi: "Annulla" riporta la dose a *dovuta* e il promemoria riprende. Il tasto "Annulla" sta in basso a sinistra, lontano dal punto in cui c'era "L'HO PRESA", così un secondo tocco involontario non lo colpisce. Dopo i 10 secondi l'annullamento è possibile solo dal caregiver (UC-E4), per evitare che un tocco accidentale sulla lista cancelli una conferma.

### UC-C6 · "Tra 10 minuti"
Il promemoria si chiude e torna dopo 10 minuti (durata configurabile). Numero massimo di rinvii: 3 per i farmaci normali, 1 per quelli a orario critico (configurabile). Raggiunto il massimo, il tasto non compare più.

### UC-C7 · "Non la prendo"
Tasto discreto. Apre una schermata con tre motivi grandi: *Non ce l'ho*, *Non mi sento bene*, *Altro*, più "Torna indietro". La dose diventa *non presa* e il caregiver riceve subito una notifica.

### UC-C8 · Dose senza risposta
Se una dose è diventata *mancata*, compare in arancione nella lista e, in evidenza sopra la prossima dose, il riquadro "Da confermare". Toccando il riquadro: "Il Sinemet delle 12:30 non è stato confermato. L'hai presa?" con **"Sì, l'ho presa"** e **"No"**. Se "No", l'app mostra il comportamento scelto dal caregiver per quel farmaco (es. "Chiedi a Giovanni prima di prenderla" con il tasto per avvisarlo). L'app non dice mai di prendere due dosi insieme.

### UC-C9 · "L'ho già presa?"
La risposta è sempre sullo schermo senza toccare nulla: ogni dose presa mostra ✓ e l'ora ("presa alle 08:34"), scritte abbastanza grandi da leggerle dal tavolo. Questo caso è il motivo principale per cui la lista è sempre visibile. Se il paziente prova comunque a confermare di nuovo una dose (ad esempio da un promemoria riaperto su un altro dispositivo), compare: "**Sì, l'hai già presa** alle 08:34. Non serve prenderla di nuovo."

### UC-C10 · Prendere in anticipo
La prossima dose, se mancano al massimo 60 minuti (configurabile; per i farmaci critici default 30), si può confermare in anticipo toccando il riquadro "Prossima dose": "Vuoi segnare il Sinemet delle 16:30 come preso adesso?" → "Sì, l'ho presa". Oltre la finestra il riquadro mostra solo "Il Sinemet è alle 16:30, tra 2 ore" e la conferma anticipata non è disponibile, per evitare confusioni. Le dosi successive alla prossima non si possono confermare in anticipo.

### UC-C11 · "Buongiorno"
Al mattino, prima della prima dose, la schermata mostra "Buongiorno Anna!" con un tasto grande "Mi sono svegliata". Toccarlo: rende dovute le dosi "al risveglio", sblocca l'audio del browser per tutta la giornata e manda al caregiver un segnale discreto "Mamma è sveglia" (facoltativo, utile anche come segno di benessere). Se non viene toccato, le dosi al risveglio scattano all'orario abituale di sveglia.

### UC-C12 · "Avvisa Giovanni" (F1)
Tasto con foto e nome del caregiver principale. Toccandolo e confermando ("Vuoi avvisare Giovanni?" → "Sì, avvisalo"), parte una notifica urgente a tutti i caregiver: "Mamma ha chiesto aiuto dal tablet". Il tablet mostra "Giovanni è stato avvisato" e, quando un caregiver apre la notifica, "Giovanni ha visto il messaggio". Non è un servizio di emergenza e lo dice chiaramente.

### UC-C13 · Farmaco al bisogno (F1)
Vedi UC-B10.

### UC-C14 · Modalità notte
Dall'ora "coricarsi" alla sveglia: schermo al minimo, sfondo scuro, solo ora e prossima dose. I promemoria notturni (es. 22:30 se la paziente è già a letto) suonano comunque ma con volume iniziale più basso. Nessun suono per eventi non urgenti.

### UC-C15 · Diario "Come mi sento" (F2)
Nel Parkinson il neurologo chiede spesso quando la persona sta bene ("ON") e quando si blocca ("OFF") o ha movimenti involontari. Tre tasti grandi con faccine e parole semplici: *Mi muovo bene* · *Sono bloccata* · *Ho movimenti che non controllo*. Facoltativamente proposto 1 ora dopo ogni Sinemet. I dati vanno nel report per il neurologo senza alcuna interpretazione da parte dell'app.

---

## D. Paziente sul telefono

| Codice | Caso d'uso | Fase |
|--------|-----------|------|
| UC-D1 | Ricevere il promemoria come notifica e confermare | F1 |
| UC-D2 | Vedere la giornata sul telefono | F1 |
| UC-D3 | Usare il telefono fuori casa | F1 |

### UC-D1 · Promemoria su telefono
Notifica push con suono, titolo "È l'ora del Sinemet" e azione "L'ho presa". Toccando la notifica si apre l'app direttamente sulla schermata di promemoria, identica a quella del tablet ma impaginata in verticale. La conferma su un dispositivo chiude il promemoria su tutti gli altri entro pochi secondi.

### UC-D2 · Giornata sul telefono
Stessa schermata di riposo del tablet, a colonna singola, con dimensioni dei caratteri e dei tasti uguali o maggiori (sul telefono la distanza di lettura è minore ma il dito copre più schermo).

### UC-D3 · Fuori casa
Nessuna modalità speciale: se il tablet suona in una casa vuota non succede nulla di male, e la conferma arriva dal telefono. Se nessuno dei due dispositivi risponde, parte l'escalation normale.

> Limiti delle notifiche web: su iPhone le notifiche push arrivano solo se l'app è installata nella schermata Home, e non possono superare la modalità silenziosa. Per un uso affidabile come sveglia sul telefono del paziente è prevista in F2 un'app nativa leggera. Vedi [06 § 6.8](06-architettura-e-stack.md#68-notifiche-e-canali).

---

## E. Caregiver: monitoraggio e allerte

| Codice | Caso d'uso | Fase |
|--------|-----------|------|
| UC-E1 | Vedere lo stato di oggi in tempo reale | MVP |
| UC-E2 | Ricevere un'allerta per una dose in ritardo o mancata | MVP |
| UC-E3 | Prendere in carico un'allerta ("Me ne occupo io") | MVP |
| UC-E4 | Confermare o correggere una dose per conto del paziente | MVP |
| UC-E5 | Vedere lo storico e l'aderenza | MVP (base), F1 (completo) |
| UC-E6 | Scaricare il report per il medico | F1 |
| UC-E7 | Ricevere un'allerta "tablet non raggiungibile" o "batteria scarica" | MVP |
| UC-E8 | Ricevere l'allerta scorte | F1 |
| UC-E9 | Ricevere "Mamma ha chiesto aiuto" | F1 |
| UC-E10 | Seguire più pazienti | F1 |
| UC-E11 | Ricevere un riepilogo giornaliero | F1 |

### UC-E1 · Stato in tempo reale
Prima schermata dell'app caregiver: per ogni paziente una scheda con
- semaforo del giorno (verde: tutto in regola; arancione: una dose in ritardo; rosso: una dose mancata o non presa; grigio: tablet non raggiungibile);
- ultima dose confermata ("Sinemet · presa alle 12:34 · 4 min di ritardo");
- prossima dose;
- stato del tablet (online, batteria).
Toccando la scheda si apre la giornata completa, identica a quella del paziente ma con dettagli (chi ha confermato, da quale dispositivo, ritardi).

### UC-E2 · Allerta dose in ritardo o mancata
Esempio di messaggio: "⚠️ Mamma non ha ancora confermato il **Sinemet delle 12:30** (in ritardo di 20 minuti)." Azioni: **L'ha presa** · **Me ne occupo io** · **Apri**. Quando arriva e come sale di livello: [04](04-promemoria-ed-escalation.md).

### UC-E3 · "Me ne occupo io"
Ferma l'escalation verso gli altri caregiver per quella dose e informa gli altri: "Giovanni se ne sta occupando".

### UC-E4 · Confermare o correggere per conto del paziente
Il caregiver può impostare *presa* (con l'ora reale, es. "l'ha presa alle 12:40, me l'ha detto al telefono"), *non presa* (con motivo) o annullare una conferma sbagliata. Ogni correzione è registrata con autore e ora e resta visibile nello storico ("corretta da Giovanni alle 13:05"). Il tablet si aggiorna subito.

### UC-E5 · Storico e aderenza
Calendario mensile con un pallino colorato per giorno; per ogni giorno l'elenco delle dosi. Indicatori: percentuale di dosi prese, percentuale di dosi critiche prese entro 15 minuti, ritardo medio, rinvii. Filtrabile per farmaco.

### UC-E6 · Report per il medico
PDF di 1–2 pagine per un periodo scelto: terapia in vigore (con le variazioni avvenute), aderenza per farmaco, ritardi delle dosi critiche, dosi non prese con motivo, diario ON/OFF se attivo. Pensato per essere stampato o mostrato dal telefono durante la visita. Nessuna interpretazione clinica.

### UC-E7 · Tablet non raggiungibile o batteria scarica
Il tablet invia un segnale di vita ogni minuto. Se il server non lo riceve per 15 minuti (configurabile), avvisa: "Il tablet di Mamma non è raggiungibile da 15 minuti (ultima batteria: 64%). Controlla che sia acceso e collegato al Wi-Fi." Analoghi avvisi per batteria sotto il 20% o alimentazione scollegata. Il tablet nel frattempo continua a funzionare in locale (vedi F3).

### UC-E8 · Scorte
Vedi UC-B15.

### UC-E9 · Richiesta di aiuto
Vedi UC-C12. Notifica con priorità massima a tutti i caregiver che hanno le allerte attive, ignorando le ore di silenzio.

### UC-E10 · Più pazienti
La schermata principale mostra una scheda per paziente. Le allerte indicano sempre il nome del paziente.

### UC-E11 · Riepilogo giornaliero
Facoltativo, all'ora scelta (es. 22:45): "Oggi Mamma ha preso 14 dosi su 14. Sinemet sempre in orario." Utile perché il caregiver non debba aprire l'app per stare tranquillo.

---

## F. Comportamenti del sistema

| Codice | Comportamento | Fase |
|--------|--------------|------|
| UC-F1 | Generare le dosi dei prossimi giorni | MVP |
| UC-F2 | Gestire promemoria, ripetizioni ed escalation | MVP |
| UC-F3 | Funzionare offline e sincronizzare | MVP |
| UC-F4 | Controllare lo stato dei dispositivi | MVP |
| UC-F5 | Gestire il cambio dell'ora legale | MVP |
| UC-F6 | Registrare ogni modifica (audit) | MVP |
| UC-F7 | Chiudere le dosi senza risposta | MVP |

- **UC-F1.** Ogni notte e a ogni modifica della terapia il server genera le dosi dei prossimi 7 giorni applicando regole, routine e variazioni. Le dosi passate non si toccano. Le dosi future non ancora dovute vengono ricreate; quelle già confermate in anticipo restano tali.
- **UC-F2.** Vedi [04](04-promemoria-ed-escalation.md).
- **UC-F3.** Il tablet conserva in locale le dosi delle prossime 72 ore e fa scattare i promemoria da solo. Le conferme fatte offline vengono salvate con l'ora reale e inviate appena torna la rete. Dettagli in [04 § 4.6](04-promemoria-ed-escalation.md#46-offline-e-sincronizzazione).
- **UC-F4.** Segnale di vita dei dispositivi con batteria, alimentazione, versione, orologio. Il server corregge eventuali differenze d'orologio del tablet.
- **UC-F5.** Vedi [02 § 2.8](02-modello-terapia.md#28-fuso-orario-e-ora-legale).
- **UC-F6.** Ogni azione su terapia, dosi, membri e dispositivi produce una riga di audit immutabile (chi, cosa, quando, prima/dopo).
- **UC-F7.** Una dose senza risposta diventa *mancata* allo scadere della sua finestra; vedi [04 § 4.3](04-promemoria-ed-escalation.md#43-tempi-predefiniti).

---

## G. Amministrazione della piattaforma

| Codice | Caso d'uso | Fase |
|--------|-----------|------|
| UC-G1 | Vedere cerchi, utenti e dispositivi attivi (senza dati sanitari) | F1 |
| UC-G2 | Accesso di supporto a un cerchio, solo con autorizzazione dell'amministratore del cerchio e a tempo | F1 |
| UC-G3 | Monitorare il sistema (code, notifiche fallite, dispositivi offline) | MVP |
| UC-G4 | Gestire piani e pagamenti | F2 |
| UC-G5 | Comunicazioni agli utenti (manutenzioni) | F1 |

---

## H. Situazioni limite

Ogni riga è anche un caso di test.

| # | Situazione | Comportamento atteso |
|---|-----------|----------------------|
| H1 | Il paziente tocca "L'ho presa" 4 volte di fila per il tremore | Una sola conferma. I tocchi entro 800 ms dal primo vengono ignorati. |
| H2 | Il paziente tocca per sbaglio "L'ho presa" senza averla presa | "Annulla" grande per 10 secondi. Dopo, correzione dal caregiver. |
| H3 | Il paziente non ricorda se l'ha presa | La lista mostra "✓ presa alle 08:34". Un tentativo di conferma da un altro dispositivo risponde "Sì, l'hai già presa alle 08:34". Nessuna seconda conferma possibile. |
| H4 | Due dosi alla stessa ora | Un solo promemoria, tasto "Le ho prese tutte (2)". |
| H5 | Una dose ancora dovuta quando arriva la successiva dello stesso farmaco | La precedente diventa *mancata* 30 minuti prima della successiva (o prima, secondo la finestra). Mai due dosi dello stesso farmaco dovute insieme. Si mostra la regola "se dimenticato". |
| H6 | Il Wi-Fi cade alle 12:00 e torna alle 15:00 | Il tablet suona e registra normalmente. Il server sa che il tablet è offline e **non** manda allerte "dose mancata", ma "tablet offline: non sappiamo se ha preso il Sinemet delle 12:30". Al ritorno della rete le conferme arrivano con l'ora reale. |
| H7 | Il tablet si riavvia durante un promemoria | Al riavvio la pagina si riapre in modalità chiosco e mostra subito il promemoria ancora dovuto. |
| H8 | Mancanza di corrente | Il tablet va a batteria (avviso al caregiver per alimentazione scollegata). |
| H9 | Il caregiver conferma "presa" mentre il tablet offline ha registrato "non presa" | Entrambi gli eventi restano nello storico. Lo stato finale è quello dell'evento con l'ora reale più recente; il caregiver riceve una segnalazione di conflitto da verificare. |
| H10 | La terapia viene modificata mentre un promemoria è attivo | Il promemoria in corso resta valido fino a risposta. Le modifiche valgono dalle dosi successive. |
| H11 | Un'allerta arriva al caregiver nelle sue ore di silenzio | Passa al caregiver successivo. Se nessuno è disponibile, viene comunque inviata ai farmaci a orario critico. |
| H12 | Dose delle 22:30 confermata alle 00:10 | Appartiene alla giornata precedente (giornata 04:00–03:59). |
| H13 | Orologio del tablet sbagliato di 7 minuti | Il tablet usa l'orario corretto del server; segnala la differenza nel segnale di vita. |
| H14 | Il paziente entra in ospedale | Pausa totale (UC-B14): nessun promemoria, nessuna allerta. |
| H15 | Il tablet viene rubato o perso | Scollegamento da remoto (UC-A8). Sul tablet non ci sono altri dati oltre a quelli del paziente per i prossimi 3 giorni. |
| H16 | Il browser blocca l'audio automatico | La modalità chiosco è configurata per permetterlo; in più il tocco su "Buongiorno" sblocca l'audio. Se l'audio resta bloccato il tablet lo segnala al caregiver. |
| H17 | Lo stesso caregiver riceve 5 allerte in 10 minuti | Le allerte dello stesso paziente vengono accorpate in un unico messaggio aggiornato. |
| H18 | Il caregiver annulla per errore una conferma | Anche le correzioni del caregiver si possono annullare dallo storico, con traccia. |
| H19 | Variazione temporanea che si sovrappone a un'altra | Anteprima del risultato prima del salvataggio; vince la più recente. |
| H20 | Una dose cade nell'ora che non esiste al passaggio all'ora legale | Spostata alle 03:00. |
