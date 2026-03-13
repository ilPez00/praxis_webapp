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

## 🛠️ Developer Guide

This guide is designed to help you contribute to Praxis without breaking existing systems. We follow a "Research -> Strategy -> Execution" workflow.

### 1. Environment & Setup

#### Prerequisites
- **Supabase**: Create a project and run `migrations/setup.sql` in the SQL Editor.
- **Gemini API**: Get a key from [Google AI Studio](https://aistudio.google.com).
- **Stripe**: (Optional) For testing payments, get your test keys.

#### Local Config
Create two `.env` files:
1.  **Root (`.env`)**: For the Node.js backend.
    ```env
    SUPABASE_URL=...
    SUPABASE_SERVICE_ROLE_KEY=... # Use SERVICE_ROLE, not anon
    GEMINI_API_KEY=...
    STRIPE_SECRET_KEY=...
    PORT=3001
    ```
2.  **Client (`client/.env`)**: For the React frontend.
    ```env
    REACT_APP_SUPABASE_URL=...
    REACT_APP_SUPABASE_ANON_KEY=...
    REACT_APP_API_URL=http://localhost:3001/api
    ```

### 2. Running the App

- **Backend**: `npm run dev` (starts on port 3001 with hot-reload).
- **Frontend**: `npm start --prefix client` (starts on port 3000).
- **Scripts**: We provide `run-praxis.sh` to boot everything at once (ensure it's local only).

### 3. Tooling Workflow

#### 🤖 Gemini CLI (AI-Assisted Dev)
We use the Gemini CLI agent for architectural changes and complex refactors. 
- **Coding**: Ask it to implement a feature across layers (Controller -> Route -> Frontend).
- **Debugging**: Pipe logs or error messages to the CLI for root-cause analysis.
- **Safety**: The CLI is configured to respect `.gitignore` and never commit secrets.

#### 📝 Google NotebookLM (`nlm`)
Use NotebookLM for deep research on features or to keep the AI "brain" updated with the latest codebase state.
- **Syncing**: `nlm source add file README.md`
- **Research**: `nlm research start "best practices for pwa push notifications 2026"`
- **Context**: Invite collaborators to the notebook using `nlm share invite`.

#### ☁️ Cloud Infrastructure
- **Vercel**: Hosts the frontend. Pushing to `main` triggers a production build. Use `vercel env pull` to sync cloud vars.
- **Railway**: Hosts the backend. It auto-deploys on `main` branch updates.
- **Supabase**: Handles Auth, DB, and Storage. Always update `migrations/setup.sql` if you change the schema.

### 4. How to Contribute

#### Adding a Feature
1.  **DB**: Update the schema in Supabase and add the SQL to `migrations/`.
2.  **Backend**: Create a controller in `src/controllers/` and register the route in `src/routes/`.
3.  **Frontend**: Add the logic in `client/src/features/` and UI in `client/src/pages/` or `components/`.
4.  **Types**: Ensure models in `src/models/` and `client/src/models/` are synchronized.

#### Debugging
- **Logs**: Backend logs appear in the terminal. Frontend logs in the Browser Console.
- **Mobile**: We use **Eruda** for on-device debugging. It is accessible to users with the `admin` role in the profile settings.

#### Removing Features
- Always check `src/app.ts` to remove route registrations.
- Clean up unused types in `src/types/` to keep the build lean.

---

<p align="center">
  <i>Aligning Will. Designing Intent. Building Praxis.</i>
</p>
