# 🚀 Praxis Launch Checklist

**Fondatore:** Gio
**Data Inizio:** 2 Aprile 2026
**Obiettivo:** €1.000 MRR in 30 giorni
**Stato:** Pre-lancio

---

## 📋 Indice

- [Fase 0: Pre-Lancio (Oggi)](#fase-0-pre-lancio-oggi)
- [Giorno 1: Setup Finale](#giorno-1-setup-finale)
- [Giorno 2: Launch Day](#giorno-2-launch-day)
- [Settimana 1: Primi Utenti](#settimana-1-primi-utenti)
- [Settimana 2: Retention](#settimana-2-retention)
- [Settimana 3: Content](#settimana-3-content)
- [Settimana 4: Monetizzazione](#settimana-4-monetizzazione)
- [Giorno 30: Decision Point](#giorno-30-decision-point)

---

## Fase 0: Pre-Lancio (Oggi)

### ✅ Tecnico

- [ ] **Deploy backend su Railway**
  - [ ] Connettere repository GitHub
  - [ ] Impostare variabili ambiente:
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `GEMINI_API_KEY`
    - `STRIPE_SECRET_KEY`
    - `PORT=3001`
  - [ ] Verificare log: nessun errore
  - [ ] Testare endpoint: `GET /api/health`

- [ ] **Deploy frontend su Vercel**
  - [ ] Connettere repository GitHub
  - [ ] Impostare variabili ambiente:
    - `REACT_APP_SUPABASE_URL`
    - `REACT_APP_SUPABASE_ANON_KEY`
    - `REACT_APP_API_URL`
  - [ ] Verificare build: successo
  - [ ] Testare dominio: praxis.app (o praxiswebapp.vercel.app)

- [ ] **Configurare Stripe**
  - [ ] Creare account Stripe (modalità live)
  - [ ] Creare prodotti:
    - [ ] Praxis Pro Monthly: €9.99/mese
    - [ ] Praxis Pro Annual: €79.99/anno
    - [ ] Praxis Elite Monthly: €24.99/mese
    - [ ] Praxis Elite Annual: €199.99/anno
  - [ ] Copiare Price ID in `.env`:
    - [ ] `STRIPE_PRICE_ID` (Pro Monthly)
    - [ ] `STRIPE_PRICE_ID_ANNUAL` (Pro Annual)
    - [ ] `STRIPE_PRICE_ID_ELITE` (Elite Monthly)
    - [ ] `STRIPE_PRICE_ID_ELITE_ANNUAL` (Elite Annual)
  - [ ] Installare Stripe CLI: `stripe login`
  - [ ] Testare webhook locale:
    ```bash
    stripe listen --forward-to localhost:3001/api/stripe/webhook
    ```
  - [ ] Testare checkout con carta `4242 4242 4242 4242`
  - [ ] Configurare webhook produzione:
    - [ ] Endpoint: `https://praxis-webapp-production.up.railway.app/api/stripe/webhook`
    - [ ] Eventi: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

- [ ] **Testare flusso completo**
  - [ ] Signup → Login → Onboarding
  - [ ] Creare Goal Tree
  - [ ] Fare check-in
  - [ ] Richiedere match
  - [ ] Upgrade a Pro (Stripe)
  - [ ] Verificare webhook aggiorna database

- [ ] **Configurare dominio**
  - [ ] Comprare dominio (praxis.app o praxiswebapp.com)
  - [ ] Configurare DNS su Vercel
  - [ ] Configurare HTTPS
  - [ ] Testare da mobile

- [ ] **Setup analytics**
  - [ ] Google Analytics (gratis)
    - [ ] Creare property
    - [ ] Aggiungere tracking code a frontend
  - [ ] PostHog (gratis fino a 1M events/mese)
    - [ ] Creare account
    - [ ] Aggiungere SDK a frontend
  - [ ] Google Search Console
    - [ ] Verificare dominio
    - [ ] Sitemap.xml

- [ ] **Creare Google Sheet per metriche**
  - [ ] Creare foglio "Praxis Metrics Tracker"
  - [ ] Aggiungere colonne (vedi `docs/launch/METRICS_TRACKER_TEMPLATE.md`)
  - [ ] Condividere con te stesso (email)

### ✅ Marketing

- [ ] **Landing Page**
  - [ ] Homepage con value prop chiara
  - [ ] Screenshot del prodotto
  - [ ] Call-to-action: "Prova Gratis"
  - [ ] Link a Terms & Privacy

- [ ] **Social Setup**
  - [ ] Twitter/X: @PraxisApp (o simile)
  - [ ] LinkedIn: Pagina aziendale Praxis
  - [ ] Instagram: @praxis.app
  - [ ] Reddit: u/PraxisFounder

- [ ] **Content Pre-programmato**
  - [ ] Scrivere thread Twitter di lancio (vedi `docs/launch/LAUNCH_THREAD_TEMPLATE.md`)
  - [ ] Scrivere post LinkedIn (versione professional)
  - [ ] Scrivere post Reddit (r/indiehackers)
  - [ ] Preparare 3 screenshot del prodotto
  - [ ] Registrare demo Loom (5 minuti)

- [ ] **Lista Outreach**
  - [ ] Lista 50 persone da contattare (Twitter, LinkedIn, Instagram)
  - [ ] Lista 10 micro-influencer (fitness, productivity)
  - [ ] Lista 10 blog/newsletter da contattare
  - [ ] Preparare template DM (vedi `docs/launch/OUTREACH_TEMPLATES.md`)

### ✅ Legale (Italia)

- [ ] **Privacy Policy**
  - [ ] Usare Iubenda (€29/anno) o TermsFeed
  - [ ] Aggiungere a footer del sito

- [ ] **Termini di Servizio**
  - [ ] Usare template online o avvocato (€200-500)
  - [ ] Aggiungere a footer del sito

- [ ] **Cookie Banner**
  - [ ] Se usi analytics non anonimizzati
  - [ ] Iubenda include anche questo

- [ ] **Partita IVA** (prima di incassare €5k)
  - [ ] Trovare commercialista a Verona (€500-800/anno)
  - [ ] Aprire P.IVA (regime forfettario)
  - [ ] Iscrizione INPS Gestione Separata

---

## Giorno 1: Setup Finale

### Mattina (9:00-12:00) — Biblioteca

- [ ] Creare account Stripe (modalità live)
- [ ] Creare prodotti Pro + Elite (mensili + annuali)
- [ ] Copiare Price ID in `.env` (backend + frontend)
- [ ] Installare Stripe CLI: `stripe login`
- [ ] Testare webhook locale con carta `4242 4242 4242 4242`
- [ ] Verificare che webhook aggiorna database (tabella `user_subscriptions`)

### Pomeriggio (14:00-17:00)

- [ ] Deploy backend su Railway (verificare variabili ambiente)
- [ ] Deploy frontend su Vercel (verificare variabili ambiente)
- [ ] Testare dominio personalizzato
- [ ] Testare flusso completo da mobile:
  - [ ] Signup
  - [ ] Login
  - [ ] Onboarding
  - [ ] Check-in
  - [ ] Upgrade Stripe
- [ ] Verificare log Railway: nessun errore

### Sera (20:00-21:00) — Casa

- [ ] Scrivere thread di lancio (personalizzare con screenshot)
- [ ] Programmare thread per domani 20:00 (Buffer o Twitter nativo)
- [ ] Preparare lista 20 DM da inviare domani
- [ ] Caricare demo Loom (se registrata)

### Metriche Giorno 1

- [ ] Utenti: 0
- [ ] MRR: €0
- [ ] Aggiornare Google Sheet

---

## Giorno 2: Launch Day 🚀

### Mattina (9:00-12:00)

- [ ] Verificare deploy (Railway + Vercel) funzionanti
- [ ] Postare thread Twitter/X (20:00 Italia = 2pm EST)
  - [ ] Usare template da `docs/launch/LAUNCH_THREAD_TEMPLATE.md`
  - [ ] Includere screenshot
  - [ ] Includere link: praxis.app
- [ ] Postare su LinkedIn (stesso contenuto, tono professional)
- [ ] Postare su Reddit:
  - [ ] r/indiehackers
  - [ ] r/SaaS
  - [ ] r/productivity
  - [ ] r/Italia (se accettato)
- [ ] Inviare 20 DM Twitter (cerca: "accountability partner", "habit tracker")

### Pomeriggio (14:00-17:00)

- [ ] Rispondere a OGNI commento su Twitter (prima ora cruciale)
- [ ] Rispondere a OGNI commento su Reddit
- [ ] Rispondere a OGNI commento su LinkedIn
- [ ] Loggare tutto su Google Sheet:
  - [ ] Commenti ricevuti
  - [ ] DM inviati
  - [ ] Click sul link
  - [ ] Signup conversions

### Sera (20:00-21:00)

- [ ] Controllare analytics: quanti signup?
- [ ] Aggiornare dashboard KPI (Google Sheet)
- [ ] Preparare DM per Giorno 3

### Metriche Giorno 2

- [ ] Utenti: 10-20 (target)
- [ ] MRR: €0
- [ ] Aggiornare Google Sheet

---

## Giorno 3-4: Outreach Sprint

### Routine Giornaliera

### Mattina (9:00-12:00)

- [ ] Controllare analytics di ieri
- [ ] Inviare 3 email personali agli utenti più attivi

  ```
  Oggetto: Come sta andando?

  Ciao [Nome],

  Ho visto che hai usato Praxis per [X] giorni.
  Come sta andando? C'è qualcosa che ti sta bloccando?

  Rispondi pure, leggo tutto io.

  — Gio
  ```

- [ ] Risolvere il problema #1 segnalato dagli utenti

### Pomeriggio (14:00-17:00)

- [ ] 50 DM totali:
  - [ ] 20 Twitter (cerca: "accountability", "habit tracker")
  - [ ] 15 Instagram (fitness influencer italiani micro: 5k-50k follower)
  - [ ] 10 LinkedIn (founder italiani, productivity coach)
  - [ ] 5 Discord (server "Study With Me", "Italian Entrepreneurs")
- [ ] Postare aggiornamento giornaliero su Twitter:
  ```
  Day X/30: [X] utenti, [X] MRR.
  Costruisco in pubblico.
  Prova gratis: praxis.app
  ```

### Sera (20:00-21:00)

- [ ] Loggare tutto su Google Sheet
- [ ] Preparare lista DM per domani

### Metriche Giorno 4

- [ ] Utenti: 30-50 (target)
- [ ] MRR: €0
- [ ] Aggiornare Google Sheet

---

## Giorno 5-7: Primi Beta User

### Focus: Onboarding manuale, esperienza white-glove

- [ ] Creare Google Form: "Praxis Beta Onboarding"
  - [ ] Nome, email, obiettivo principale
  - [ ] "Qual è la tua più grande sfida con la costanza?"
  - [ ] "Preferisci partner italiano o internazionale?"
- [ ] Inviare email personale a ogni nuovo utente (vedi `docs/launch/OUTREACH_TEMPLATES.md`)
- [ ] Match manuale degli utenti (obiettivo + fuso orario)
- [ ] Creare gruppo WhatsApp: "Praxis Beta — 30 Day Challenge"
  - [ ] Inviare invite a tutti gli utenti
  - [ ] Messaggio giornaliero: "Chi ha loggato oggi? 🔥"
- [ ] Screenshot di ogni vittoria (streak 3 giorni, goal completati)
- [ ] Postare giornaliero su Twitter: "User @X ha raggiunto Y giorni di streak!"

### Metriche Giorno 7

- [ ] Utenti: 50 (target)
- [ ] Pro Users: 0
- [ ] MRR: €0
- [ ] Retention Settimana 1: 70% (target)
- [ ] Aggiornare Google Sheet

---

## Settimana 2: Retention (Giorno 8-14)

### Giorno 8-10: Fix Friction

- [ ] Chiedere a ogni utente:
  > "Qual è l'UNICA cosa che ti ha fatto quasi mollare questa settimana?"
- [ ] Fix comuni:
  - [ ] "Dimenticavo di fare check-in" → Push notifications (2 ore)
  - [ ] "Il partner non rispondeva" → Email di nudge manuali (30 min)
  - [ ] "Troppi click" → Ridurre a 1-tap check-in (1 ora)
  - [ ] "Non capivo il valore" → Onboarding email sequence (1 ora)

### Metriche Giorno 10

- [ ] Utenti: 60 (target)
- [ ] MRR: €0
- [ ] Retention: 70% (target)
- [ ] Aggiornare Google Sheet

---

### Giorno 11-14: Prime Conversioni a Pagamento

- [ ] Deploy tier Pro (già pronto, verificare limiti):
  - [ ] Free: 3 obiettivi, 5 match/mese
  - [ ] Pro: €9.99/mese — illimitato + AI coaching
- [ ] Email ai top 20% utenti (vedi `docs/launch/OUTREACH_TEMPLATES.md`):

  ```
  Oggetto: Quick question about your goals

  Ciao [Nome],

  Ho notato che sei stato costante con [obiettivo] per [X] giorni.

  La prossima settimana lancio il piano Pro con:
  - Obiettivi illimitati
  - Coaching settimanale AI
  - Streak condivise

  Ti interesserebbe l'accesso anticipato al 50% di sconto?
  (€5/mese invece di €9.99, per sempre)

  Rispondi a questa email e ti mando il link.

  — Gio
  ```

### Metriche Giorno 14

- [ ] Utenti: 75 (target)
- [ ] Pro Users: 5 (target)
- [ ] MRR: €50 (target)
- [ ] Aggiornare Google Sheet

---

## Settimana 3: Content Engine (Giorno 15-21)

### Giorno 15-17: Creare 3 Pillar Content

- [ ] **Twitter Thread** (Lunedì 20:00)
  - [ ] Usare template da `docs/launch/LAUNCH_THREAD_TEMPLATE.md`
  - [ ] Titolo: "Ho testato 7 metodi di accountability. Solo 2 funzionano."
- [ ] **LinkedIn Article** (Mercoledì mattina)
  - [ ] Titolo: "Perché i Partner di Accountability Triplicano il Completamento degli Obiettivi"
  - [ ] Includere dati Praxis (50 beta user)
- [ ] **Loom Demo** (5 minuti)
  - [ ] Titolo: "Come Ho Costruito un SaaS in 6 Mesi da Solo"
  - [ ] Upload su YouTube o Loom
- [ ] **Repurpose:**
  - [ ] Thread → LinkedIn post
  - [ ] Thread → Reddit post
  - [ ] Thread → Instagram carousel

### Metriche Giorno 17

- [ ] Utenti: 100 (target)
- [ ] Pro Users: 8 (target)
- [ ] MRR: €100 (target)
- [ ] Aggiornare Google Sheet

---

### Giorno 18-21: Partnership Outreach

- [ ] Target: Micro-influencer italiani
  - [ ] Fitness: @fitnessitalia, @gymbeam_italia
  - [ ] Studenti: Discord università (Bocconi, Polimi)
  - [ ] Entrepreneur: 10 founder italiani (LinkedIn)
- [ ] DM Script (vedi `docs/launch/OUTREACH_TEMPLATES.md`):

  ```
  Ciao [Nome], sono Gio, ho costruito Praxis — un'app di accountability
  made in Italy 🇮🇹

  Vorrei offrirti accesso Pro gratuito per te (e la tua community se vuoi).
  Se funziona e ti piace, possiamo fare una revenue share (30% per ogni
  utente che porti).

  Ti va di provarlo 14 giorni gratis? Niente impegno.

  — Gio
  praxis.app
  ```

### Metriche Giorno 21

- [ ] Utenti: 150 (target)
- [ ] Pro Users: 12 (target)
- [ ] MRR: €150 (target)
- [ ] Aggiornare Google Sheet

---

## Settimana 4: Monetizzazione (Giorno 22-30)

### Giorno 22-25: Upsell Sprint

- [ ] Aggiungere 3 trigger di upsell (già pronti, verificare):
  - [ ] Limite match raggiunto (5/mese) → Modal upgrade
  - [ ] Streak interrotta → Modal Elite (Streak Shield)
  - [ ] Analytics sfocate → Modal Pro
- [ ] Vendite manuali:
  - [ ] Chiamare top 10 utenti free (WhatsApp voice)
  - [ ] Offrire founder rate: €79.99/anno per sempre

### Metriche Giorno 25

- [ ] Utenti: 200 (target)
- [ ] Pro Users: 18 (target)
- [ ] MRR: €250 (target)
- [ ] Aggiornare Google Sheet

---

### Giorno 26-30: Decision Point

- [ ] Valutare metriche:

| Metrica               | Target | Se sotto → Pivot            |
| --------------------- | ------ | --------------------------- |
| Utenti attivi         | 200    | < 100 → Messaggio sbagliato |
| Retention settimana 1 | 70%    | < 40% → Core loop rotto     |
| Conversione Pro       | 10%    | < 5% → Value prop unclear   |
| MRR                   | €1.000 | < €500 → Pivot o B2B        |

- [ ] **Se MRR > €1.000:**
  - [ ] Raddoppiare su content (post giornalieri)
  - [ ] Lanciare referral program
  - [ ] Pitchare blog tech italiani (Wired Italia, StartupItalia)

- [ ] **Se MRR < €500:**
  - [ ] Pivot 1: B2B — Vendi a productivity coach (€50/utente/mese)
  - [ ] Pivot 2: Nicchia — "Praxis per studenti universitari"
  - [ ] Pivot 3: Strip down — Solo 1-tap check-in, relancia come "Streaks.so"

### Metriche Giorno 30

- [ ] Utenti: 300 (target)
- [ ] Pro Users: 25-50 (target)
- [ ] MRR: €350-1.000 (target)
- [ ] Piani Annuali: 10-20 (€800-1.600 cash upfront)
- [ ] Aggiornare Google Sheet

---

## 📊 Metriche Chiave (Riepilogo)

| Giorno | Utenti | Pro Users | MRR (€)   | Retention W1 |
| ------ | ------ | --------- | --------- | ------------ |
| 1      | 10-20  | 0         | 0         | -            |
| 4      | 30-50  | 0         | 0         | -            |
| 7      | 50     | 0         | 0         | 70%          |
| 10     | 60     | 0         | 0         | 70%          |
| 14     | 75     | 5         | 50        | 65%          |
| 17     | 100    | 8         | 100       | 60%          |
| 21     | 150    | 12        | 150       | 60%          |
| 25     | 200    | 18        | 250       | 55%          |
| 30     | 300    | 25-50     | 350-1.000 | 55%          |

---

## 🎯 Daily Routine (Biblioteca di Verona)

| Orario      | Attività                             | Output      |
| ----------- | ------------------------------------ | ----------- |
| 9:00-10:00  | Check analytics, invia 3 email       | Retention   |
| 10:00-12:00 | Build: Fix problema #1               | Prodotto    |
| 12:00-13:00 | Pranzo + post su Twitter/LinkedIn    | Content     |
| 13:00-15:00 | Outreach: 50 DM                      | Acquisition |
| 15:00-16:00 | Scrivi 1 thread/articolo             | Content     |
| 16:00-17:00 | Admin: Stripe, support, piano domani | Operations  |
| 17:00-18:00 | Palestra                             | Salute      |
| 18:00-19:00 | Biblioteca chiude, vai a casa        | —           |

**Totale:** 8 ore/giorno. Questo È il tuo lavoro ora.

---

## 🥋 Mindset

### Ricorda Perché Hai Iniziato

Non stai costruendo questo per "essere il tuo capo".

Stai costruendo questo perché:

- Hai 27 anni, sei jacked, 135 IQ, e il mondo ti ha detto che sei "inoccupabile"
- Stai dimostrando che disciplina + intelligenza + accountability = inarrestabile
- Praxis è il sistema che ti ha costretto a shippare
- Ora stai dando quel sistema agli altri

**Ogni giorno che lavori su Praxis, stai vivendo il prodotto.**

Quando manchi un giorno, rompi la tua streak.
Quando shippi, dimostri che il sistema funziona.

**Sii il case study.**

---

## 🎉 Celebrazioni

**Quando raggiungi questi traguardi, celebra (ma non fermarti):**

- [ ] **Primo signup** → Cena nice da solo
- [ ] **Primi 10 utenti** → Dillo alla famiglia
- [ ] **Primo utente Pro** → Screenshot Stripe, posta su Twitter
- [ ] **Primi €100 MRR** → Bottiglia di Amarone
- [ ] **Primi €1.000 MRR** → Weekend off

---

**Inizia oggi. Non domani. Oggi.** 🇮🇹

**Buon lancio, Gio! 🚀🥋**
