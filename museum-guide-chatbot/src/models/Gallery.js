import mongoose from 'mongoose'

const savedArtworkSchema = new mongoose.Schema({
  artworkId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Artwork', required: true },
  sessionId:    { type: String, required: true },
  savedAt:      { type: Date, default: Date.now },
  personalNote: { type: String, default: '' },
  aiSummary:    { type: String, default: '' },
  imageUrl:     { type: String, default: '' }
})

const gallerySchema = new mongoose.Schema({
  userId:        { type: String, required: true, unique: true, index: true },
  savedArtworks: [savedArtworkSchema]
}, { timestamps: true })

export default mongoose.model('Gallery', gallerySchema)
