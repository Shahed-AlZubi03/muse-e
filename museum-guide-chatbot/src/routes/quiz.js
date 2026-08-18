import express from 'express'
import { generateQuiz } from '../services/claudeService.js'
import Quiz from '../models/Quiz.js'
import Session from '../models/Session.js'
import Artwork from '../models/Artwork.js'
import User from '../models/User.js'
import authGuard from '../middleware/authGuard.js'

const router = express.Router()

const BADGES = [
  { min: 5, badge: 'Curator', message: 'Extraordinary. You see this artwork the way its creator did.' },
  { min: 4, badge: 'Art Enthusiast', message: 'Impressive knowledge. One detail slipped past you.' },
  { min: 3, badge: 'Gallery Visitor', message: 'A solid start. The artwork has more to reveal.' },
  { min: 2, badge: 'Curious Observer', message: "You're beginning to see. Explore further." },
  { min: 0, badge: 'First Timer', message: 'Every expert started here. Try again after re-reading.' }
]

function getBadge(score) {
  return BADGES.find(b => score >= b.min)
}

// POST /api/quiz/generate
router.post('/generate', authGuard, async (req, res) => {
  try {
    const { sessionId, difficulty = 'novice' } = req.body

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' })
    }

    if (!['novice', 'scholar', 'expert'].includes(difficulty)) {
      return res.status(400).json({ error: 'Invalid difficulty level.' })
    }

    const session = await Session.findOne({ _id: sessionId, userId: req.user._id })
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' })
    }

    if (!session.artworkId && !session.artworkRaw) {
      return res.status(400).json({ error: 'Quiz requires an identified artwork.' })
    }

    // Load artwork data from DB if available
    let artworkData = session.artworkRaw || {}
    if (session.artworkId) {
      const artwork = await Artwork.findById(session.artworkId)
      if (artwork) {
        artworkData = {
          title: artwork.title,
          artist: artwork.artist,
          year: artwork.year,
          movement: artwork.movement,
          medium: artwork.medium,
          museum: artwork.museum,
          curatorNotes: artwork.curatorNotes,
          funFacts: artwork.funFacts
        }
      }
    }

    // Generate quiz via OpenAI
    let questions
    try {
      questions = await generateQuiz(artworkData, session.messages, difficulty)
    } catch (err) {
      // Retry once on malformed JSON
      try {
        questions = await generateQuiz(artworkData, session.messages, difficulty)
      } catch {
        return res.status(500).json({ error: 'Failed to generate quiz. Please try again.' })
      }
    }

    // Validate structure
    if (!Array.isArray(questions) || questions.length !== 5) {
      return res.status(500).json({ error: 'Failed to generate a valid quiz. Please try again.' })
    }

    // Save quiz
    const quiz = await Quiz.create({
      sessionId: session._id,
      artworkId: session.artworkId || null,
      difficulty,
      questions
    })

    // Link quiz to session
    session.quizzes.push(quiz._id)
    await session.save()

    // Return questions without answers
    const safeQuestions = quiz.questions.map(q => ({
      index: q.index,
      category: q.category,
      question: q.question,
      options: q.options
    }))

    res.json({
      quizId: quiz._id,
      difficulty: quiz.difficulty,
      questions: safeQuestions
    })
  } catch (err) {
    console.error('Quiz generate error:', err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// POST /api/quiz/:quizId/answer
router.post('/:quizId/answer', authGuard, async (req, res) => {
  try {
    const { quizId } = req.params
    const { questionIndex, selectedOption } = req.body

    if (questionIndex == null || !selectedOption) {
      return res.status(400).json({ error: 'questionIndex and selectedOption are required.' })
    }

    if (!['A', 'B', 'C', 'D'].includes(selectedOption)) {
      return res.status(400).json({ error: 'Invalid option. Must be A, B, C, or D.' })
    }

    const quiz = await Quiz.findById(quizId)
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found.' })
    }

    // Verify ownership via session
    const session = await Session.findOne({ _id: quiz.sessionId, userId: req.user._id })
    if (!session) {
      return res.status(403).json({ error: 'Unauthorized.' })
    }

    const question = quiz.questions.find(q => q.index === questionIndex)
    if (!question) {
      return res.status(400).json({ error: 'Invalid question index.' })
    }

    if (question.userAnswer !== null) {
      return res.status(400).json({ error: 'Question already answered.' })
    }

    // Record answer
    question.userAnswer = selectedOption
    question.isCorrect = selectedOption === question.correctOption
    await quiz.save()

    const questionsRemaining = quiz.questions.filter(q => q.userAnswer === null).length

    res.json({
      correct: question.isCorrect,
      correctOption: question.correctOption,
      explanation: question.explanation,
      questionsRemaining
    })
  } catch (err) {
    console.error('Quiz answer error:', err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// POST /api/quiz/:quizId/complete
router.post('/:quizId/complete', authGuard, async (req, res) => {
  try {
    const { quizId } = req.params

    const quiz = await Quiz.findById(quizId)
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found.' })
    }

    // Verify ownership
    const session = await Session.findOne({ _id: quiz.sessionId, userId: req.user._id })
    if (!session) {
      return res.status(403).json({ error: 'Unauthorized.' })
    }

    // Guard: prevent re-completion
    if (quiz.completedAt) {
      return res.status(400).json({ error: 'Quiz already completed.' })
    }

    // Calculate score
    const score = quiz.questions.filter(q => q.isCorrect === true).length
    quiz.score = score
    quiz.completedAt = new Date()
    await quiz.save()

    // Update session best score
    if (session.bestScore === null || score > session.bestScore) {
      session.bestScore = score
      await session.save()
    }

    // Append to user's quiz history
    await User.findByIdAndUpdate(req.user._id, {
      $push: { quizScores: { artworkId: quiz.artworkId || null, score, total: 5, date: new Date() } }
    })

    const { badge, message } = getBadge(score)
    const breakdown = quiz.questions.map(q => ({
      category: q.category,
      correct: q.isCorrect || false
    }))

    res.json({
      score,
      total: 5,
      percentage: (score / 5) * 100,
      badge,
      message,
      breakdown
    })
  } catch (err) {
    console.error('Quiz complete error:', err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// GET /api/quiz/session/:sessionId
router.get('/session/:sessionId', authGuard, async (req, res) => {
  try {
    const { sessionId } = req.params

    const session = await Session.findOne({ _id: sessionId, userId: req.user._id })
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' })
    }

    const quizzes = await Quiz.find({ sessionId }).sort({ createdAt: -1 })

    res.json({
      quizzes: quizzes.map(q => ({
        quizId: q._id,
        difficulty: q.difficulty,
        score: q.score,
        completedAt: q.completedAt,
        questions: q.questions.map(qu => ({
          index: qu.index,
          category: qu.category,
          question: qu.question,
          options: qu.options,
          correctOption: qu.correctOption,
          userAnswer: qu.userAnswer,
          isCorrect: qu.isCorrect,
          explanation: qu.explanation
        }))
      }))
    })
  } catch (err) {
    console.error('Quiz session fetch error:', err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

export default router
