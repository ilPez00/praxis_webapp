# Praxis — Master .env Service Integration Plan

**Goal**: Integrate ALL services from `/home/gio/.env` into Axiom.

**Priority**: Execute phases in order 1→11.

**Tracking**: Every step logged to `claude_steps.txt`.

---

## Phase 1 — Env Alignment

Sync `praxis_webapp/.env` var names with master `/home/gio/.env`.

- Code reads `GEMINI_API_KEY` → master has `AI_GEMINI_KEY`
- Code reads `DEEPSEEK_API_KEY` → master has `AI_DEEPSEEK_KEY`
- Code reads `GROQ_API_KEY` → master has `AI_GROQ_KEY`
- Code reads `BRAVE_API_KEY` → master has `SEARCH_BRAVE_KEY`
- Add all missing provider keys + endpoints to project `.env`
- Create an env loader mapping master names to code expectations

## Phase 2 — Multi-LLM Provider Layer

Rewrite `AICoachingService` to support ALL OpenAI-compatible providers:

- Groq, DeepSeek, OpenRouter, Mistral, Cerebras, Cohere, SambaNova, xAI, Together, DeepInfra, NVIDIA, Zhipu, BazaarLink, Kluster
- Keyless proxies: LLM7, APIFree, OVHCloud, GPTOSS
- G4F proxies: hosted, groq, ollama, pollinations, nvidia, gemini, auto
- Ollama public endpoints
- Provider registry → priority-ordered fallback → unified usage tracking

## Phase 3 — Enhanced Search

Add Tavily, Serper, SerpAPI, Jina to `axiomAgentController.searchWeb()`. Keep existing Brave + DuckDuckGo.

Priority: Tavily → Brave → Serper → SerpAPI → Jina → DuckDuckGo

## Phase 4 — STT Service (new `AxiomSTTService`)

Deepgram + AssemblyAI for voice note transcription in Axiom.

## Phase 5 — TTS Service (new `AxiomTTSService`)

ElevenLabs + Kokoro for Axiom spoken responses.

## Phase 6 — Image Generation (new `AxiomImageGenService`)

Pollinations (free), Pixazo, Wavespeed.

## Phase 7 — Translation + Emotion + OCR

- `AxiomTranslationService`: DeepL → LibreTranslate → MyMemory
- Wire Hume AI into `AxiomPersonaService`
- Add Mistral OCR to `AxiomMultimodalService`

## Phase 8 — Vector Stores & Memory

- `AxiomRetrievalService`: Qdrant, Chroma, Pinecone
- `AxiomMemoryService`: Mem0, Zep

## Phase 9 — 3D + Voice Pipelines + Telegram

- `Axiom3DGenService`: Tripo3D, Meshy
- LiveKit + Daily for realtime voice
- Telegram notifications

## Phase 10 — Admin Panel Updates

Provider management UI in `AxiomTab.tsx`. New admin endpoints for provider config.

## Phase 11 — DB Migrations & Docs

Update `api_key_usage` table. New `axiom_provider_config` + `axiom_provider_health` tables. Update `manual_actions.txt` + `docs/DEV_PLAN.md`.
