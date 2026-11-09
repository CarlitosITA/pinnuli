# Pinnuli · Specifica funzionale

Versione 0.1 · 9 novembre 2026 · stato: **bozza da rivedere**

Pinnuli (*pìnnuli*, "compresse" in salentino) è una web app per ricordare e registrare l'assunzione dei farmaci, pensata per persone anziane con difficoltà motorie, visive o di memoria, e per i familiari che le seguono a distanza. Si usa su un **tablet appeso al muro** e sul **telefono**.

## In breve

- **Per il paziente**: un tablet sempre acceso che mostra cosa prendere adesso e cosa è già stato preso oggi. All'ora giusta si accende a tutto schermo, suona e parla. Si conferma con un unico tasto enorme, a prova di tremore. Funziona anche senza internet.
- **Per il familiare**: dal telefono vede in tempo reale come va la giornata e riceve un avviso solo se una dose non viene confermata, se il tablet si spegne o se il paziente chiede aiuto. Gestisce la terapia, anche i cambi di pochi giorni, che tornano indietro da soli.
- **Per il SaaS**: più famiglie, più pazienti, più familiari con ruoli diversi, installato sulla VPS esistente senza toccare gli altri progetti.

## Indice

| # | Documento | Contenuto |
|---|-----------|-----------|
| 1 | [Visione e attori](01-visione-e-attori.md) | Problema, principi di prodotto, attori, cosa Pinnuli non fa |
| 2 | [Modello della terapia](02-modello-terapia.md) | Farmaci, regole, routine, variazioni temporanee, stati di una dose, la terapia reale della prima paziente |
| 3 | [Casi d'uso](03-casi-d-uso.md) | 67 casi d'uso per paziente, caregiver, sistema e piattaforma, più 20 situazioni limite |
| 4 | [Promemoria ed escalation](04-promemoria-ed-escalation.md) | Tempi, insistenza, catena dei familiari, canali, offline |
| 5 | [Accessibilità](05-accessibilita.md) | Regole per tremore, vista, udito e memoria; come verificarle |
| 6 | [Architettura e stack](06-architettura-e-stack.md) | Tecnologie, componenti, modello dati, API, installazione isolata sulla VPS, tablet a muro |
| 7 | [Privacy, sicurezza e regolatorio](07-privacy-sicurezza-regolatorio.md) | GDPR e dati sanitari, sicurezza, perimetro rispetto ai dispositivi medici, rischio clinico |
| 8 | [Roadmap e decisioni](08-roadmap-e-decisioni.md) | MVP, F1, F2; decisioni prese; domande aperte |
| 9 | [Inventario delle schermate](09-inventario-schermate.md) | Tutte le schermate e i loro stati, per mockup e sviluppo |

## Glossario

| Termine | Significato |
|---------|-------------|
| **Paziente** | La persona che prende i farmaci. |
| **Caregiver** | Familiare o assistente che segue il paziente. |
| **Cerchio di cura** | Gruppo di pazienti e caregiver; l'unità del SaaS. |
| **Regola** | Quando e quanto prendere un farmaco. |
| **Routine** | Orari abituali della giornata (risveglio, pasti, coricarsi) a cui le regole si possono agganciare. |
| **Variazione temporanea** | Modifica di una regola per un periodo, con ritorno automatico. |
| **Dose** | Una singola assunzione prevista in un giorno e un'ora precisi. |
| **Momento** | Gruppo di dosi alla stessa ora, ricordate insieme. |
| **Orario critico** | Farmaco il cui ritardo ha conseguenze (es. levodopa nel Parkinson): promemoria più insistenti ed escalation più rapida. |
| **Escalation** | Avviso ai caregiver, in ordine, quando una dose non viene confermata. |
| **MVP / F1 / F2** | Le tre fasi di rilascio (vedi documento 8). |
