# 🖼️ Museum Guide Chatbot

> An AI-powered conversational museum guide that identifies artworks from images and delivers rich, curator-quality insights using Claude Vision, MongoDB, and a RAG (Retrieval Augmented Generation) pipeline.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Core AI Flow (RAG Pipeline)](#core-ai-flow-rag-pipeline)
- [Build Phases](#build-phases)
  - [Phase 1 — Project Setup](#phase-1--project-setup)
  - [Phase 2 — MongoDB Schema Design](#phase-2--mongodb-schema-design)
  - [Phase 3 — AI Flow & RAG Pipeline](#phase-3--ai-flow--rag-pipeline)
  - [Phase 4 — API Key Auth Middleware](#phase-4--api-key-auth-middleware)
  - [Phase 5 — Seed the Artwork Database](#phase-5--seed-the-artwork-database)
  - [Phase 6 — Frontend](#phase-6--frontend)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Sample Artworks to Seed](#sample-artworks-to-seed)
- [Future Improvements](#future-improvements)

---

## Overview

The **Museum Guide Chatbot** lets users upload a photo of any painting or artwork and instantly receive a rich, conversational guide experience. The bot identifies the piece using Claude's Vision API, retrieves curated metadata from MongoDB, and injects that context into an ongoing conversation — allowing users to ask natural follow-up questions like:

- *"Why did he use so much blue?"*
- *"What was happening in Europe when this was painted?"*
- *"What technique is this? Why does it look so dreamlike?"*

It combines **vision AI**, **RAG**, **session-based chat history**, and **database-driven content** into a single cohesive system — making it a genuinely strong portfolio project for any data or AI engineer.

---

## Features

- **Artwork identification** via Claude Vision API (multimodal)
- **RAG pipeline** — injects curated MongoDB data into the Claude system prompt
- **Persistent chat sessions** — users can ask follow-up questions across turns
- **API key authentication** — secure access to all endpoints
- **Extensible artwork database** — seed with as many artworks as you want
- **Conversational tone** — responses feel like a knowledgeable human guide, not a textbook

---

## Architecture

```
User (image + message)
        │
        ▼
  Express API (POST /ask)
   ├── API Key Auth Middleware
   ├── Multer (image upload handler)
   │
   ├──► MongoDB: sessions collection (read/write chat history)
   ├──► MongoDB: artworks collection (lookup curator notes)
   │
   └──► Claude Vision API
           ├── Turn 1: Identify the artwork
           ├── Inject curator context from MongoDB (RAG)
           └── Turn N: Continue conversation with full history
                   │
                   ▼
            JSON response → User
```

**Data flow summary:**

1. User uploads an image and optionally a message.
2. API authenticates the request via API key.
3. On the first turn, Claude Vision identifies the artwork (title, artist, year, movement).
4. The API queries MongoDB for matching curator notes and fun facts.
5. Those notes are injected into Claude's system prompt (RAG).
6. Claude responds as a museum guide using both its own knowledge and the curated data.
7. The conversation is saved to the `sessions` collection for multi-turn follow-ups.

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Runtime     | Node.js                             |
| Framework   | Express.js                          |
| AI Model    | Claude API (Sonnet) — Vision + Chat |
| Database    | MongoDB + Mongoose                  |
| File Upload | Multer                              |
| Auth        | Custom API key middleware           |
| Frontend    | HTML + CSS + Vanilla JS (or React)  |
| HTTP Client | Axios                               |
| Config      | dotenv                              |

---

## Project Structure

```
museum-guide-chatbot/
├── src/
│   ├── config/
│   │   └── db.js                  # MongoDB connection
│   ├── middleware/
│   │   └── apiKeyAuth.js          # API key auth
│   ├── models/
│   │   ├── Artwork.js             # Artwork schema
│   │   └── Session.js             # Chat session schema
│   ├── routes/
│   │   └── guide.js               # POST /ask route
│   ├── services/
│   │   └── claudeService.js       # Claude API calls
│   └── app.js                     # Express app setup
├── scripts/
│   └── seedArtworks.js            # Seed script for MongoDB
├── public/
│   └── index.html                 # Minimal frontend UI
├── .env                           # Environment variables (not committed)
├── .gitignore
├── package.json
└── README.md
```

---

## Database Schema

### `artworks` collection

Stores curated metadata for known artworks. This is the knowledge base that powers the RAG pipeline.

```js
// src/models/Artwork.js
import mongoose from 'mongoose'

const artworkSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  artist:        { type: String, required: true },
  year:          { type: Number },
  movement:      { type: String },       // e.g. "Post-Impressionism"
  museum:        { type: String },       // e.g. "Museum of Modern Art, New York"
  medium:        { type: String },       // e.g. "Oil on canvas"
  dimensions:    { type: String },       // e.g. "73.7 cm × 92.1 cm"
  curatorNotes:  { type: String },       // Rich text: symbolism, technique, historical context
  funFacts:      [{ type: String }],
  tags:          [{ type: String }],     // e.g. ["portrait", "oil", "french"]
}, { timestamps: true })

export default mongoose.model('Artwork', artworkSchema)
```

### `sessions` collection

Stores conversation history per session so users can ask multi-turn follow-up questions.

```js
// src/models/Session.js
import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  role:    { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
})

const sessionSchema = new mongoose.Schema({
  sessionId:  { type: String, required: true, unique: true },
  artworkId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Artwork' },
  artworkRaw: { type: Object },   // Stores Claude's raw identification (title, artist, etc.)
  messages:   [messageSchema],
}, { timestamps: true })

export default mongoose.model('Session', sessionSchema)
```

---

## API Reference

### `POST /api/ask`

The main endpoint. Handles image uploads and conversational turns.

**Headers:**

| Header        | Value                   |
|---------------|-------------------------|
| x-api-key     | `your-secret-key`       |
| Content-Type  | `multipart/form-data`   |

**Body (form-data):**

| Field      | Type   | Required | Description                                  |
|------------|--------|----------|----------------------------------------------|
| image      | File   | Yes*     | The artwork image (JPEG/PNG)                 |
| sessionId  | String | Yes      | Unique session ID (UUID recommended)         |
| message    | String | No       | Follow-up question from the user             |

*Image is required on the first turn. Subsequent turns can omit it if `sessionId` matches an existing session.

**Response:**

```json
{
  "reply": "This is Vincent van Gogh's The Starry Night, painted in June 1889...",
  "artwork": {
    "title": "The Starry Night",
    "artist": "Vincent van Gogh",
    "year": 1889,
    "movement": "Post-Impressionism"
  },
  "sessionId": "abc-123"
}
```

---

## Core AI Flow (RAG Pipeline)

This is the heart of the project. Here's how `src/routes/guide.js` works:

```js
// src/routes/guide.js
import express from 'express'
import multer from 'multer'
import { callClaudeVision, callClaudeChat } from '../services/claudeService.js'
import Artwork from '../models/Artwork.js'
import Session from '../models/Session.js'
import apiKeyAuth from '../middleware/apiKeyAuth.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/ask', apiKeyAuth, upload.single('image'), async (req, res) => {
  try {
    const { sessionId, message } = req.body

    // --- Step 1: Load or create session ---
    let session = await Session.findOne({ sessionId })

    if (!session && !req.file) {
      return res.status(400).json({ error: 'Image required for the first turn.' })
    }

    // --- Step 2: First turn — identify artwork via Claude Vision ---
    let artworkRaw = session?.artworkRaw
    if (!session) {
      const imageBase64 = req.file.buffer.toString('base64')
      const mimeType = req.file.mimetype

      artworkRaw = await callClaudeVision(imageBase64, mimeType, `
        Identify this artwork. Respond in JSON only with these fields:
        { "title": "", "artist": "", "year": 0, "movement": "" }
      `)
    }

    // --- Step 3: Look up artwork in MongoDB ---
    let artwork = null
    if (artworkRaw?.title) {
      artwork = await Artwork.findOne({
        title: { $regex: artworkRaw.title, $options: 'i' }
      })
    }

    // --- Step 4: Create session if first turn ---
    if (!session) {
      session = await Session.create({
        sessionId,
        artworkId: artwork?._id || null,
        artworkRaw,
        messages: []
      })
    }

    // --- Step 5: Build system prompt with RAG context ---
    const curatorContext = artwork
      ? `
        Curator notes: ${artwork.curatorNotes}
        Fun facts: ${artwork.funFacts.join(' | ')}
        Museum: ${artwork.museum}
        Medium: ${artwork.medium}
      `
      : ''

    const systemPrompt = `
      You are an expert museum guide with deep knowledge of art history, technique, and symbolism.
      You are currently guiding a visitor through the following artwork:
      Title: ${artworkRaw?.title || 'Unknown'}
      Artist: ${artworkRaw?.artist || 'Unknown'}
      Year: ${artworkRaw?.year || 'Unknown'}
      Movement: ${artworkRaw?.movement || 'Unknown'}
      ${curatorContext}
      Be conversational, engaging, and accessible. Use storytelling where appropriate.
      Keep responses under 200 words unless the user asks for more detail.
    `

    // --- Step 6: Append user message and call Claude ---
    const userMessage = message || 'Tell me about this artwork.'
    session.messages.push({ role: 'user', content: userMessage })

    const reply = await callClaudeChat(systemPrompt, session.messages)

    session.messages.push({ role: 'assistant', content: reply })
    await session.save()

    res.json({ reply, artwork: artworkRaw, sessionId })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

export default router
```

### Claude service

```js
// src/services/claudeService.js
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function callClaudeVision(imageBase64, mimeType, prompt) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
        { type: 'text', text: prompt }
      ]
    }]
  })
  const raw = response.content[0].text.replace(/```json|```/g, '').trim()
  return JSON.parse(raw)
}

export async function callClaudeChat(systemPrompt, messages) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content }))
  })
  return response.content[0].text
}
```

---

## Build Phases

### Phase 1 — Project Setup

```bash
mkdir museum-guide-chatbot && cd museum-guide-chatbot
npm init -y
npm install express mongoose dotenv multer @anthropic-ai/sdk axios uuid
```

Create `.gitignore`:
```
node_modules/
.env
uploads/
```

Create `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
MONGODB_URI=mongodb://localhost:27017/museum-guide
PORT=3000
API_KEY=your-secret-api-key
```

---

### Phase 2 — MongoDB Schema Design

Create your `Artwork` and `Session` models as shown in the [Database Schema](#database-schema) section above.

Connect to MongoDB:

```js
// src/config/db.js
import mongoose from 'mongoose'

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('MongoDB connected')
}

export default connectDB
```

---

### Phase 3 — AI Flow & RAG Pipeline

Implement `src/routes/guide.js` and `src/services/claudeService.js` as shown in the [Core AI Flow](#core-ai-flow-rag-pipeline) section.

---

### Phase 4 — API Key Auth Middleware

```js
// src/middleware/apiKeyAuth.js
const apiKeyAuth = (req, res, next) => {
  const key = req.headers['x-api-key']
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing API key.' })
  }
  next()
}

export default apiKeyAuth
```

---

### Phase 5 — Seed the Artwork Database

```js
// scripts/seedArtworks.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Artwork from '../src/models/Artwork.js'

dotenv.config()
await mongoose.connect(process.env.MONGODB_URI)

const artworks = [
  {
    title: 'The Starry Night',
    artist: 'Vincent van Gogh',
    year: 1889,
    movement: 'Post-Impressionism',
    museum: 'Museum of Modern Art, New York',
    medium: 'Oil on canvas',
    dimensions: '73.7 cm × 92.1 cm',
    curatorNotes: `Painted in June 1889 during Van Gogh's voluntary stay at the Saint-Paul-de-Mausole asylum in Saint-Rémy-de-Provence. The swirling sky is not purely imaginary — it reflects his turbulent mental state while also capturing actual astronomical phenomena. The cypress tree in the foreground was a symbol of mourning in European culture, yet here it reaches dramatically toward the heavens. The village below is calm and quiet, a sharp contrast to the electric, churning sky above.`,
    funFacts: [
      "Van Gogh wrote about the painting in a letter to his brother Theo, describing the night sky as full of 'terrible passions'.",
      'The church steeple resembles Dutch architecture, not the French village he was actually viewing.',
      'It was largely unknown during his lifetime and only became iconic decades after his death.'
    ],
    tags: ['landscape', 'night', 'sky', 'impressionism', 'dutch', 'oil']
  },
  {
    title: 'Girl with a Pearl Earring',
    artist: 'Johannes Vermeer',
    year: 1665,
    movement: 'Dutch Golden Age',
    museum: 'Mauritshuis, The Hague',
    medium: 'Oil on canvas',
    dimensions: '44.5 cm × 39 cm',
    curatorNotes: `Often called the "Mona Lisa of the North", this is technically not a portrait but a "tronie" — a Dutch term for a character study of an anonymous figure. The subject is unknown. The iconic pearl earring has been studied extensively: some experts believe it may actually be glass or tin, not a real pearl. Vermeer's mastery of light is on full display — the soft illumination against the dark background creates a sense of intimacy and mystery.`,
    funFacts: [
      "The girl's identity has never been confirmed — she is not a commissioned portrait subject.",
      'The pearl may not be a pearl at all — analysis suggests it could be glass.',
      'The painting inspired a bestselling novel by Tracy Chevalier in 1999, later adapted into a film.'
    ],
    tags: ['portrait', 'dutch', 'golden age', 'figure', 'oil', 'vermeer']
  }
]

await Artwork.insertMany(artworks)
console.log('Artworks seeded successfully.')
await mongoose.disconnect()
```

Run with:
```bash
node scripts/seedArtworks.js
```

---

### Phase 6 — Frontend

A minimal single-page UI in `public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Museum Guide</title>
  <style>
    body { font-family: sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; }
    h1 { font-size: 20px; margin-bottom: 24px; }
    #chat { border: 1px solid #ddd; border-radius: 8px; padding: 16px; min-height: 200px; margin-bottom: 16px; }
    .msg-user { text-align: right; color: #333; margin: 8px 0; }
    .msg-bot  { text-align: left;  color: #0a6e56; margin: 8px 0; }
    input[type=text] { width: 75%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; }
    button { padding: 8px 16px; background: #1d1d1d; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>🖼️ Museum Guide</h1>
  <input type="file" id="imageInput" accept="image/*" /><br><br>
  <div id="chat"></div>
  <input type="text" id="msgInput" placeholder="Ask about this artwork..." />
  <button onclick="sendMessage()">Send</button>

  <script>
    const sessionId = crypto.randomUUID()
    const chat = document.getElementById('chat')
    let firstTurn = true

    async function sendMessage() {
      const message = document.getElementById('msgInput').value
      const imageFile = document.getElementById('imageInput').files[0]

      if (firstTurn && !imageFile) { alert('Please upload an image first.'); return }

      appendMsg('user', message || 'Tell me about this artwork.')
      document.getElementById('msgInput').value = ''

      const formData = new FormData()
      formData.append('sessionId', sessionId)
      formData.append('message', message)
      if (firstTurn && imageFile) formData.append('image', imageFile)

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'x-api-key': 'your-secret-api-key' },
        body: formData
      })
      const data = await res.json()
      appendMsg('bot', data.reply)
      firstTurn = false
    }

    function appendMsg(role, text) {
      const p = document.createElement('p')
      p.className = role === 'user' ? 'msg-user' : 'msg-bot'
      p.textContent = text
      chat.appendChild(p)
    }
  </script>
</body>
</html>
```

---

## Environment Variables

| Variable            | Description                        |
|---------------------|------------------------------------|
| `ANTHROPIC_API_KEY` | Your Claude API key                |
| `MONGODB_URI`       | MongoDB connection string          |
| `PORT`              | Server port (default: 3000)        |
| `API_KEY`           | Secret key for your API endpoints  |

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/your-username/museum-guide-chatbot.git
cd museum-guide-chatbot

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in your keys

# 4. Seed the artwork database
node scripts/seedArtworks.js

# 5. Start the server
node src/app.js

# 6. Open the frontend
# Visit http://localhost:3000 in your browser
```

---

## Sample Artworks to Seed

Start with these well-known pieces for a strong demo:

| Title | Artist | Year |
|---|---|---|
| The Starry Night | Vincent van Gogh | 1889 |
| Girl with a Pearl Earring | Johannes Vermeer | 1665 |
| The Persistence of Memory | Salvador Dalí | 1931 |
| The Birth of Venus | Sandro Botticelli | 1484–1486 |
| Las Meninas | Diego Velázquez | 1656 |
| A Sunday on La Grande Jatte | Georges Seurat | 1886 |
| The Great Wave off Kanagawa | Katsushika Hokusai | 1831 |
| Water Lilies | Claude Monet | 1906 |
| The Creation of Adam | Michelangelo | 1512 |
| American Gothic | Grant Wood | 1930 |

---

## Future Improvements

- **Vector search** — Use MongoDB Atlas Vector Search + embeddings to find the closest matching artwork even when the title isn't an exact match.
- **Audio mode** — Add text-to-speech so the guide can literally speak to the user.
- **Multilingual support** — Detect the user's language and respond accordingly.
- **QR code scanning** — Let users scan QR codes in real museums to load the guide for that specific piece.
- **Admin panel** — A simple dashboard for adding and editing artwork entries without touching the database directly.
- **Rate limiting** — Add per-session request throttling to prevent API abuse.
- **Image caching** — Hash uploaded images and cache identification results to avoid redundant Vision API calls.

---

*Built with Claude Vision API, MongoDB, and Node.js/Express.*
