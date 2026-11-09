# 8. Roadmap, decisioni e domande aperte

## 8.1 Fasi

### MVP · "La prima paziente"
Obiettivo: la mamma di Giovanni usa Pinnuli tutti i giorni al posto dei promemoria attuali, e Giovanni sa in ogni momento come sta andando.

- Un cerchio, un paziente, uno o due caregiver (account creati a mano o con registrazione semplice).
- Farmaci con foto, istruzioni, orario critico, comportamento se dimenticato.
- Regole a orario fisso, legate alla routine (pasti, risveglio), a durata limitata.
- Variazioni temporanee (sospendi, cambia quantità, cambia orario), sospendi/riprendi farmaco, spostare un pasto per oggi, dose una tantum.
- Tablet a muro: schermata di riposo, promemoria a tutto schermo con suono e voce, conferma singola e di gruppo, annulla, rinvio, "non la prendo", dose senza risposta, "l'ho già presa?", conferma in anticipo, buongiorno, modalità notte.
- Offline sul tablet con sincronizzazione.
- App caregiver: stato in tempo reale, giornata, correzioni, storico semplice, anteprima giornata.
- Escalation ai caregiver via push web e Telegram; allerta tablet offline e batteria.
- Audit di tutte le modifiche. Backup cifrati.
- Installazione sulla VPS e configurazione del tablet.
- Test di accessibilità e prova sul campo con la paziente (§ 5.9).

Criterio di uscita: **due settimane di uso reale** con almeno il 95% delle dosi confermate, nessuna dose persa per un problema dell'app, e la paziente che usa il tablet senza aiuto.

### F1 · "Beta per altre famiglie"
- Registrazione pubblica, procedura guidata, consenso, informativa e termini.
- Più caregiver con ruoli, catena di escalation con ore di silenzio, "me ne occupo io".
- Telefono del paziente come secondo dispositivo.
- Farmaci al bisogno, giorni specifici/alterni/cicli, pausa totale.
- Scorte, report PDF per il medico, riepilogo giornaliero, storico versioni.
- Tasto "Avvisa" dal tablet.
- Voce uniforme con Piper; scelta del livello di testo.
- Più pazienti per caregiver.
- Landing pinnuli.it completa, guida di configurazione del tablet.
- Row Level Security, revisione privacy e regolatoria (DPIA).

### F2 · "Evoluzione"
- Diario ON/OFF per il Parkinson.
- Banca dati farmaci (open data AIFA) per i suggerimenti.
- App nativa leggera (Capacitor) per il telefono del paziente con notifiche tipo sveglia.
- SMS e chiamata vocale per le allerte critiche.
- Voce registrata di un familiare.
- Terapia da foto della prescrizione, con verifica umana obbligatoria.
- Strutture sanitarie (molti pazienti, operatori a turni).
- Piani a pagamento.
- Altre lingue (inglese, poi altre), sito pinnuli.com.

## 8.2 Decisioni prese in questa specifica

Giovanni ha chiesto di procedere in autonomia. Queste sono le scelte fatte, tutte modificabili:

| # | Decisione | Alternativa scartata | Perché |
|---|-----------|----------------------|--------|
| D1 | Web app installabile (PWA), non app nativa | App nativa da subito | Una sola base di codice; il tablet a muro funziona da browser chiosco; native in F2 se servono. |
| D2 | Tablet Android con browser chiosco come raccomandazione | iPad | Più controllo su schermo, audio e riavvio. |
| D3 | Conferma con un tocco + annullamento di 10 secondi; "tieni premuto" solo come opzione | Tieni premuto obbligatorio, o doppia conferma | Meno passaggi, meno errori; da validare con la paziente. |
| D4 | Le condizioni ("dopo aver urinato", "a digiuno") sono istruzioni con pittogramma, non passaggi da confermare | Checklist prima della conferma | Ogni tocco in più è un errore possibile. |
| D5 | Sinemet e farmaci simili hanno soglie di escalation più strette ("orario critico") | Stesse soglie per tutti | Nel Parkinson il ritardo della levodopa ha conseguenze motorie. |
| D6 | Variazioni temporanee separate dalla terapia di base, con ritorno automatico | Modifica diretta della terapia | Nessuno deve ricordarsi di rimettere le cose a posto. |
| D7 | La giornata del paziente va dalle 04:00 alle 03:59 | Mezzanotte | Le dosi serali tardive restano nel giorno giusto. |
| D8 | Telegram come canale di allerta nell'MVP | Solo push web, o SMS | Gratuito, affidabile, pulsanti di azione. |
| D9 | PostgreSQL + pg-boss, nessun Redis | Redis + BullMQ | Un servizio in meno sulla VPS condivisa. |
| D10 | Database PostgreSQL dedicato in container | Usare un PostgreSQL già presente sulla VPS | Non toccare nulla dei progetti esistenti. |
| D11 | `app.pinnuli.it` per l'app, `pinnuli.it` per la landing, `pinnuli.com` reindirizza | Tutto su un dominio | Isolamento di cookie e service worker. |
| D12 | Il paziente non ha credenziali: il dispositivo viene collegato dal caregiver | Login del paziente | Nessuna password da ricordare. |
| D13 | Pinnuli non dà indicazioni cliniche; "se dimenticato" lo sceglie il caregiver | Regole automatiche sulle dosi dimenticate | Sicurezza del paziente e perimetro regolatorio. |
| D14 | Pranzo alle 13:00 e cena alle 20:00 come routine iniziale della prima paziente | — | Ricavati dagli orari della terapia; da confermare. |
| D15 | Documentazione e interfaccia in italiano; codice e nomi tecnici in inglese | Tutto in italiano | Convenzione comune; facilita librerie e collaboratori futuri. |

## 8.3 Domande aperte

Non bloccano l'inizio dello sviluppo: per ognuna c'è un'ipotesi di lavoro.

| # | Domanda | Ipotesi di lavoro |
|---|---------|-------------------|
| Q1 | Che tablet verrà usato? È già stato comprato? | Android 10–11", da acquistare. |
| Q2 | La mamma ha uno smartphone? Android o iPhone? Lo usa da sola? | Sì, Android; telefono come secondo dispositivo in F1. |
| Q3 | Chi deve ricevere le allerte oltre a Giovanni, e in che ordine? | Solo Giovanni nell'MVP. |
| Q4 | A che ora pranza e cena di solito? Nel weekend cambia? | 13:00 e 20:00 tutti i giorni. |
| Q5 | Quantità esatte di ogni farmaco (Lactoflorene: flaconcino o bustina? Neo Furadantin: capsule da quanti mg?) e quale gastroprotettore e quale statina. | Da leggere sulla prescrizione; nell'esempio è "1". |
| Q6 | Il neurologo ha dato indicazioni su cosa fare se un Sinemet viene dimenticato? | "Chiedi al familiare" come default. |
| Q7 | Dove verrà montato il tablet? Si sente bene da lì nelle altre stanze? | In cucina; suono da verificare nella prova sul campo. |
| Q8 | Va bene usare Telegram per le allerte? | Sì. |
| Q9 | Dettagli della VPS (sistema, reverse proxy, Docker, risorse) | Da rilevare in sola lettura prima dell'installazione (§ 6.7). |
| Q10 | Il SaaS sarà a nome di Giovanni o di una società? | Rilevante solo per F1 (titolare del trattamento, termini di servizio). |
| Q11 | Formula di conferma della voce ("Fatto, brava") e nome con cui salutare la paziente | "Fatto." + nome proprio. |

## 8.4 Coordinamento con brand e mockup

Le schermate da disegnare sono elencate in [09 – Inventario delle schermate](09-inventario-schermate.md), con contenuti e stati. Vincoli che il brand e i mockup devono rispettare:
- dimensioni minime di testo e tasti e regole di contrasto della sezione [05](05-accessibilita.md);
- palette con verde (presa), arancione (da confermare), rosso (non presa/mancata), grigio (futura) distinguibili anche per daltonici e sempre accompagnati da icona e parola;
- tema chiaro e tema notte;
- carattere ad alta leggibilità;
- un'icona/disegno per ogni forma di farmaco (compressa intera, mezza, capsula, bustina, gocce, flaconcino, cerotto, inalatore, iniezione);
- pittogrammi per le istruzioni (a digiuno, a stomaco pieno, con acqua, sciogliere in acqua, dopo aver urinato, non masticare, spezzare);
- un suono di promemoria e uno di conferma coerenti con il brand.
