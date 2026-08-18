# Feature Brief: Personal Gallery

**Project:** Musee — AI Museum Guide Chatbot  
**Feature:** Personal Gallery  
**Type:** Full-stack feature (Backend + Frontend)  
**Difficulty:** Intermediate  
**Estimated build time:** 3–5 hours

---

## Overview

Personal Gallery allows users to save artworks they've explored during their chat sessions into a persistent, personal collection stored in MongoDB. Users can revisit saved artworks, view their past conversations for each piece, see which art movements they gravitate toward, and receive a taste profile that reflects their interests over time.

This transforms Muse from a one-time lookup tool into a long-term personal art companion.

---

## User Stories

- As a user, I want to save an artwork I explored so I can revisit it later.
- As a user, I want to see all the artworks I've saved in a clean gallery view.
- As a user, I want to remove an artwork from my gallery if I no longer want it saved.
- As a user, I want to see which art movements and periods I explore most.
- As a user, I want to re-read the conversation I had about a saved artwork.

---

## Feature Scope

### In scope
- Save artwork to gallery (button in chat UI after artwork is identified)
- View all saved artworks in a gallery grid layout
- Remove artwork from gallery
- View linked conversation history per saved artwork
- Taste profile: breakdown of saved artworks by movement (e.g. 40% Impressionism, 30% Baroque)
- Persist gallery data in MongoDB per `userId` (use a generated UUID stored in localStorage for now — no full auth required)

### Out of scope (future)
- Full user authentication (JWT / login system)
- Sharing gallery with others
- Export gallery as PDF

---

## Data Model

### New collection: `galleries`

```js
const savedArtworkSchema = new Schema({
  artworkId:   { type: Schema.Types.ObjectId, ref: 'Artwork', required: true },
  sessionId:   { type: String, required: true },
  savedAt:     { type: Date, default: Date.now },
  personalNote: { type: String, default: '' }   // optional user note
})

const gallerySchema = new Schema({
  userId:         { type: String, required: true, unique: true, index: true },
  savedArtworks:  [savedArtworkSchema]
}, { timestamps: true })
```

`userId` is a UUID generated on first visit and stored in the browser's `localStorage`. No login required for this phase.

---

## API Endpoints

### `POST /api/gallery/save`
Save an artwork to the user's gallery.

**Headers:** `x-api-key`, `x-user-id`

**Request body:**
```json
{
  "artworkId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "sessionId": "abc-123"
}
```

**Response:**
```json
{ "message": "Artwork saved to gallery", "galleryId": "..." }
```

---

### `GET /api/gallery`
Retrieve the user's full gallery with populated artwork details.

**Headers:** `x-api-key`, `x-user-id`

**Response:**
```json
{
  "userId": "uuid-here",
  "savedArtworks": [
    {
      "artworkId": {
        "_id": "...",
        "title": "The Starry Night",
        "artist": "Vincent van Gogh",
        "year": 1889,
        "movement": "Post-Impressionism",
        "museum": "MoMA, New York"
      },
      "sessionId": "abc-123",
      "savedAt": "2025-01-15T10:30:00Z",
      "personalNote": ""
    }
  ],
  "tasteProfile": {
    "Post-Impressionism": 3,
    "Baroque": 2,
    "Surrealism": 1
  }
}
```

---

### `DELETE /api/gallery/:artworkId`
Remove an artwork from the gallery.

**Headers:** `x-api-key`, `x-user-id`

**Response:**
```json
{ "message": "Artwork removed from gallery" }
```

---

### `PATCH /api/gallery/:artworkId/note`
Add or update a personal note on a saved artwork.

**Request body:**
```json
{ "note": "Reminds me of my trip to Amsterdam" }
```

---

## Frontend Components

### 1. Save Button (in chat UI)
After an artwork is identified, a "Save to Gallery" button appears below the first assistant message. On click, it calls `POST /api/gallery/save` and toggles to a "Saved ✓" state.

### 2. Gallery Page (`/gallery`)
A grid layout showing all saved artworks as cards. Each card shows:
- Artwork title + artist
- Year and movement badge
- "Saved on" date
- Personal note (editable inline)
- "View Conversation" button → reopens the chat session
- Remove button (trash icon)

### 3. Taste Profile Panel
A sidebar or section at the top of the gallery page showing a breakdown of saved artworks by movement — rendered as a simple horizontal bar chart or pill-based percentage breakdown. Example:

```
Post-Impressionism  ████████░░  40%
Baroque             ██████░░░░  30%
Surrealism          ████░░░░░░  20%
Romanticism         ██░░░░░░░░  10%
```

---

## Middleware

Add a `userId` extraction middleware that reads from the `x-user-id` header:

```js
const extractUserId = (req, res, next) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(400).json({ error: 'x-user-id header required' })
  req.userId = userId
  next()
}
```

On the frontend, generate and persist the UUID on first load:
```js
const getUserId = () => {
  let id = localStorage.getItem('muse_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('muse_user_id', id) }
  return id
}
```

---

## File Changes

```
museum-guide-chatbot/
├── models/
│   └── Gallery.js              ← NEW
├── routes/
│   └── gallery.js              ← NEW
├── middleware/
│   └── extractUserId.js        ← NEW
├── server.js                   ← register /api/gallery route
└── public/
    ├── index.html              ← add Save button + userId logic
    └── gallery.html            ← NEW gallery page
```

---

## Acceptance Criteria

- [ ] User can save an artwork from the chat interface
- [ ] Save button changes state to "Saved ✓" and does not allow duplicates
- [ ] Gallery page displays all saved artworks in a responsive grid
- [ ] Each artwork card shows title, artist, movement, year, and saved date
- [ ] User can remove an artwork from the gallery
- [ ] User can add/edit a personal note per artwork
- [ ] Taste profile correctly counts saved artworks by movement
- [ ] `userId` is generated on first visit and persists across sessions via localStorage
- [ ] All endpoints are protected by `x-api-key` middleware
