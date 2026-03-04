# Praxis — Wiki Home

> **Praxis** is a goal-accountability social platform. Users build weighted goal trees, get matched with peers who share aligned objectives, hold each other accountable through peer verification, and get coached by an AI performance coach.

---

## Pages

| Page | Description |
|------|-------------|
| [Getting Started](Getting-Started) | Local development setup |
| [Architecture](Architecture) | System design, tech stack, data flow |
| [API Reference](API-Reference) | All backend REST endpoints |
| [Database Schema](Database-Schema) | Supabase tables and relationships |
| [Deployment](Deployment) | Vercel · Railway · GitHub Pages |
| [Features](Features) | Full feature walkthrough |
| [Contributing](Contributing) | Dev conventions and workflow |

---

## Quick Links

- **Live app:** [praxis-webapp.vercel.app](https://praxis-webapp.vercel.app) *(primary)*
- **GitHub Pages:** [ilpez00.github.io/praxis_webapp](https://ilpez00.github.io/praxis_webapp) *(mirror)*
- **Backend API:** `https://web-production-646a4.up.railway.app/api`
- **Repo:** [github.com/ilPez00/praxis_webapp](https://github.com/ilPez00/praxis_webapp)

---

## Tech Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript · MUI v7 · Framer Motion |
| Backend | Express 5 · TypeScript · Node.js |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase JWT |
| Real-time | Supabase Realtime (channels) |
| AI | Google Gemini (embeddings + coaching) |
| Payments | Stripe Checkout |
| Video | WebRTC (Google STUN) |
| Deploy | Vercel (frontend) · Railway (backend) |
