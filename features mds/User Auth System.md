# Feature Brief — User Auth System
### Project: Muse — AI Museum Guide Chatbot

---

## Overview

Add a complete user authentication system to Muse so that personal data — saved artworks, quiz scores, and chat history — is tied to a real user account rather than a temporary session ID. Users can sign up, log in, and pick up exactly where they left off across devices and sessions.

---

## Problem it solves

Currently, Muse uses a random `sessionId` (UUID) to track conversations. The moment the user closes the browser, that session is gone — their saved artworks, quiz scores, and conversation history disappear with it. This makes the app feel like a tool rather than a personal experience. A proper auth system transforms Muse from a demo into a real product.

---

## Goals

- Users can create an account with name, email, and password
- Users can log in and receive a JWT access token
- Protected routes verify the token before allowing access
- All personal data (gallery, sessions, quiz scores) is linked to the user's `_id`
- Passwords are never stored in plain text
- Tokens expire and can be refreshed securely

---

## Out of scope (for this version)

- OAuth / social login (Google, GitHub)
- Email verification
- Password reset via email
- Role-based access control (admin vs user)

---

## Tech stack for this feature

| Tool | Purpose |
|---|---|
| `bcryptjs` | Hash and compare passwords securely |
| `jsonwebtoken` | Sign and verify JWT tokens |
| `express-validator` | Validate and sanitize input fields |
| MongoDB + Mongoose | Store user records |
| HTTP-only cookies or Authorization header | Deliver the token to the client |

Install:
```bash
npm install bcryptjs jsonwebtoken express-validator
```

---

## Database schema

### User model

```js
// models/User.js
const userSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 60
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  savedArtworks: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Artwork'
    }
  ],
  quizScores: [
    {
      artworkId: { type: Schema.Types.ObjectId, ref: 'Artwork' },
      score: Number,
      total: Number,
      date: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true })
```

### Changes to Session model

Replace `sessionId` (UUID string) with a reference to the authenticated user:

```js
userId: {
  type: Schema.Types.ObjectId,
  ref: 'User',
  required: true
}
```

---

## API endpoints

### POST `/api/auth/register`

Create a new user account.

**Request body:**
```json
{
  "name": "Shahood",
  "email": "shahood@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "message": "Account created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "664abc...",
    "name": "Shahood",
    "email": "shahood@example.com"
  }
}
```

---

### POST `/api/auth/login`

Authenticate an existing user.

**Request body:**
```json
{
  "email": "shahood@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "664abc...",
    "name": "Shahood",
    "email": "shahood@example.com"
  }
}
```

---

### GET `/api/auth/me`

Return the currently authenticated user's profile. Protected route.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "664abc...",
  "name": "Shahood",
  "email": "shahood@example.com",
  "savedArtworks": [...],
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### POST `/api/auth/logout`

Client-side only — instruct the client to discard the token. No server state to clear for JWT.

---

## Auth middleware

All protected routes use this middleware to verify the token before processing the request:

```js
// middleware/authGuard.js
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const authGuard = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id).select('-password')
    if (!req.user) return res.status(401).json({ error: 'User not found' })
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = authGuard
```

Usage on any protected route:
```js
const authGuard = require('../middleware/authGuard')
router.get('/api/auth/me', authGuard, getMe)
router.post('/api/ask', apiKeyAuth, authGuard, upload.single('image'), askGuide)
```

---

## Auth flow (step by step)

```
User fills signup form
        │
        ▼
POST /api/auth/register
  1. Validate input (express-validator)
  2. Check email not already taken
  3. Hash password with bcrypt (salt rounds: 12)
  4. Save new User to MongoDB
  5. Sign JWT with user._id + JWT_SECRET (expires: 7d)
  6. Return token + user object
        │
        ▼
Client stores token (localStorage or memory)
        │
        ▼
Every subsequent request:
  Authorization: Bearer <token>
        │
        ▼
authGuard middleware
  1. Extract token from header
  2. jwt.verify(token, JWT_SECRET)
  3. Attach req.user for the route handler
        │
        ▼
Route handler runs with req.user available
```

---

## New environment variables

Add to `.env`:

```env
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

---

## Updated folder structure

```
museum-guide-chatbot/
├── middleware/
│   ├── auth.js           # existing API key middleware
│   └── authGuard.js      # NEW: JWT verification middleware
│
├── models/
│   ├── Artwork.js
│   ├── Session.js        # UPDATED: replace sessionId with userId
│   └── User.js           # NEW
│
├── routes/
│   ├── auth.js           # NEW: register, login, me
│   └── guide.js          # UPDATED: protected with authGuard
│
└── controllers/          # OPTIONAL: move logic out of routes
    └── authController.js
```

---

## Security checklist

- [x] Passwords hashed with bcrypt (never stored plain text)
- [x] JWT signed with a secret stored in `.env`
- [x] Token sent via `Authorization` header (not URL params)
- [x] Passwords excluded from all query results with `.select('-password')`
- [x] Input validated and sanitized with `express-validator`
- [x] JWT has an expiry (`7d` — adjust as needed)
- [x] `.env` is in `.gitignore` and never committed
- [ ] (future) Refresh token rotation for longer sessions
- [ ] (future) Rate limiting on `/register` and `/login` to prevent brute force

---

## Frontend changes required

- Add a login and register page/modal to the UI
- Store the JWT in `localStorage` (simpler) or in memory (more secure)
- Attach `Authorization: Bearer <token>` to every API request
- Show the user's name in the header when logged in
- Add a logout button that clears the token

---

## Acceptance criteria

The feature is complete when:

1. A new user can register with name, email, and password
2. A registered user can log in and receive a valid JWT
3. An unauthenticated request to a protected route returns `401`
4. An authenticated request to `/api/auth/me` returns the correct user
5. Chat sessions are linked to `req.user._id`, not a random UUID
6. Passwords are never returned in any API response
7. A tampered or expired token is rejected with a clear error

---

