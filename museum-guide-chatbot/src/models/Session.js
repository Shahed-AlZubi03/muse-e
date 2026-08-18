import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  role:    { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
})

const sessionSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  artworkId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Artwork' },
  artworkRaw: { type: Object },
  messages:   [messageSchema],
  quizzes:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }],
  bestScore:  { type: Number, default: null },
}, { timestamps: true })

export default mongoose.model('Session', sessionSchema)
