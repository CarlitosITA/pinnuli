# 7. Privacy, sicurezza e aspetti regolatori

> Questa sezione indica i requisiti di progetto. Non è una consulenza legale: prima dell'apertura del servizio ad altre famiglie (fase F1) va rivista da un professionista privacy e regolatorio.

## 7.1 Dati trattati

Pinnuli tratta **dati relativi alla salute** (farmaci, orari, aderenza, sintomi del diario), che per il GDPR sono una categoria particolare (art. 9). Questo impone una base giuridica esplicita, misure di sicurezza adeguate e, per un servizio aperto al pubblico, una valutazione d'impatto (DPIA).

| Dato | Necessario? | Note |
|------|:-:|------|
| Nome del paziente | sì | Può essere un soprannome ("Mamma"). Cognome non richiesto. |
| Data di nascita, codice fiscale, indirizzo | **no** | Non vengono chiesti. |
| Farmaci, orari, conferme | sì | Il cuore del servizio. |
| Foto delle confezioni | facoltativo | Non devono contenere etichette con nome del paziente (la guida lo ricorda). |
| Diario dei sintomi | facoltativo (F2) | Attivato esplicitamente. |
| Email e nome dei caregiver | sì | |
| Dati tecnici dei dispositivi | sì | Batteria, versione, ultimo contatto. Nessuna posizione. |

Principio di **minimizzazione**: si raccoglie solo ciò che serve al funzionamento. Niente analisi comportamentali, niente pubblicità, nessuna cessione a terzi.

## 7.2 Ruoli e basi giuridiche

- **Uso familiare (MVP)**: Giovanni gestisce la terapia della madre per scopi personali e familiari; il trattamento ricade in gran parte nell'esenzione per attività domestiche, ma va comunque raccolto il consenso della paziente.
- **SaaS (F1)**: Pinnuli (Giovanni come titolare o la società che gestirà il servizio) tratta i dati sanitari dei pazienti di altre famiglie. Base giuridica: **consenso esplicito** del paziente (art. 9.2.a) o di chi lo rappresenta legalmente. Il caregiver amministratore dichiara di avere titolo e il consenso viene registrato (UC-A9).
- **Strutture sanitarie (F2)**: la struttura è titolare, Pinnuli è responsabile del trattamento con contratto (DPA, art. 28).
- **Fornitori**: il provider della VPS e del backup, il provider email, Telegram (solo per i caregiver che lo attivano) sono responsabili o terze parti da elencare nell'informativa. Server e backup in **UE**.

Documenti da preparare per F1: informativa privacy in linguaggio semplice, termini di servizio, registro dei trattamenti, DPIA, procedura per violazione dei dati (notifica entro 72 ore), DPA per le strutture.

## 7.3 Diritti degli interessati

- Accesso ed esportazione completa (UC-A10), in formato leggibile e in formato strutturato.
- Rettifica (il caregiver modifica; il paziente può chiedere).
- Cancellazione definitiva: dati operativi subito, backup entro il ciclo di conservazione (30 giorni).
- Revoca del consenso: sospende il servizio per quel paziente.
- Conservazione: dati del paziente finché il servizio è attivo; dopo 12 mesi di inattività avviso e poi cancellazione.

## 7.4 Sicurezza

| Area | Misura |
|------|--------|
| Trasporto | Solo HTTPS (TLS 1.2+), HSTS. |
| Autenticazione caregiver | Link via email con scadenza breve + passkey; sessioni in cookie HttpOnly, Secure, SameSite; scadenza per inattività; elenco e revoca delle sessioni attive. |
| Dispositivi del paziente | Token casuale lungo, salvato sul server solo come hash, legato a un paziente, con permessi limitati alle azioni del paziente; revoca immediata. |
| Isolamento tra famiglie | Ogni query filtrata per cerchio a livello applicativo; Row Level Security in PostgreSQL come seconda barriera (F1); test automatici che verificano che un utente non veda dati di un altro cerchio. |
| Autorizzazioni | Controllo del ruolo su ogni azione lato server, mai solo nell'interfaccia. |
| Dati a riposo | Volume del database su disco cifrato se la VPS lo consente; backup sempre cifrati; foto servite solo tramite URL firmati a scadenza. |
| Segreti | In file `.env` fuori dal repository, con permessi ristretti; mai nei log né nella documentazione. |
| Log | Nessun dato sanitario nei log applicativi (solo identificativi). Audit separato e immutabile per le azioni sui dati. |
| Notifiche | Opzione "notifiche discrete" senza nome del farmaco. Il contenuto delle notifiche push è cifrato dallo standard Web Push. |
| Dipendenze | Aggiornamenti automatici con revisione (Dependabot/Renovate), scansione delle vulnerabilità in CI. |
| Limitazione delle richieste | Limiti su accesso, codici di collegamento (6 cifre, 10 minuti, massimo 5 tentativi), API. |
| Accesso di supporto | Solo con autorizzazione dell'amministratore del cerchio, a tempo, registrato nell'audit (UC-G2). |

## 7.5 Dispositivo medico o no?

Il Regolamento europeo sui dispositivi medici (MDR 2017/745) può classificare come dispositivo medico un software con finalità mediche, ad esempio se calcola dosi, suggerisce terapie o interpreta dati clinici per decisioni sul singolo paziente. Un'app che si limita a **ricordare e registrare** una terapia decisa dal medico e inserita dall'utente è generalmente considerata fuori da questa definizione, ma la valutazione dipende dalla finalità dichiarata e dalle funzioni.

Per restare in modo chiaro tra i software di promemoria e registrazione, Pinnuli:
- **non calcola né modifica dosi** (le quantità le inserisce il caregiver);
- **non dà indicazioni cliniche**: il comportamento "se dimenticato" è scelto dal caregiver, l'app lo mostra soltanto;
- **non segnala interazioni** tra farmaci né controindicazioni;
- **non interpreta il diario** dei sintomi: lo riporta al medico così com'è;
- usa nella comunicazione la finalità "promemoria e diario delle assunzioni", mai "terapia", "cura" o "monitoraggio clinico".

Ogni nuova funzione che si avvicina a questi limiti (es. lettura automatica della prescrizione in F2, suggerimenti basati sul diario) richiede una valutazione regolatoria prima dello sviluppo. Da verificare con un esperto prima del lancio F1.

## 7.6 Sicurezza del paziente (rischio clinico)

Non è un requisito di legge ma di buon senso: un errore dell'app può far saltare o raddoppiare una dose.

| Rischio | Mitigazione |
|---------|-------------|
| Terapia inserita male (orario o quantità sbagliati) | Anteprima della giornata (UC-B12) da verificare con la prescrizione; riepilogo stampabile da mostrare al medico; ogni modifica notificata agli altri caregiver. |
| Doppia dose per dubbio "l'ho già presa?" | Stato sempre visibile con ora di conferma; impossibile confermare due volte (H3). |
| Dose persa per promemoria non scattato | Calcolo locale ogni 15 secondi; controllo audio; segnale di vita; escalation; allerta "tablet offline". |
| Conferma accidentale | Tocchi ripetuti ignorati, annullamento per 10 secondi, correzione del caregiver. |
| Confusione tra farmaci simili | Foto, nome completo, evidenza della parola che li distingue. |
| Terapia temporanea dimenticata attiva | Data di fine obbligatoria per le variazioni; avviso il giorno prima della fine. |
| Il caregiver si fida troppo dell'app | Messaggi chiari quando l'app non sa (tablet offline) invece di silenzio. |
