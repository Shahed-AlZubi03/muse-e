import express from 'express'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import connectDB from './config/db.js'
import guideRouter from './routes/guide.js'
import speakRouter from './routes/speak.js'
import authRouter from './routes/auth.js'
import quizRouter from './routes/quiz.js'
import galleryRouter from './routes/gallery.js'

dotenv.config()

// Validate critical secrets at startup
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters.')
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Connect to MongoDB
await connectDB()

// Security headers
const isDev = process.env.NODE_ENV !== 'production'
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    }
  },
  // Disable HSTS in dev — Safari caches it and breaks HTTP localhost
  strictTransportSecurity: isDev ? false : { maxAge: 31536000, includeSubDomains: true }
}))

// CORS — restrict to configured origin; same-origin when unset
app.use(cors({ origin: process.env.CORS_ORIGIN || false, credentials: true }))

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
})

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please slow down.' }
})

// Apply rate limits before routes
app.use('/api/auth', authLimiter)
app.use('/api/ask', aiLimiter)
app.use('/api/quiz/generate', aiLimiter)
app.use('/api/card', aiLimiter)
app.use('/api/speak', aiLimiter)

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')))

// API routes
app.use('/api/auth', authRouter)
app.use('/api/gallery', galleryRouter)
app.use('/api/quiz', quizRouter)
app.use('/api', guideRouter)
app.use('/api', speakRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' })
})

// Start server
app.listen(PORT, () => {
  console.log(`Musée server running on http://localhost:${PORT}`)
})
