# Praxis — Social Media Content Kit

Generated: 2026-04-10

## Positioning (pick ONE before posting)

Praxis is **big** (36 features) and therefore hard to pitch. Before any post, decide which of these three narratives you're shipping:

| Narrative                                                                                   | Audience                          | Goal                                     | Best platforms                                             |
| ------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| **A. "Technical flex"** — "I built a 79k-LOC habit-tracker SaaS solo in 2.5 months"         | Devs, recruiters, indie hackers   | Land a job / consulting gigs / followers | X (dev twitter), LinkedIn, Hacker News, IndieHackers       |
| **B. "Product launch"** — "Praxis: your daily goal journal + accountability buddy"          | End users (habit-tracker curious) | Sign-ups, $9.99/mo Pro                   | Instagram, TikTok, Reddit r/getdisciplined, r/productivity |
| **C. "Boilerplate sale"** — "Launch your own habit-tracker SaaS with Praxis Starter ($149)" | Indie devs, wantrepreneurs        | Gumroad / CodeCanyon sales               | X, IndieHackers, Reddit r/SideProject                      |

**Recommendation:** lead with **A** (portfolio/flex) for the first 2 weeks — it has the highest EV per the honest valuation discussion. Mix in **C** as a secondary track. Only run **B** if you actually want to do distribution work.

## Files in this kit

```
social/
├── README.md              ← this file (strategy)
├── posts-technical.md     ← narrative A: technical flex posts (X, LinkedIn, HN)
├── posts-product.md       ← narrative B: product launch posts (IG, TikTok, Reddit)
├── posts-boilerplate.md   ← narrative C: boilerplate sale posts (X, IH, Gumroad)
├── image-prompts.md       ← prompts for Midjourney / DALL·E / SDXL
└── images/                ← SVG visuals ready to post (convert to PNG at 1080×1080)
    ├── streak-card.svg            — hero streak visual (IG, Twitter card)
    ├── stats-flex.svg             — "79k LOC · 820 commits" stat card (LinkedIn)
    ├── goal-tree-teaser.svg       — goal-tree visualization tease (product)
    ├── boilerplate-stack.svg      — tech-stack badge card (Gumroad, HN)
    └── comparison-card.svg        — "Praxis vs competitors" card (ads)
```

## Posting cadence (conservative, 4 weeks)

**Week 1** — Technical narrative launch

- Mon: X announce thread + stats-flex.svg
- Tue: LinkedIn long-form (IT) + stats-flex.svg
- Wed: HN "Show HN" (text only)
- Thu: X feature deep-dive (goal tree) + goal-tree-teaser.svg
- Fri: IndieHackers build log

**Week 2** — Engagement / case studies

- Mon: X retrospective thread ("what I learned")
- Wed: LinkedIn (EN) technical deep-dive on Vite 8 / Rolldown
- Fri: Reddit r/SideProject launch

**Week 3** — Boilerplate test

- Mon: Gumroad listing + X announce
- Wed: IndieHackers "for sale" post
- Fri: r/webdev "built this, selling starter"

**Week 4** — Evaluate + decide (kill, pivot, or continue per the honest-valuation memo)

## Brand tokens (for image editors)

- **Primary orange** (streaks, fire): `#F97316`
- **Secondary purple** (Axiom AI, PP currency): `#8B5CF6` / `#A78BFA`
- **Accent amber** (referral, Pro): `#F59E0B`
- **Background dark**: `#0A0B14`
- **Text on dark**: `#FFFFFF` / muted `rgba(255,255,255,0.6)`
- **Font recommendation**: Inter or Geist for text; JetBrains Mono for numbers/stats

## Do-not list

- Do not claim user numbers you don't have. Say "built" not "loved by thousands."
- Do not promise AI features you've already scoped down. "Axiom" is opt-in LLM.
- Do not post the Railway URL or Supabase URL publicly.
- Do not post screenshots containing real user IDs, emails, or chat content.
- Do not cross-post the exact same text to HN and Reddit — both communities punish that.
