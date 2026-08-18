import mongoose from 'mongoose'

const questionSchema = new mongoose.Schema({
  index: Number,
  category: {
    type: String,
    enum: ['factual', 'biography', 'technique', 'symbolism', 'movement']
  },
  question: String,
  options: {
    A: String,
    B: String,
    C: String,
    D: String
  },
  correctOption: {
    type: String,
    enum: ['A', 'B', 'C', 'D']
  },
  explanation: String,
  userAnswer: {
    type: String,
    enum: ['A', 'B', 'C', 'D', null],
    default: null
  },
  isCorrect: {
    type: Boolean,
    default: null
  }
})

const quizSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true
  },
  artworkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artwork'
  },
  difficulty: {
    type: String,
    enum: ['novice', 'scholar', 'expert'],
    default: 'novice'
  },
  questions: [questionSchema],
  score: {
    type: Number,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true })

export default mongoose.model('Quiz', quizSchema)
