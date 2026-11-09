# 1. Visione, obiettivi e attori

## 1.1 Il problema

Una persona anziana in politerapia prende molte compresse al giorno, a orari precisi, spesso con condizioni ("a digiuno", "15 minuti prima di pranzo", "dopo aver urinato"). Le domande che si fa più spesso sono due:

1. **"Che cosa devo prendere adesso?"**
2. **"L'ho già presa?"**

La seconda è la più pericolosa: chi non ricorda se ha preso una dose rischia di saltarla o, peggio, di prenderla due volte. Il familiare che la segue, a distanza, non ha modo di sapere se la terapia procede bene finché non telefona.

Nel Parkinson il problema è più acuto: la levodopa (Sinemet) va presa **in orario**, perché un ritardo anche di 30 minuti può riportare rigidità, blocchi e tremore. E il momento in cui arriva il promemoria del Sinemet è proprio quello in cui la persona sta peggio fisicamente, perché l'effetto della dose precedente sta finendo.

## 1.2 La soluzione in una frase

Un tablet appeso al muro che mostra sempre, in grande, **cosa prendere adesso e cosa è già stato preso oggi**; che all'ora giusta suona, parla e si accende a tutto schermo; che si conferma con un unico tasto enorme; e che avvisa il familiare sul telefono se qualcosa non va.

## 1.3 Principi di prodotto

| # | Principio | Cosa significa in pratica |
|---|-----------|---------------------------|
| P1 | **Progettato per il momento peggiore** | Ogni schermata del paziente deve funzionare quando il tremore è al massimo, la vista è stanca e la memoria vacilla. Se funziona lì, funziona sempre. |
| P2 | **Una sola cosa per schermata** | Il paziente non naviga, non cerca, non scrive. Vede una cosa e fa al massimo una scelta tra due. |
| P3 | **Nessun dubbio su "l'ho già presa?"** | Lo stato di ogni dose di oggi è sempre visibile, con l'ora esatta della conferma. Una dose già confermata non si può confermare due volte. |
| P4 | **Gli errori si annullano** | Ogni tocco sbagliato si può annullare subito, con un tasto grande. Niente conferme a cascata ("sei sicuro?"), che con il tremore raddoppiano gli errori. |
| P5 | **Il familiare sa, senza dover chiedere** | Il caregiver vede lo stato in tempo reale e riceve un avviso solo quando serve, non a ogni dose. |
| P6 | **Funziona anche senza internet** | Il tablet suona e registra anche se il Wi-Fi cade; sincronizza quando torna. |
| P7 | **La terapia cambia spesso, e va bene** | Cambi temporanei (un antibiotico per 7 giorni, mezza dose per 3 giorni) si impostano in pochi tocchi e tornano indietro da soli. |
| P8 | **Pinnuli ricorda, non prescrive** | L'app non calcola dosi, non dà consigli clinici e non interpreta sintomi. Esegue la terapia che il medico ha deciso e che il familiare ha inserito. |

## 1.4 Attori

| Attore | Chi è | Dispositivo | Come accede |
|--------|-------|-------------|-------------|
| **Paziente** | La persona che prende i farmaci (es. la mamma di Giovanni, prima paziente). | Tablet a muro; eventualmente il suo telefono. | Nessuna password. Il dispositivo viene "collegato" una volta dal caregiver e resta collegato. |
| **Caregiver amministratore** | Il familiare che gestisce tutto (es. Giovanni). Crea il paziente, inserisce la terapia, invita gli altri. | Telefono e computer. | Account con email + passkey o link magico. |
| **Caregiver** | Altri familiari o una badante che possono modificare la terapia del giorno, confermare dosi per conto del paziente e ricevere allerte. | Telefono. | Account proprio, su invito. |
| **Osservatore** | Chi vuole solo vedere (un fratello lontano, il medico di famiglia in futuro). | Telefono o computer. | Account proprio, su invito, solo lettura. |
| **Sistema Pinnuli** | Il server che genera le dosi, gestisce le escalation, controlla che il tablet sia acceso. | Server. | — |
| **Amministratore piattaforma** | Chi gestisce il SaaS (Giovanni). | Computer. | Pannello di amministrazione separato. |

Attori previsti in futuro, non nel primo rilascio: **medico o farmacista** (riceve un report o un link in sola lettura), **operatore di struttura** (RSA, casa di riposo, assistenza domiciliare con molti pazienti).

## 1.5 Il "cerchio di cura"

L'unità del SaaS è il **cerchio di cura**: un gruppo con uno o più pazienti e una o più persone che se ne occupano. Una famiglia tipica ha un cerchio con un paziente e due o tre caregiver. Lo stesso caregiver può appartenere a più cerchi (es. segue sia la mamma che il suocero). In futuro una struttura sanitaria è un cerchio con molti pazienti e molti operatori: il modello dati è già pensato per questo.

## 1.6 Cosa Pinnuli NON fa (fuori ambito)

- Non suggerisce dosi, non ricalcola orari in base a sintomi, non segnala interazioni tra farmaci.
- Non sostituisce il medico, il farmacista o il bugiardino.
- Non è un dispositivo di emergenza: il tasto "Avvisa" manda un messaggio al familiare, non chiama il 112.
- Non gestisce (per ora) ricette elettroniche, prenotazioni di visite, fascicolo sanitario.

Questi limiti sono anche una scelta regolatoria: vedi [07 – Privacy, sicurezza e aspetti regolatori](07-privacy-sicurezza-regolatorio.md).
