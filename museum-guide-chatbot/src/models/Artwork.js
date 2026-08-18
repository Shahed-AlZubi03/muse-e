import mongoose from 'mongoose'

const artworkSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  artist:        { type: String, required: true },
  year:          { type: Number },
  movement:      { type: String },
  museum:        { type: String },
  medium:        { type: String },
  dimensions:    { type: String },
  curatorNotes:  { type: String },
  funFacts:      [{ type: String }],
  tags:          [{ type: String }],
  imageUrl:      { type: String },
  embedding:     { type: [Number], select: false },
}, { timestamps: true })

export default mongoose.model('Artwork', artworkSchema)
