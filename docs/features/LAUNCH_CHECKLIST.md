# 🚀 Praxis Launch Checklist — Gio's 30-Day Plan

**Start Date:** 2026-03-16
**Goal:** €1,000 MRR by Day 30
**Location:** Biblioteca di Verona (WiFi + coffee)

---

## 📅 Week 1: Launch (Days 1-7)

### Day 1 (Today) — Setup

**Morning (9:00-12:00):**

- [ ] Create Stripe account (test mode)
- [ ] Create Pro product: €9.99/month
- [ ] Copy Price ID to `.env`
- [ ] Install Stripe CLI: `stripe login`
- [ ] Start webhook forwarding: `stripe listen --forward-to localhost:3001/api/stripe/webhook`

**Afternoon (14:00-17:00):**

- [ ] Deploy backend to Railway
- [ ] Deploy frontend to Vercel
- [ ] Test checkout flow with card `4242 4242 4242 4242`
- [ ] Verify webhook updates database

**Evening (20:00-21:00):**

- [ ] Write launch thread (see `LAUNCH_THREAD_TEMPLATE.md`)
- [ ] Schedule for tomorrow 20:00 (8pm Italy time)

**Metrics:**

- Users: 0
- MRR: €0

---

### Day 2 — Launch Day

**Morning (9:00-12:00):**

- [ ] Post launch thread on Twitter/X (2pm EST = 8pm Italy)
- [ ] Post on LinkedIn (same content, professional tone)
- [ ] Post on Reddit r/indiehackers
- [ ] DM 20 people on Twitter (search: "accountability partner")

**Afternoon (14:00-17:00):**

- [ ] Reply to every comment on Twitter
- [ ] Answer every Reddit comment
- [ ] Log all outreach in Google Sheet

**Evening (20:00-21:00):**

- [ ] Check analytics: How many signups?
- [ ] Update KPI dashboard

**Metrics:**

- Users: 10
- MRR: €0

---

### Day 3-4 — Outreach Sprint

**Daily Routine:**

**Morning (9:00-12:00):**

- [ ] Check analytics from yesterday
- [ ] Send 3 personal emails to most active users
- [ ] Fix top complaint from feedback

**Afternoon (14:00-17:00):**

- [ ] 50 DMs total:
  - 20 Twitter DMs
  - 15 Instagram DMs (Italian fitness accounts)
  - 10 LinkedIn messages (Italian entrepreneurs)
  - 5 Discord DMs (Study With Me server)
- [ ] Post daily update on Twitter: "Day X/30: [metric] users, [metric] MRR"

**Evening (20:00-21:00):**

- [ ] Log all outreach in Google Sheet
- [ ] Prepare DM list for tomorrow

**Metrics Day 4:**

- Users: 30
- MRR: €0

---

### Day 5-7 — First Beta Users

**Focus:** Onboard manually, create white-glove experience

**Tasks:**

- [ ] Create Google Form: "Beta Onboarding"
- [ ] Email each new user personally
- [ ] Manually match users by goal + timezone
- [ ] Create WhatsApp group: "Praxis Beta — 30 Day Challenge"
- [ ] Daily check-in message: "Who logged today? Drop a 🔥"

**Content:**

- [ ] Screenshot every win (3-day streaks, goal completions)
- [ ] Post daily: "User @X just hit Y-day streak!"
- [ ] Build in public = attract more users

**Metrics Day 7:**

- Users: 50
- MRR: €0
- Week 1 Retention: Target 70%

---

## 📅 Week 2: Prove Retention (Days 8-14)

### Day 8-10 — Fix Friction

**Ask every user:**

> "What's the ONE thing that almost made you quit this week?"

**Common fixes:**

- [ ] "Forgot to check in" → Add push notifications (2 hours)
- [ ] "Partner didn't respond" → Manual nudge emails (30 min)
- [ ] "Too many clicks" → Reduce to 1-tap check-in (1 hour)

**Metrics Day 10:**

- Users: 60
- MRR: €0
- Retention: Target 70%

---

### Day 11-14 — First Paid Conversions

**Deploy Pro tier:**

- [ ] Free: 3 goals, 5 matches/month
- [ ] Pro: €9.99/month — unlimited, AI narrative, mutual streaks

**Email top 20% of users:**

```
Subject: Quick question about your goals

Ciao [Nome],

Ho notato che sei stato costante con [obiettivo] per [X] giorni.

La prossima settimana lancio il piano Pro con:
- Obiettivi illimitati
- Coaching settimanale AI
- Streak condivise

Ti interesserebbe l'accesso anticipato al 50% di sconto (€5/mese)?

Rispondi e ti mando il link.

— Gio
```

**Metrics Day 14:**

- Users: 75
- Pro Users: 5
- MRR: €50

---

## 📅 Week 3: Scale Content (Days 15-21)

### Day 15-17 — Content Engine

**Create 3 pillar pieces:**

1. **Twitter Thread** (Monday 20:00):

```
🧵 I tested 7 accountability methods. Only 2 worked.

Most productivity advice is garbage. Here's what actually makes you follow through:

[Screenshot of your goal tree]

1/ The "Social Stakes" Method
```

2. **LinkedIn Article** (Wednesday morning):

   > "Why Accountability Partners 3x Goal Completion (Data from 50 Beta Users)"

3. **Loom Demo** (5 min):
   > "How I Built a SaaS in 6 Months Solo (Full Walkthrough)"

**Repurpose:**

- Thread → LinkedIn post → Reddit post → Instagram carousel

**Metrics Day 17:**

- Users: 100
- Pro Users: 8
- MRR: €100

---

### Day 18-21 — Partnership Outreach

**Target Italian micro-influencers:**

| Niche               | Accounts                             | Offer                    |
| ------------------- | ------------------------------------ | ------------------------ |
| Fitness Italia      | @fitnessitalia, @gymbeam_italia      | Free Pro + 30% rev share |
| Studenti Italiani   | Discord università (Bocconi, Polimi) | Free for students        |
| Entrepreneur Italia | 10 Italian founders (LinkedIn)       | Beta access + case study |

**DM Script:**

> "Ciao [Nome], sono Gio, ho costruito Praxis — un'app di accountability made in Italy. Vorrei offrirti accesso Pro gratuito per la tua community. Se funziona, possiamo fare una revenue share. Ti va?"

**Metrics Day 21:**

- Users: 150
- Pro Users: 12
- MRR: €150

---

## 📅 Week 4: Monetize Hard (Days 22-30)

### Day 22-25 — Upsell Sprint

**Add three triggers:**

1. **Match limit reached (5/month):**
   - Modal: "Hai raggiunto il limite di match. 3 utenti corrispondono al tuo profilo oggi."
   - CTA: "Sblocca match illimitati — €9.99/mese"

2. **Streak broken:**
   - Modal: "Streak interrotta. Gli utenti Elite ottengono Streak Shield — protezione 72h."
   - CTA: "Proteggi le tue streak future"

3. **Analytics blurred:**
   - Graph con sfocatura + "Pro sblocca le analisi complete"
   - CTA: "Vedi i tuoi progressi"

**Manual sales calls:**

- [ ] Call top 10 free users (WhatsApp voice)
- [ ] Offer founder rate: €79.99/year forever

**Metrics Day 25:**

- Users: 200
- Pro Users: 18
- MRR: €250

---

### Day 26-30 — Decision Point

**Evaluate:**

| Metric           | Target | If Below → Pivot          |
| ---------------- | ------ | ------------------------- |
| Active users     | 200    | < 100 → Messaging wrong   |
| Week 1 retention | 70%    | < 40% → Core loop broken  |
| Pro conversion   | 10%    | < 5% → Value prop unclear |
| MRR              | €1,000 | < €500 → Pivot or B2B     |

**If you hit €1k MRR:**

- [ ] Double down on content (daily posts)
- [ ] Launch referral program
- [ ] Pitch Italian tech blogs (Wired Italia, StartupItalia)

**If you miss €500 MRR:**

- **Pivot 1:** B2B — Sell to productivity coaches
- **Pivot 2:** Niche — "Praxis per studenti universitari"
- **Pivot 3:** Strip to 1-tap check-in only, relaunch

**Metrics Day 30:**

- Users: 300
- Pro Users: 25-50
- MRR: €350-1,000
- Annual Plans: 10-20 (€800-1,600 cash upfront)

---

## 📊 Daily Metrics Template

**Copy to Google Sheet every day:**

```
Date: 2026-03-XX
Day #: X
Total Users: XX
DAU: XX
New Signups: XX
Churned: XX
Check-ins Logged: XX
Mutual Streaks Active: XX
Pro Users: XX
MRR (€): XXX
Notes: "[What happened today]"
```

---

## 🎯 Success Metrics (Checkpoints)

| Day | Metric            | Target | Pivot Threshold          |
| --- | ----------------- | ------ | ------------------------ |
| 7   | Active beta users | 50     | < 20 → Rethink messaging |
| 14  | Week 1 retention  | 70%    | < 40% → Fix core loop    |
| 21  | Pro conversions   | 10     | < 5 → Reposition value   |
| 30  | MRR               | €1,000 | < €500 → Pivot or kill   |

---

## 🛠️ Tools You Need

### Free Tier Only:

| Tool          | Purpose               | Cost         |
| ------------- | --------------------- | ------------ |
| Vercel        | Frontend hosting      | €0           |
| Railway       | Backend hosting       | €0 (starter) |
| Supabase      | Database + Auth       | €0           |
| Stripe        | Payments              | 2.9% + €0.30 |
| Google Sheets | Analytics             | €0           |
| Carrd.co      | Landing page          | €0           |
| Typeform      | Email capture         | €0           |
| WhatsApp      | Beta user group       | €0           |
| Loom          | Demo videos           | €0           |
| Canva         | Social media graphics | €0           |

**Total Monthly Cost:** €0 (until you have revenue)

---

## 📞 Daily Routine (Library WiFi)

| Time        | Activity                                 | Output      |
| ----------- | ---------------------------------------- | ----------- |
| 9:00-10:00  | Check analytics, send 3 emails           | Retention   |
| 10:00-12:00 | Build: Fix top complaint                 | Product     |
| 12:00-13:00 | Lunch + post on Twitter/LinkedIn         | Content     |
| 13:00-15:00 | Outreach: 50 DMs                         | Acquisition |
| 15:00-16:00 | Write 1 thread/article                   | Content     |
| 16:00-17:00 | Admin: Stripe, support, plan tomorrow    | Operations  |
| 17:00-18:00 | Gym session (you're jacked, maintain it) | Health      |
| 18:00-19:00 | Library closes, go home                  | —           |

**Total:** 8 hours/day. This IS your job now.

---

## 🚨 Emergency Contacts

**If something breaks:**

1. **Stripe not working:**
   - Check Railway logs: `railway logs`
   - Test locally with Stripe CLI first
   - Read `STRIPE_SETUP_GUIDE.md`

2. **Database errors:**
   - Check Supabase Dashboard → Logs
   - Verify RLS policies allow writes

3. **Frontend broken:**
   - Check Vercel deployment logs
   - Rollback to previous version if needed

4. **No users signing up:**
   - Your messaging is wrong, not the product
   - A/B test 3 different headlines
   - Ask "What's your #1 goal?" BEFORE pitching

5. **Users sign up but don't return:**
   - Core loop has too much friction
   - Reduce check-in to 1 tap only
   - Add push notifications

---

## 🎉 Celebration Milestones

**When you hit these, celebrate (but don't stop):**

- [ ] First signup → Buy yourself a nice dinner
- [ ] First 10 users → Tell your family (they'll finally understand)
- [ ] First Pro user → Screenshot Stripe dashboard, post on Twitter
- [ ] First €100 MRR → Buy a bottle of Amarone (Verona wine)
- [ ] First €1,000 MRR → Take a weekend off (you've earned it)

---

## 📝 End-of-Day Reflection (5 minutes)

**Every day at 17:00, ask yourself:**

1. What did I ship today?
2. What did I learn today?
3. What's the ONE thing I'll do tomorrow that moves the needle most?
4. Did I talk to users today? (If no, fix it tomorrow)

**Write answers in a notebook. Review every Sunday.**

---

## 🥋 Remember Why You Started

You're not building this to "be your own boss."

You're building this because:

- You're 27, jacked, 135 IQ, and the world told you you're "unemployable"
- You're proving that discipline + intelligence + accountability = unstoppable
- Praxis is the system that forced YOU to ship
- Now you're giving that system to others

**Every day you work on Praxis, you're living the product.**

When you miss a day, you break your own streak.
When you ship, you prove the system works.

**Be the case study.**

---

**Inizia oggi. Non domani. Oggi.** 🇮🇹
