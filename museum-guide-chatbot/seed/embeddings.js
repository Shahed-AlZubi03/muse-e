import 'dotenv/config'
import mongoose from 'mongoose'
import Artwork from '../src/models/Artwork.js'
import { generateEmbedding } from '../src/services/embeddings.js'

async function seedEmbeddings() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to MongoDB')

  const artworks = await Artwork.find({ embedding: { $exists: false } }).select('+embedding')

  console.log(`Found ${artworks.length} artworks without embeddings`)

  for (const artwork of artworks) {
    const text = [
      artwork.title,
      artwork.artist,
      artwork.movement,
      artwork.curatorNotes,
    ].filter(Boolean).join(' — ')

    try {
      const embedding = await generateEmbedding(text)
      artwork.embedding = embedding
      await artwork.save()
      console.log(`✓ ${artwork.title}`)
    } catch (err) {
      console.error(`✗ ${artwork.title}: ${err.message}`)
    }
  }

  console.log('Done seeding embeddings')
  await mongoose.disconnect()
}

seedEmbeddings()
