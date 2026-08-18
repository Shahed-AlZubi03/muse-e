import express from 'express'
import authGuard from '../middleware/authGuard.js'
import { textToSpeech } from '../services/tts.js'

const router = express.Router()

router.post('/speak', authGuard, async (req, res) => {
  try {
    const { text } = req.body
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required.' })
    }

    const audioBuffer = await textToSpeech(text.trim())

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength
    })
    res.send(Buffer.from(audioBuffer))
  } catch (err) {
    console.error('TTS error:', err.message)
    res.status(500).json({ error: 'Failed to generate audio.' })
  }
})

export default router
