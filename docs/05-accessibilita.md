# 5. Accessibilità

Pinnuli si rivolge a persone anziane, spesso con Parkinson o altre condizioni che riducono la precisione dei movimenti, la vista, l'udito e la memoria. L'accessibilità non è un controllo da fare alla fine: è il requisito che decide il disegno di ogni schermata del paziente.

Obiettivo minimo: **WCAG 2.2 livello AA su tutta l'app**, e **AAA dove applicabile nelle schermate del paziente**. Le regole qui sotto vanno oltre le WCAG perché le WCAG sono scritte per l'utente medio, non per una persona con tremore che legge da un metro e mezzo di distanza.

## 5.1 Chi stiamo progettando

| Condizione | Effetto sull'uso | Conseguenza di progetto |
|------------|------------------|-------------------------|
| **Tremore** (a riposo e d'azione) | Tocchi imprecisi, tocchi multipli involontari, dito che scivola | Bersagli enormi e distanti, tocchi ripetuti ignorati, nessun gesto |
| **Bradicinesia, rigidità** | Movimenti lenti, difficoltà ad alzare il braccio | Tasti principali nella metà bassa dello schermo; nessun limite di tempo per rispondere |
| **Fluttuazioni motorie (fasi OFF)** | Il momento del promemoria della levodopa è spesso il momento di massima difficoltà | Ogni schermata del paziente si testa in condizioni "OFF" (vedi § 5.9) |
| **Micrografia, difficoltà a scrivere** | Non può digitare | Il paziente non scrive mai nulla |
| **Ipofonia, disartria** | Voce debole e poco chiara | Nessun comando vocale obbligatorio |
| **Calo della vista** (presbiopia, cataratta) | Testi piccoli illeggibili, colori poco distinti | Testi molto grandi, contrasto altissimo, mai colore da solo |
| **Calo dell'udito** (presbiacusia) | Non sente suoni acuti | Suoni su frequenze medio-basse, volume crescente, segnale visivo sempre presente |
| **Memoria, attenzione** | Dimentica se ha preso la dose, si confonde con troppe opzioni | Stato sempre visibile, una scelta per schermata, layout che non cambia mai |
| **Poca familiarità con la tecnologia** | Paura di "rompere qualcosa", non conosce le convenzioni | Nessun menu, nessuna icona senza testo, ogni errore annullabile |

## 5.2 Bersagli di tocco

| Elemento | Dimensione minima (tablet 10–11") | Dimensione minima (telefono) |
|----------|:---:|:---:|
| Tasto principale "L'HO PRESA" | intera larghezza utile × almeno 1/3 dell'altezza (≈ 200 px di altezza CSS) | intera larghezza × almeno 160 px |
| Tasti secondari ("Tra 10 minuti", "Non tutte") | 120 px di altezza, larghezza ≥ 50% | 96 px di altezza |
| Righe della lista "Oggi" (solo lettura, non toccabili) | 76 px di altezza | 72 px |
| Riquadri "Prossima dose" e "Da confermare" | 160 px di altezza, intera larghezza | 128 px |
| Distanza tra due bersagli | ≥ 32 px | ≥ 24 px |
| Distanza dai bordi dello schermo | ≥ 24 px (le cornici e la custodia "mangiano" i tocchi) | ≥ 16 px |

Il riferimento WCAG (2.5.8) chiede 24 px e lo standard AAA (2.5.5) 44 px: qui si va da 4 a 8 volte oltre.

## 5.3 Comportamento del tocco

| Regola | Perché |
|--------|--------|
| **L'azione scatta al rilascio del dito**, non alla pressione, e scatta se il dito si rilascia ovunque all'interno del tasto anche dopo essersi spostato. | Con il tremore il dito si muove mentre è appoggiato. |
| **Tocchi ripetuti entro 800 ms sullo stesso tasto sono ignorati.** | Il tremore produce tocchi multipli involontari. Valore configurabile da 300 a 2000 ms. |
| **Tocchi con più dita contemporaneamente: si considera solo il primo.** | Il palmo o altre dita appoggiate non devono attivare nulla. |
| **Nessun gesto**: niente scorrimento laterale, doppio tocco, pressione lunga, pizzico, trascinamento. | Gesti complessi sono quasi impossibili con il tremore. L'unica pressione lunga è quella nascosta per accedere alle impostazioni del caregiver, voluta proprio perché il paziente non la attivi. |
| **Nelle schermate di riposo le zone toccabili sono poche e grandi.** La lista "Oggi" è solo da leggere; si toccano solo i riquadri "Da confermare" e "Prossima dose". | Una mano appoggiata o che trema sopra la lista non deve poter cambiare nulla. |
| **Nessuno scorrimento nella schermata del promemoria.** Tutto deve stare in un solo schermo. | Scorrere è difficile e nasconde informazioni. |
| **La lista "Oggi" può scorrere solo se non sta nello schermo**, con indicatore visibile e scorrimento automatico per mantenere in vista la prossima dose. | |
| **Nessuna conferma "Sei sicuro?"** per le azioni frequenti. Si usa l'annullamento entro 10 secondi. | Ogni passaggio in più raddoppia gli errori e la frustrazione. |
| **Conferma esplicita solo per azioni rare e importanti**: "Non la prendo", "Avvisa Giovanni". | Questi non devono partire per un tocco accidentale. |
| **Nessun limite di tempo per rispondere.** | Il paziente può essere lento; il promemoria aspetta. |
| **Opzione "tieni premuto per confermare"** (1 secondo, con anello di avanzamento) in alternativa al tocco singolo, attivabile dal caregiver. | Per alcune persone con tremore molto forte è più affidabile. Va provata con il paziente, non imposta. |

Consigliato anche attivare sul tablet le impostazioni di accessibilità del sistema operativo (su iPad "Adattamenti tocco": durata della pressione e ignora ripetizioni; su Android "Ritardo tocco e pressione"). La guida di configurazione del tablet lo indica.

## 5.4 Testo e lettura

| Elemento | Tablet a muro (letto da ~1 m) | Telefono |
|----------|:---:|:---:|
| Ora nella schermata di riposo | ≥ 120 px | ≥ 64 px |
| Nome del farmaco nel promemoria | ≥ 56 px, grassetto | ≥ 36 px |
| Testo del tasto principale | ≥ 48 px, maiuscolo, grassetto | ≥ 32 px |
| Testo corrente minimo | 28 px | 22 px |
| Testo minimo assoluto (etichette secondarie) | 22 px | 18 px |

- Carattere **Atkinson Hyperlegible** (progettato per ipovedenti, forme distinte per I/l/1 e O/0) in tutta l'app; il sito può usare un carattere con grazie per i titoli (Young Serif), mai nelle schermate del paziente.
- Interlinea ≥ 1,4. Nessun testo in corsivo, nessun testo su immagini.
- Parole intere, niente abbreviazioni ("compressa", non "cpr"; "minuti", non "min").
- Tre livelli di dimensione impostabili dal caregiver: grande (default), molto grande, enorme. Il layout del promemoria resta in un solo schermo a tutti e tre i livelli.

## 5.5 Colore e contrasto

- Contrasto del testo **≥ 7:1** (AAA) nelle schermate del paziente; ≥ 4,5:1 nell'app caregiver.
- Componenti grafici e bordi dei tasti ≥ 3:1 rispetto allo sfondo.
- **Il colore non è mai l'unica informazione**: lo stato di una dose è sempre colore + icona + parola (✓ verde "Presa", ○ grigio "Alle 16:30", ! arancione "Da confermare").
- Palette verificata per daltonismo (deuteranopia e protanopia): verde e arancione/rosso devono restare distinguibili anche per luminosità.
- Tema chiaro di giorno, **tema scuro automatico di notte** (riduce l'abbagliamento di uno schermo acceso in camera o in cucina al buio).
- Nessun lampeggiamento sopra 3 volte al secondo (WCAG 2.3.1). Il promemoria attira l'attenzione con una **pulsazione lenta** dello sfondo, non con lampi.

## 5.6 Suono e voce

- **Suono del promemoria**: unico, riconoscibile, sempre uguale, con frequenze principali tra 500 e 2000 Hz (udibili anche con presbiacusia), volume crescente in 30 secondi. Il suono di conferma è diverso, breve e "positivo".
- **Voce**: italiano, velocità ridotta (circa 0,85×), frasi brevi. Il caregiver può ascoltare un'anteprima e scegliere tra le voci disponibili.
- Volume di base e volume massimo impostabili dal caregiver; volume notturno ridotto all'inizio.
- Ogni informazione detta a voce è anche scritta; ogni suono ha un corrispondente visivo.
- Facoltativo (F2): registrare la voce di un familiare ("Mamma, è ora del Sinemet") da usare al posto della voce sintetica.

## 5.7 Struttura e comprensione

- **Layout fisso.** La schermata di riposo e quella di promemoria hanno sempre la stessa disposizione: l'ora sempre in alto, il tasto principale sempre in basso. Il paziente impara dove toccare.
- **Una sola decisione per schermata**, al massimo due alternative visibili più una discreta.
- **Linguaggio semplice**: frasi brevi, seconda persona, presente. Niente gergo ("sincronizzazione", "errore 500", "notifica"). Se qualcosa non va: "Non riesco a collegarmi. Le medicine funzionano lo stesso." 
- **Orientamento**: giorno della settimana e momento della giornata sempre visibili (le persone anziane in casa perdono facilmente il riferimento del giorno).
- **Immagini reali** del farmaco quando disponibili; disegno coerente con forma e colore altrimenti.
- **Feedback immediato e multisensoriale** a ogni tocco: cambio visivo entro 100 ms, suono, e vibrazione sul telefono.
- **Niente pubblicità, niente notifiche promozionali, niente aggiornamenti che cambiano l'interfaccia senza preavviso** al caregiver.

## 5.8 App del caregiver

Interfaccia standard per smartphone, ma comunque accessibile: i caregiver spesso sono a loro volta over 60.
- WCAG 2.2 AA completo, compatibile con lettori di schermo (VoiceOver, TalkBack) e con l'ingrandimento del testo di sistema fino al 200%.
- Bersagli ≥ 48 px, testo base ≥ 17 px.
- Moduli brevi, un passo per schermata nelle procedure guidate, selettori invece di campi da digitare dove possibile.
- Navigazione con al massimo 4 voci nella barra in basso: **Oggi**, **Terapia**, **Storico**, **Altro**.

## 5.9 Come verificarlo

1. **Test automatici** (axe-core) in integrazione continua su tutte le schermate: nessuna violazione AA ammessa.
2. **Revisione manuale** di contrasto, ordine di lettura, lettori di schermo per l'app caregiver.
3. **Test "fase OFF" del team**: usare le schermate del paziente con la mano non dominante, con guanti spessi, con il tablet a muro a 1 metro, con occhiali sfocati (simulazione cataratta) e con un tremore simulato (tablet appoggiato su una superficie che vibra o polso in movimento). Ogni schermata deve superare il test.
4. **Prova sul campo con la prima paziente**, prima di andare in produzione e poi dopo 1 settimana di uso reale, osservando:
   - quante volte un tocco non va a buon fine o viene annullato;
   - quanto tempo passa tra il promemoria e la conferma;
   - se capisce senza aiuto cosa ha già preso;
   - se il suono è udibile dalle stanze in cui passa la giornata.
   I risultati aggiornano i valori predefiniti di questo documento.
