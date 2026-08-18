# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Musée** is an AI-powered museum guide — a Node.js/Express backend that accepts artwork images, identifies them via OpenAI GPT-4o vision, retrieves curator context from MongoDB, and conducts multi-turn conversational sessions. Features include personal galleries, AI-generated quizzes, text-to-speech, and geolocation-based museum discovery.

The application lives entirely in `museum-guide-chatbot/`. The root directory contains only documentation and branding assets.

## Commands

All commands run from `museum-guide-chatbot/`:

```bash
npm start                  # Start the Express server (node src/app.js)
npm run seed               # Seed artwork data
npm run seed:museums       # Seed museum collection with geolocation data
npm run seed:embeddings    # Generate vector embeddings for RAG
```

**Docker (local MongoDB):**
```bash
docker compose up -d       # Start app + MongoDB 7 containers
docker compose down        # Stop containers
```

No test runner is configured — there are no test files in this project.

## Environment Setup

Copy `.env.example` to `.env` and populate:

- `MONGODB_URI` — MongoDB Atlas connection string (or `mongodb://mongo:27017/musee` for Docker)
- `OPENAI_API_KEY` — Required for vision, chat, quiz generation, and TTS
- `JWT_SECRET` — Must be 32+ characters (app fails to start otherwise)
- `JWT_EXPIRES_IN` — Token lifetime (default `7d`)
- `CORS_ORIGIN` — Frontend origin (omit to allow all)
- `PORT` — Server port (default `3000`)

**MongoDB Atlas vector search index** must be created manually — see `ATLAS_SETUP.md` for the index definition on the `artworks` collection.

## Architecture

### Request Flow

1. Client POSTs image to `POST /api/ask` (authenticated)
2. Multer buffers the image in memory (10MB limit)
3. `callClaudeVision()` sends base64 image to GPT-4o → returns `{title, artist, year, movement}`
4. MongoDB `findOneAndUpdate` upserts the artwork record
5. RAG context (curatorNotes, funFacts, museum, medium) is injected into the system prompt
6. `callClaudeChat()` sends the full message history to GPT-4o → returns reply
7. Conversation is persisted to `Session.messages[]` in MongoDB

### Key Source Files

| File | Role |
|------|------|
| `src/app.js` | Express setup, middleware stack, rate limiting, route mounting |
| `src/services/claudeService.js` | All OpenAI calls: vision ID, chat, quiz generation |
| `src/routes/guide.js` | Main vision + RAG chat pipeline |
| `src/routes/quiz.js` | Quiz lifecycle: generate → answer → complete |
| `src/routes/auth.js` | Registration/login with JWT issuance |
| `src/routes/nearby.js` | `$near` geospatial query on Museum collection |
| `src/middleware/authGuard.js` | JWT verification; attaches `req.user` |

### Data Models

- **Session** — one per user+artwork pair; holds full `messages[]` history and `quizzes[]` refs
- **Artwork** — master record with `curatorNotes`, `funFacts[]`, `tags[]`, and `embedding[]` for RAG
- **Museum** — GeoJSON `coordinates` field with a 2dsphere index for geolocation queries
- **Gallery** — user's saved artworks with personal notes and AI-generated summaries

### Naming Confusion

`src/services/claudeService.js` uses **OpenAI GPT-4o**, not Anthropic Claude. The file name is historical. All AI calls go through `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`.

## Rate Limiting

Configured in `app.js` with in-memory stores (not suitable for multi-instance deployments):

- Auth routes: 20 requests / 15 minutes
- AI routes (`/api/ask`, `/api/speak`): 10 requests / 60 seconds
- Gallery, quiz, card routes: 10 requests / 60 seconds

## ES Modules

The project uses `"type": "module"` in `package.json`. All imports use ESM syntax (`import`/`export`). There is no build step or TypeScript compilation.

## Static Files & Uploads

- `public/` is served statically at `/`
- `public/index.html` — main chat UI (dark theme, Playfair Display + Inter)
- `public/gallery.html` — gallery UI
- Uploaded artwork images are written to `public/uploads/{timestamp}-{random}.{ext}` — this is local disk, not object storage
