# ⚖️ Praxis

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-blueviolet.svg)](https://supabase.com/)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini-orange.svg)](https://deepmind.google/technologies/gemini/)

**Praxis** is a next-generation accountability partnership platform. It moves beyond simple "habit trackers" by using AI-driven semantic alignment to match you with the perfect partner, ensuring your goals are not just tracked, but achieved through mutual commitment and skin-in-the-game.

---

## ✨ Key Features

- **🌲 Goal Trees:** Define high-level objectives and break them down into actionable sub-goals.
- **🤖 AI Semantic Matching:** Uses Google Gemini embeddings to find partners with overlapping goals and values.
- **💰 Accountability Bets:** Put skin in the game by creating stakes for your commitments.
- **📊 Rich Analytics:** Detailed progress tracking and performance metrics for individuals and partnerships.
- **📱 Multi-Platform:** Web-first with Electron and Mobile (Android/Jetpack Compose) support in the pipeline.
- **🛡️ Private & Secure:** Built on Supabase with robust row-level security and encrypted messaging.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18 (TypeScript)
- **Styling:** Material UI (MUI) v6
- **Build Tool:** Vite / Create React App
- **State/Auth:** Supabase Client

### Backend
- **Runtime:** Node.js (TypeScript)
- **Framework:** Express 5
- **AI/LLM:** Google Gemini (`embedding-001`, `gemini-pro`)
- **Payments:** Stripe API
- **Scheduling:** Node-cron for automated check-ins

### Infrastructure
- **Database:** PostgreSQL (via Supabase) + `pgvector` for semantic search
- **Deployment:** Vercel (Frontend), Railway (Backend)
- **CI/CD:** GitHub Actions

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- A Supabase Project
- Google Gemini API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/praxis_webapp.git
   cd praxis_webapp
   ```

2. **Setup Backend**
   ```bash
   npm install
   cp .env.example .env
   # Fill in your variables in .env
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd client
   npm install
   cp .env.example .env
   # Fill in your variables in .env
   npm start
   ```

---

## 📖 Documentation

Detailed documentation is available in the `docs/` directory:

- [Architecture Overview](./docs/wiki/Architecture.md)
- [API Reference](./docs/wiki/API-Reference.md)
- [Database Schema](./docs/wiki/Database-Schema.md)
- [Deployment Guide](./docs/wiki/Deployment.md)
- [Product Strategy](./docs/PRODUCT_STRATEGY.md)

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) for more information.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <i>Aligning Will. Designing Intent. Building Praxis.</i>
</p>
