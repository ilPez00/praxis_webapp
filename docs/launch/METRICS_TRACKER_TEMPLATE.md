# 📊 Metrics Tracker Template — Praxis

**Per:** Gio, Fondatore Praxis
**Obiettivo:** Tracciare metriche giornaliere, settimanali, mensili
**Tool:** Google Sheets (gratis)

---

## 📋 Indice

1. [Dashboard Principale](#dashboard-principale)
2. [Metriche Giornaliere](#metriche-giornaliere)
3. [Metriche Settimanali](#metriche-settimanali)
4. [Metriche Mensili](#metriche-mensili)
5. [Cohort Retention](#cohort-retention)
6. [Revenue Tracker](#revenue-tracker)
7. [Feedback Log](#feedback-log)
8. [Outreach Tracker](#outreach-tracker)
9. [KPI Dashboard](#kpi-dashboard)
10. [Formule Google Sheets](#formule-google-sheets)

---

## Dashboard Principale

### Struttura del Foglio

Crea un Google Sheet con questi fogli:

1. `📊 Dashboard` (panoramica)
2. `📅 Giornaliero` (metriche daily)
3. `📈 Settimanale` (metriche weekly)
4. `📉 Mensile` (metriche monthly)
5. `👥 Cohort` (retention analysis)
6. `💰 Revenue` (MRR, ARR, upgrade)
7. `💬 Feedback` (user feedback)
8. `📧 Outreach` (DM, email tracking)
9. `🎯 KPI` (grafici e target)

---

## Metriche Giornaliere

### Foglio: `📅 Giornaliero`

| Colonna | Campo            | Tipo     | Descrizione                             |
| ------- | ---------------- | -------- | --------------------------------------- |
| A       | Data             | Date     | GG/MM/AAAA                              |
| B       | Giorno #         | Number   | Giorno dal lancio (1, 2, 3...)          |
| C       | Utenti Totali    | Number   | Utenti registrati totali                |
| D       | DAU              | Number   | Daily Active Users (check-in nelle 24h) |
| E       | Nuovi Signup     | Number   | Nuovi utenti oggi                       |
| F       | Churn            | Number   | Utenti disattivati oggi                 |
| G       | Check-in Loggati | Number   | Check-in totali oggi                    |
| H       | Pro Users        | Number   | Utenti Pro totali                       |
| I       | Elite Users      | Number   | Utenti Elite totali                     |
| J       | MRR (€)          | Currency | Monthly Recurring Revenue               |
| K       | Outreach DM      | Number   | DM inviate oggi                         |
| L       | Risposte         | Number   | Risposte ricevute                       |
| M       | Note             | Text     | Cosa è successo oggi                    |

### Esempio Compilazione

| Data     | Giorno # | Utenti Totali | DAU | Nuovi Signup | Churn | Check-in | Pro Users | Elite Users | MRR (€) | Outreach DM | Risposte | Note                  |
| -------- | -------- | ------------- | --- | ------------ | ----- | -------- | --------- | ----------- | ------- | ----------- | -------- | --------------------- |
| 02/04/26 | 1        | 15            | 12  | 15           | 0     | 8        | 0         | 0           | €0      | 50          | 10       | Launch day!           |
| 03/04/26 | 2        | 28            | 18  | 14           | 1     | 15       | 0         | 0           | €0      | 50          | 12       | Primo churn 😕        |
| 04/04/26 | 3        | 42            | 25  | 15           | 1     | 22       | 0         | 0           | €0      | 50          | 15       | Primo post LinkedIn   |
| 05/04/26 | 4        | 58            | 35  | 17           | 1     | 30       | 0         | 0           | €0      | 50          | 18       | Thread Twitter virale |
| 06/04/26 | 5        | 72            | 45  | 15           | 1     | 38       | 2         | 0           | €20     | 50          | 20       | Primi 2 Pro! 🎉       |

---

## Metriche Settimanali

### Foglio: `📈 Settimanale`

| Colonna | Campo           | Tipo     | Descrizione                       |
| ------- | --------------- | -------- | --------------------------------- |
| A       | Settimana       | Number   | Settimana dal lancio (1, 2, 3...) |
| B       | Data Inizio     | Date     | Lunedì della settimana            |
| C       | Data Fine       | Date     | Domenica della settimana          |
| D       | Utenti Totali   | Number   | Utenti a fine settimana           |
| E       | Nuovi Signup    | Number   | Signup nella settimana            |
| F       | DAU Medio       | Number   | Media DAU / 7 giorni              |
| G       | Retention W1    | %        | % utenti attivi dopo 7 giorni     |
| H       | Check-in Totali | Number   | Check-in nella settimana          |
| I       | Pro Users       | Number   | Utenti Pro a fine settimana       |
| J       | MRR (€)         | Currency | MRR a fine settimana              |
| K       | Outreach Totale | Number   | DM totali nella settimana         |
| L       | Conversione     | %        | Signup / Outreach                 |
| M       | Note            | Text     | Cosa è successo                   |

### Esempio Compilazione

| Settimana | Data Inizio | Data Fine | Utenti Totali | Nuovi Signup | DAU Medio | Retention W1 | Check-in Totali | Pro Users | MRR (€) | Outreach Totale | Conversione | Note           |
| --------- | ----------- | --------- | ------------- | ------------ | --------- | ------------ | --------------- | --------- | ------- | --------------- | ----------- | -------------- |
| 1         | 02/04       | 08/04     | 150           | 150          | 45        | 70%          | 280             | 5         | €50     | 350             | 43%         | Launch week!   |
| 2         | 09/04       | 15/04     | 220           | 70           | 65        | 65%          | 420             | 12        | €120    | 350             | 20%         | Content engine |
| 3         | 16/04       | 22/04     | 350           | 130          | 95        | 60%          | 680             | 25        | €300    | 350             | 37%         | Partnership    |
| 4         | 23/04       | 29/04     | 500           | 150          | 140       | 55%          | 980             | 50        | €600    | 350             | 43%         | Upsell sprint  |

---

## Metriche Mensili

### Foglio: `📉 Mensile`

| Colonna | Campo           | Tipo     | Descrizione                         |
| ------- | --------------- | -------- | ----------------------------------- |
| A       | Mese            | Text     | Aprile 2026, Maggio 2026...         |
| B       | Utenti Totali   | Number   | Utenti a fine mese                  |
| C       | Nuovi Signup    | Number   | Signup nel mese                     |
| D       | Churn Totali    | Number   | Utenti persi nel mese               |
| E       | DAU Medio       | Number   | Media DAU nel mese                  |
| F       | Retention M1    | %        | % utenti attivi dopo 30 giorni      |
| G       | Check-in Totali | Number   | Check-in nel mese                   |
| H       | Pro Users       | Number   | Utenti Pro a fine mese              |
| I       | Elite Users     | Number   | Utenti Elite a fine mese            |
| J       | MRR (€)         | Currency | MRR a fine mese                     |
| K       | ARR (€)         | Currency | Annual Recurring Revenue (MRR × 12) |
| L       | CAC (€)         | Currency | Customer Acquisition Cost           |
| M       | LTV (€)         | Currency | Lifetime Value                      |
| N       | LTV:CAC         | Ratio    | LTV / CAC                           |
| O       | Churn Rate      | %        | Churn mensile                       |
| P       | Note            | Text     | Eventi chiave                       |

### Esempio Compilazione

| Mese   | Utenti Totali | Nuovi Signup | Churn Totali | DAU Medio | Retention M1 | Check-in Totali | Pro Users | Elite Users | MRR (€) | ARR (€) | CAC (€) | LTV (€) | LTV:CAC | Churn Rate | Note          |
| ------ | ------------- | ------------ | ------------ | --------- | ------------ | --------------- | --------- | ----------- | ------- | ------- | ------- | ------- | ------- | ---------- | ------------- |
| Apr 26 | 500           | 500          | 50           | 95        | 55%          | 2.100           | 50        | 0           | €600    | €7.200  | €0      | €180    | ∞       | 10%        | Launch month  |
| Mag 26 | 1.200         | 800          | 100          | 220       | 50%          | 5.500           | 120       | 5           | €1.500  | €18.000 | €10     | €200    | 20:1    | 8%         | Paid ads test |
| Giu 26 | 2.000         | 1.000        | 200          | 380       | 45%          | 9.200           | 250       | 15          | €3.000  | €36.000 | €15     | €220    | 15:1    | 10%        | Scaling       |

---

## Cohort Retention

### Foglio: `👥 Cohort`

**Cos'è:** Analisi della retention per coorte di utenti (quanti tornano dopo X giorni)

### Struttura

| Colonna | Campo     | Tipo   | Descrizione                        |
| ------- | --------- | ------ | ---------------------------------- |
| A       | Cohort    | Date   | Settimana di signup (es. 02/04/26) |
| B       | Utenti    | Number | Utenti nella coorte                |
| C       | Giorno 0  | %      | % attivi al giorno 0 (sempre 100%) |
| D       | Giorno 1  | %      | % attivi al giorno 1               |
| E       | Giorno 3  | %      | % attivi al giorno 3               |
| F       | Giorno 7  | %      | % attivi al giorno 7               |
| G       | Giorno 14 | %      | % attivi al giorno 14              |
| H       | Giorno 30 | %      | % attivi al giorno 30              |

### Esempio Compilazione

| Cohort   | Utenti | Giorno 0 | Giorno 1 | Giorno 3 | Giorno 7 | Giorno 14 | Giorno 30 |
| -------- | ------ | -------- | -------- | -------- | -------- | --------- | --------- |
| 02/04/26 | 150    | 100%     | 80%      | 65%      | 55%      | 45%       | 35%       |
| 09/04/26 | 120    | 100%     | 75%      | 60%      | 50%      | 40%       | -         |
| 16/04/26 | 180    | 100%     | 82%      | 68%      | 58%      | -         | -         |
| 23/04/26 | 200    | 100%     | 78%      | 62%      | -        | -         | -         |

### Come Calcolare

```
Retention Giorno X = (Utenti attivi al giorno X / Utenti nella coorte) × 100
```

**Esempio:**

- Coorte 02/04: 150 utenti
- Giorno 7: 82 utenti attivi
- Retention: (82 / 150) × 100 = 55%

---

## Revenue Tracker

### Foglio: `💰 Revenue`

| Colonna | Campo          | Tipo     | Descrizione                                                    |
| ------- | -------------- | -------- | -------------------------------------------------------------- |
| A       | Data           | Date     | Data transazione                                               |
| B       | Utente         | Text     | Nome/Email utente                                              |
| C       | Tipo           | Dropdown | Nuovo / Upgrade / Downgrade / Rinnovo / Rimborso               |
| D       | Piano          | Dropdown | Free / Pro Monthly / Pro Annual / Elite Monthly / Elite Annual |
| E       | Importo (€)    | Currency | Importo transazione                                            |
| F       | MRR Impact (€) | Currency | Impatto su MRR (mensile = importo, annuale = importo/12)       |
| G       | Stripe ID      | Text     | ID transazione Stripe                                          |
| H       | Note           | Text     | Note (es. "Referral Mario", "Black Friday")                    |

### Esempio Compilazione

| Data  | Utente            | Tipo     | Piano         | Importo (€) | MRR Impact (€) | Stripe ID | Note            |
| ----- | ----------------- | -------- | ------------- | ----------- | -------------- | --------- | --------------- |
| 06/04 | mario@email.com   | Nuovo    | Pro Monthly   | €9.99       | €9.99          | ch_123456 | Primo Pro!      |
| 07/04 | luca@email.com    | Nuovo    | Pro Annual    | €79.99      | €6.67          | ch_123457 | Annuale         |
| 08/04 | giulia@email.com  | Nuovo    | Elite Monthly | €24.99      | €24.99         | ch_123458 | Elite!          |
| 10/04 | marco@email.com   | Upgrade  | Pro → Elite   | +€15.00     | +€15.00        | ch_123459 | Upgrade         |
| 15/04 | stefano@email.com | Rimborso | Pro Monthly   | -€9.99      | -€9.99         | ch_123460 | Non soddisfatto |

### Riepilogo Mensile

| Mese   | Nuovi Upgrade | Downgrade | Rimborsi | MRR Netto (€) |
| ------ | ------------- | --------- | -------- | ------------- |
| Apr 26 | €600          | €0        | €-50     | €550          |
| Mag 26 | €1.200        | €-100     | €-50     | €1.050        |
| Giu 26 | €2.000        | €-200     | €-100    | €1.700        |

---

## Feedback Log

### Foglio: `💬 Feedback`

| Colonna | Campo    | Tipo     | Descrizione                                            |
| ------- | -------- | -------- | ------------------------------------------------------ |
| A       | Data     | Date     | Data feedback                                          |
| B       | Utente   | Text     | Nome/Email                                             |
| C       | Tipo     | Dropdown | Bug / Feature Request / Complimento / Problema / Altro |
| D       | Canale   | Dropdown | Email / DM Twitter / DM Instagram / WhatsApp / Altro   |
| E       | Feedback | Text     | Descrizione feedback                                   |
| F       | Priorità | Dropdown | Alta / Media / Bassa                                   |
| G       | Stato    | Dropdown | Da Fare / In Corso / Fatto / Non Farò                  |
| H       | Note     | Text     | Note interne                                           |

### Esempio Compilazione

| Data  | Utente  | Tipo        | Canale   | Feedback                                   | Priorità | Stato    | Note           |
| ----- | ------- | ----------- | -------- | ------------------------------------------ | -------- | -------- | -------------- |
| 03/04 | Mario   | Bug         | Email    | "Non riesco a fare check-in da mobile"     | Alta     | Fatto    | Fixato 04/04   |
| 04/04 | Luca    | Feature     | Twitter  | "Potreste aggiungere push notifications?"  | Media    | In Corso | Sprint 2       |
| 05/04 | Giulia  | Complimento | WhatsApp | "Adoro l'app, mi sta aiutando tantissimo!" | -        | -        | Case study?    |
| 06/04 | Marco   | Problema    | Email    | "Il mio partner non risponde da 3 giorni"  | Alta     | Fatto    | Email di nudge |
| 07/04 | Stefano | Feature     | DM       | "Integrazione con Google Calendar?"        | Bassa    | Non Farò | Per Q3 2026    |

---

## Outreach Tracker

### Foglio: `📧 Outreach`

| Colonna | Campo          | Tipo     | Descrizione                                                 |
| ------- | -------------- | -------- | ----------------------------------------------------------- |
| A       | Data           | Date     | Data invio                                                  |
| B       | Nome           | Text     | Nome contatto                                               |
| C       | Piattaforma    | Dropdown | Twitter / LinkedIn / Instagram / Email / WhatsApp / Discord |
| D       | Username/Email | Text     | @username o email                                           |
| E       | Template       | Text     | Template usato (es. "Twitter 1", "Email 2")                 |
| F       | Risposta?      | Dropdown | Sì / No                                                     |
| G       | Signup?        | Dropdown | Sì / No                                                     |
| H       | Upgrade?       | Dropdown | Sì / No / Pro / Elite                                       |
| I       | Note           | Text     | Note (es. "Interessato", "Da follow-up")                    |

### Esempio Compilazione

| Data  | Nome         | Piattaforma | Username/Email  | Template   | Risposta? | Signup? | Upgrade? | Note         |
| ----- | ------------ | ----------- | --------------- | ---------- | --------- | ------- | -------- | ------------ |
| 02/04 | Mario Rossi  | Twitter     | @mario123       | Twitter 1  | Sì        | Sì      | No       | Interessato  |
| 02/04 | Luca Bianchi | LinkedIn    | luca@email.com  | LinkedIn 1 | No        | No      | No       | Da follow-up |
| 02/04 | Giulia Verdi | Instagram   | @giulia.fit     | IG 1       | Sì        | Sì      | Sì       | Upgrade Pro! |
| 03/04 | Marco Neri   | Email       | marco@email.com | Email 1    | Sì        | Sì      | No       | Beta user    |
| 03/04 | Stefano      | Discord     | stefano#1234    | Discord 1  | No        | No      | No       | Da follow-up |

### Riepilogo Performance

| Piattaforma | Inviati | Risposte | Signup | Upgrade | Conversione |
| ----------- | ------- | -------- | ------ | ------- | ----------- |
| Twitter     | 200     | 40       | 12     | 2       | 6%          |
| LinkedIn    | 100     | 20       | 8      | 3       | 8%          |
| Instagram   | 100     | 25       | 15     | 5       | 15%         |
| Email       | 150     | 40       | 20     | 8       | 13%         |
| WhatsApp    | 50      | 35       | 25     | 10      | 50%         |
| **Totale**  | **600** | **160**  | **80** | **28**  | **13%**     |

---

## KPI Dashboard

### Foglio: `🎯 KPI`

**Crea questi grafici:**

### 1. Utenti Totali (Line Chart)

```
Asse X: Data (giornaliera)
Asse Y: Utenti Totali
Target: 300 entro Giorno 30
```

### 2. MRR (Line Chart)

```
Asse X: Data (giornaliera)
Asse Y: MRR (€)
Target: €1.000 entro Giorno 30
```

### 3. DAU/MAU Ratio (Gauge Chart)

```
Formula: (DAU / MAU) × 100
Target: > 30%
 Rosso: < 15%
 Giallo: 15-30%
 Verde: > 30%
```

### 4. Retention W1 (Line Chart)

```
Asse X: Settimana
Asse Y: Retention W1 (%)
Target: > 70%
```

### 5. Conversione Free→Pro (Pie Chart)

```
Free Users: X%
Pro Users: Y%
Elite Users: Z%
```

### 6. Outreach Performance (Bar Chart)

```
Asse X: Piattaforma (Twitter, LinkedIn, Instagram, Email, WhatsApp)
Asse Y: Conversione (%)
```

### 7. CAC vs LTV (Scatter Plot)

```
Asse X: CAC (€)
Asse Y: LTV (€)
Target: LTV:CAC > 3:1
```

---

## Formule Google Sheets

### Formule Utili

#### 1. Calcolo MRR

```
=SUM(J:J)  // Somma colonna MRR
```

#### 2. Crescita Giornaliera (%)

```
=(C3-C2)/C2  // (Oggi - Ieri) / Ieri
```

#### 3. Retention Rate

```
=(D2/C2)*100  // (Utenti attivi / Utenti totali) × 100
```

#### 4. Conversione Outreach

```
=(G2/F2)*100  // (Signup / Outreach) × 100
```

#### 5. DAU/MAU Ratio

```
=(D2/AVERAGE(D2:D31))*100  // (DAU / Media DAU 30 giorni) × 100
```

#### 6. Churn Rate

```
=(F2/C2)*100  // (Churn / Utenti totali) × 100
```

#### 7. LTV (Lifetime Value)

```
=J2/(O2/100)  // MRR / (Churn Rate / 100)
```

#### 8. CAC (Customer Acquisition Cost)

```
=SUM(K:K)/COUNTA(G:G)  // Totale Outreach / Signup totali
```

#### 9. LTV:CAC Ratio

```
=M2/L2  // LTV / CAC
```

#### 10. ARR (Annual Recurring Revenue)

```
=J2*12  // MRR × 12
```

---

## Template Pronto all'Uso

### Crea il tuo Google Sheet

1. Vai su [sheets.google.com](https://sheets.google.com)
2. Clicca "+ Nuovo" → "Foglio di calcolo"
3. Nomina: "Praxis Metrics Tracker"
4. Crea i 9 fogli come descritto sopra
5. Copia le intestazioni delle colonne
6. Aggiungi le formule
7. Crea i grafici nel foglio KPI

### Link Template (Copia)

Puoi anche copiare questo template:

[Link al template Google Sheets] _(crea il tuo e condividi il link)_

---

## Routine di Aggiornamento

### Giornaliera (17:00, 5 minuti)

```
☐ Apri Google Sheet
☐ Vai su foglio "📅 Giornaliero"
☐ Inserisci dati di oggi:
  - Utenti Totali (da Supabase)
  - DAU (da Supabase)
  - Nuovi Signup (da Supabase)
  - Check-in (da Supabase)
  - Pro/Elite Users (da Stripe/Supabase)
  - MRR (da Stripe)
  - Outreach DM (dal tuo tracker)
  - Risposte (dal tuo tracker)
☐ Scrivi 1 nota su cosa è successo oggi
☐ Chiudi Sheet
```

### Settimanale (Domenica 16:00, 15 minuti)

```
☐ Apri Google Sheet
☐ Vai su foglio "📈 Settimanale"
☐ Inserisci dati della settimana:
  - Utenti Totali (da Giornaliero)
  - Nuovi Signup (somma Giornaliero)
  - DAU Medio (media Giornaliero)
  - Retention W1 (calcola da Cohort)
  - Check-in Totali (somma Giornaliero)
  - Pro Users (da Stripe)
  - MRR (da Stripe)
  - Outreach Totale (somma Giornaliero)
☐ Aggiorna foglio "💬 Feedback" (rivedi email/DM)
☐ Aggiorna foglio "📧 Outreach" (rivedi performance)
☐ Controlla KPI Dashboard (grafici aggiornati?)
☐ Scrivi 1 nota su cosa è successo questa settimana
☐ Piano per la prossima settimana (3 priorità)
```

### Mensile (Ultimo giorno del mese, 30 minuti)

```
☐ Apri Google Sheet
☐ Vai su foglio "📉 Mensile"
☐ Inserisci dati del mese:
  - Utenti Totali (da Settimanale)
  - Nuovi Signup (somma Settimanale)
  - Churn Totali (da Settimanale)
  - DAU Medio (media Settimanale)
  - Retention M1 (calcola da Cohort)
  - Check-in Totali (somma Settimanale)
  - Pro/Elite Users (da Stripe)
  - MRR/ARR (da Stripe)
  - CAC (calcola da Outreach)
  - LTV (calcola da MRR + Churn)
  - LTV:CAC (calcola)
  - Churn Rate (calcola)
☐ Rivedi foglio "💬 Feedback" (pattern ricorrenti?)
☐ Rivedi foglio "👥 Cohort" (trend retention?)
☐ Aggiorna KPI Dashboard (grafici mensili)
☐ Scrivi report mensile (3 successi, 3 problemi, 3 priorità)
☐ Piano per il prossimo mese (OKR)
```

---

## Target e Soglie

### Soglie di Allarme

| KPI          | Verde      | Giallo      | Rosso      | Azione              |
| ------------ | ---------- | ----------- | ---------- | ------------------- |
| DAU/MAU      | > 30%      | 15-30%      | < 15%      | Core loop friction  |
| Retention W1 | > 70%      | 40-70%      | < 40%      | Fix onboarding      |
| Conversione  | > 5%       | 2-5%        | < 2%       | Value prop unclear  |
| Churn Rate   | < 5%       | 5-10%       | > 10%      | Prodotto non sticky |
| LTV:CAC      | > 3:1      | 1-3:1       | < 1:1      | CAC troppo alto     |
| MRR Growth   | > 50%/mese | 20-50%/mese | < 20%/mese | Acquisition broken  |

### Target 30 Giorni

| KPI           | Obiettivo | Stretch Goal |
| ------------- | --------- | ------------ |
| Utenti Totali | 300       | 500          |
| DAU           | 100       | 150          |
| DAU/MAU       | 30%       | 40%          |
| Retention W1  | 70%       | 80%          |
| Pro Users     | 30        | 50           |
| MRR           | €1.000    | €2.000       |
| Outreach DM   | 1.500     | 2.000        |
| Conversione   | 5%        | 8%           |

---

**Buon tracking! 📊**
