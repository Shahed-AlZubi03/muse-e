import mongoose from 'mongoose'

const { Schema } = mongoose

const quizScoreSchema = new Schema({
  artworkId: { type: Schema.Types.ObjectId, ref: 'Artwork' },
  score:     { type: Number },
  total:     { type: Number },
  date:      { type: Date, default: Date.now }
}, { _id: false })

const userSchema = new Schema({
  name: {
    type:      String,
    required:  true,
    trim:      true,
    minlength: 2,
    maxlength: 60
  },
  email: {
    type:      String,
    required:  true,
    unique:    true,
    lowercase: true,
    trim:      true
  },
  password: {
    type:      String,
    required:  true,
    minlength: 8,
    select:    false
  },
  savedArtworks: [
    { type: Schema.Types.ObjectId, ref: 'Artwork' }
  ],
  quizScores: [quizScoreSchema]
}, { timestamps: true })

export default mongoose.model('User', userSchema)
