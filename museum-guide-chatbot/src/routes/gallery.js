import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import https from 'https'
import Gallery from '../models/Gallery.js'
import Artwork from '../models/Artwork.js'
import authGuard from '../middleware/authGuard.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  }
})
const allowedMimes = ['image/jpeg', 'image/png', 'image/webp']
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed.'), false)
    }
  }
})

// Fetch the Wikipedia summary thumbnail URL for an artwork title
async function fetchWikipediaImageUrl(title) {
  const slug = encodeURIComponent(title.trim())
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Musee-App/1.0' } }, (res) => {
      let body = ''
      res.on('data', chunk => { body += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          resolve(json?.thumbnail?.source || null)
        } catch {
          resolve(null)
        }
      })
    }).on('error', () => resolve(null))
  })
}

// Escape special regex characters to prevent ReDoS
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const router = express.Router()

// All gallery routes require authenticated user
router.use(authGuard)

// POST /api/gallery/save — Save an artwork to the user's gallery
router.post('/save', upload.single('image'), async (req, res) => {
  try {
    const { artworkId, sessionId } = req.body
    // artworkRaw arrives as a JSON string in multipart form data
    const artworkRaw = req.body.artworkRaw ? JSON.parse(req.body.artworkRaw) : null

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' })
    }

    // Resolve the artworkId: use the provided one, or upsert from raw data
    let resolvedId = artworkId || null

    if (!resolvedId && artworkRaw?.title && artworkRaw?.artist) {
      // Find or create an Artwork document from the raw identified data
      const escapedTitle = escapeRegExp(artworkRaw.title)
      const upserted = await Artwork.findOneAndUpdate(
        { title: { $regex: `^${escapedTitle}$`, $options: 'i' } },
        {
          $setOnInsert: {
            title:    artworkRaw.title,
            artist:   artworkRaw.artist,
            year:     artworkRaw.year   || null,
            movement: artworkRaw.movement || '',
          }
        },
        { upsert: true, new: true }
      )
      resolvedId = upserted._id
    }

    if (!resolvedId) {
      return res.status(400).json({ error: 'Could not resolve artwork. Provide artworkId or artworkRaw (title + artist).' })
    }

    // If an image was uploaded, always store it (user's own photo takes priority)
    let resolvedImageUrl = ''
    if (req.file) {
      resolvedImageUrl = `/uploads/${req.file.filename}`
      await Artwork.findByIdAndUpdate(resolvedId, { $set: { imageUrl: resolvedImageUrl } })
    } else if (artworkRaw?.title) {
      // No upload — try to pull a thumbnail from Wikipedia
      const existing = await Artwork.findById(resolvedId, 'imageUrl')
      if (!existing?.imageUrl) {
        const wikiUrl = await fetchWikipediaImageUrl(artworkRaw.title)
        if (wikiUrl) {
          resolvedImageUrl = wikiUrl
          await Artwork.findByIdAndUpdate(resolvedId, { $set: { imageUrl: wikiUrl } })
        }
      } else {
        resolvedImageUrl = existing.imageUrl
      }
    }

    // Find or create gallery for this user
    let gallery = await Gallery.findOne({ userId: req.user._id })
    if (!gallery) {
      gallery = await Gallery.create({ userId: req.user._id, savedArtworks: [] })
    }

    // Prevent duplicates
    const alreadySaved = gallery.savedArtworks.some(
      item => item.artworkId.toString() === resolvedId.toString()
    )
    if (alreadySaved) {
      return res.status(409).json({ error: 'Artwork already saved to gallery.' })
    }

    gallery.savedArtworks.push({ artworkId: resolvedId, sessionId, aiSummary: req.body.aiSummary || '', imageUrl: resolvedImageUrl })
    await gallery.save()

    res.status(201).json({ message: 'Artwork saved to gallery', galleryId: gallery._id })
  } catch (err) {
    console.error('Gallery save error:', err)
    res.status(500).json({ error: 'Failed to save artwork.' })
  }
})

// GET /api/gallery — Retrieve user's full gallery with taste profile
router.get('/', async (req, res) => {
  try {
    const gallery = await Gallery.findOne({ userId: req.user._id })
      .populate('savedArtworks.artworkId', 'title artist year movement museum imageUrl')

    if (!gallery) {
      return res.json({ userId: req.user._id, savedArtworks: [], tasteProfile: {} })
    }

    res.json({
      userId: gallery.userId,
      savedArtworks: gallery.savedArtworks.map(item => ({
        artworkId:    item.artworkId,
        sessionId:    item.sessionId,
        savedAt:      item.savedAt,
        personalNote: item.personalNote,
        aiSummary:    item.aiSummary,
        imageUrl:     item.imageUrl || ''
      }))
    })
  } catch (err) {
    console.error('Gallery fetch error:', err)
    res.status(500).json({ error: 'Failed to retrieve gallery.' })
  }
})

// DELETE /api/gallery/:artworkId — Remove an artwork from the gallery
router.delete('/:artworkId', async (req, res) => {
  try {
    const gallery = await Gallery.findOne({ userId: req.user._id })
    if (!gallery) {
      return res.status(404).json({ error: 'Gallery not found.' })
    }

    const index = gallery.savedArtworks.findIndex(
      item => item.artworkId.toString() === req.params.artworkId
    )
    if (index === -1) {
      return res.status(404).json({ error: 'Artwork not found in gallery.' })
    }

    gallery.savedArtworks.splice(index, 1)
    await gallery.save()

    res.json({ message: 'Artwork removed from gallery' })
  } catch (err) {
    console.error('Gallery delete error:', err)
    res.status(500).json({ error: 'Failed to remove artwork.' })
  }
})

// PATCH /api/gallery/:artworkId/note — Add or update a personal note
router.patch('/:artworkId/note', async (req, res) => {
  try {
    const { note } = req.body
    if (typeof note !== 'string') {
      return res.status(400).json({ error: 'note field is required and must be a string.' })
    }

    const gallery = await Gallery.findOne({ userId: req.user._id })
    if (!gallery) {
      return res.status(404).json({ error: 'Gallery not found.' })
    }

    const item = gallery.savedArtworks.find(
      item => item.artworkId.toString() === req.params.artworkId
    )
    if (!item) {
      return res.status(404).json({ error: 'Artwork not found in gallery.' })
    }

    item.personalNote = note
    await gallery.save()

    res.json({ message: 'Note updated', personalNote: note })
  } catch (err) {
    console.error('Gallery note update error:', err)
    res.status(500).json({ error: 'Failed to update note.' })
  }
})

export default router
