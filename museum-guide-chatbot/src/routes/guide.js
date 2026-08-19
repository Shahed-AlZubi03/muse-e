import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { callClaudeVision, callClaudeChat } from '../services/claudeService.js'
import Artwork from '../models/Artwork.js'
import Session from '../models/Session.js'
import authGuard from '../middleware/authGuard.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// Browsers can report a generic or wrong Content-Type (drag-and-drop, HEIC from
// iOS, odd extensions), and OpenAI rejects anything outside png/jpeg/gif/webp.
// Trust the file's magic bytes over the client-supplied mimetype.
function detectImageMime(buffer) {
  if (buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.subarray(0, 6).toString('latin1').match(/^GIF8[79]a$/)) return 'image/gif'
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
      buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

router.post('/ask', authGuard, upload.single('image'), async (req, res) => {
  try {
    const userId = req.user._id
    const { sessionId: existingSessionId, message, language: rawLang } = req.body
    // Multilingual: extract base language code, default to 'en'
    const language = (rawLang && /^[a-z]{2,3}$/i.test(rawLang.split('-')[0]))
      ? rawLang.split('-')[0].toLowerCase()
      : 'en'

    // --- Step 1: Load or create session ---
    // Follow-up turns send back the session _id; first turns always create a new session
    let session = null
    if (existingSessionId) {
      session = await Session.findOne({ _id: existingSessionId, userId })
    }

    if (!session && !req.file) {
      return res.status(400).json({ error: 'Image required for the first turn.' })
    }

    // --- Step 2: First turn — identify artwork via Claude Vision ---
    let artworkRaw = session?.artworkRaw
    if (!session) {
      const imageBase64 = req.file.buffer.toString('base64')
      const mimeType = detectImageMime(req.file.buffer)
      if (!mimeType) {
        return res.status(400).json({
          error: 'Unsupported image format. Please upload a JPEG, PNG, GIF, or WebP image.',
        })
      }

      artworkRaw = await callClaudeVision(imageBase64, mimeType, `
        Identify this artwork. Respond in JSON only with these fields:
        { "title": "", "artist": "", "year": 0, "movement": "" }
      `)
    }

    // --- Step 3: Look up or upsert artwork in MongoDB ---
    let artwork = null
    if (artworkRaw?.title) {
      artwork = await Artwork.findOneAndUpdate(
        { title: { $regex: `^${artworkRaw.title}$`, $options: 'i' } },
        {
          $setOnInsert: {
            title:    artworkRaw.title,
            artist:   artworkRaw.artist,
            year:     artworkRaw.year     || null,
            movement: artworkRaw.movement || '',
          }
        },
        { upsert: true, new: true }
      )
    }

    // --- Step 3b: Persist the uploaded image immediately (first turn only) ---
    if (req.file && artwork && !artwork.imageUrl) {
      const ext  = { 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' }[detectImageMime(req.file.buffer)] || '.jpg'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer)
      artwork = await Artwork.findByIdAndUpdate(
        artwork._id,
        { $set: { imageUrl: `/uploads/${filename}` } },
        { new: true }
      )
    }

    // --- Step 4: Create session if first turn ---
    if (!session) {
      session = await Session.create({
        userId,
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
      Always respond in the language with ISO code: '${language}'. If it is Arabic or Hebrew, phrase naturally for right-to-left readers.
      You are Musée, an expert art guide with deep knowledge of art history, technique, and symbolism.
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

    res.json({ reply, artwork: artworkRaw, artworkId: session.artworkId || null, sessionId: session._id })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// GET /api/sessions — list the authenticated user's past sessions
router.get('/sessions', authGuard, async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user._id })
      .populate('artworkId', 'imageUrl')
      .sort({ createdAt: -1 })
      .limit(20)
    res.json({ sessions })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch sessions.' })
  }
})

router.get('/card/:sessionId', authGuard, async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.sessionId, userId: req.user._id })

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' })
    }

    const artworkRaw = session.artworkRaw
    if (!artworkRaw) {
      return res.status(400).json({ error: 'No artwork associated with this session.' })
    }

    // Look up artwork in DB for extra details
    let artwork = null
    if (artworkRaw.title) {
      artwork = await Artwork.findOne({
        title: { $regex: artworkRaw.title, $options: 'i' }
      })
    }

    // Generate a one-sentence insight using Claude
    const insightPrompt = `You are an art expert. Generate a single sharp one-sentence insight about this artwork (max 20 words). No quotes, no preamble, just the insight.`
    const insightMessages = [
      { role: 'user', content: `Artwork: "${artworkRaw.title}" by ${artworkRaw.artist}, ${artworkRaw.year}, ${artworkRaw.movement} movement.` }
    ]
    const insight = await callClaudeChat(insightPrompt, insightMessages)

    res.json({
      title: artworkRaw.title || 'Unknown',
      artist: artworkRaw.artist || 'Unknown',
      year: artworkRaw.year || null,
      movement: artworkRaw.movement || null,
      imageUrl: artwork?.imageUrl || null,
      insight: insight.trim()
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to generate art card.' })
  }
})

export default router
