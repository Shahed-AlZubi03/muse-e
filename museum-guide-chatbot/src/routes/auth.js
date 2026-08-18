import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import User from '../models/User.js'
import authGuard from '../middleware/authGuard.js'

const router = express.Router()

// In-memory login attempt tracker (use Redis in production)
const loginAttempts = new Map()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

function checkLockout(email) {
  const record = loginAttempts.get(email)
  if (!record) return false
  if (Date.now() - record.firstAttempt > LOCKOUT_MS) {
    loginAttempts.delete(email)
    return false
  }
  return record.count >= MAX_ATTEMPTS
}

function recordFailedAttempt(email) {
  const record = loginAttempts.get(email)
  if (!record || Date.now() - record.firstAttempt > LOCKOUT_MS) {
    loginAttempts.set(email, { count: 1, firstAttempt: Date.now() })
  } else {
    record.count++
  }
}

function clearAttempts(email) {
  loginAttempts.delete(email)
}

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  })

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required.')
      .isLength({ max: 60 }).withMessage('Name must be at most 60 characters.'),
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password')
      .isLength({ min: 12 }).withMessage('Password must be at least 12 characters.')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter.')
      .matches(/[a-z]/).withMessage('Password must contain a lowercase letter.')
      .matches(/[0-9]/).withMessage('Password must contain a digit.')
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg })
    }

    try {
      const { name, email, password } = req.body

      const existing = await User.findOne({ email })
      if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' })
      }

      const hashed = await bcrypt.hash(password, 12)
      const user = await User.create({ name, email, password: hashed })

      const token = signToken(user._id)

      res.status(201).json({
        message: 'Account created successfully.',
        token,
        user: {
          id:    user._id,
          name:  user.name,
          email: user.email
        }
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Registration failed.' })
    }
  }
)

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.')
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg })
    }

    try {
      const { email, password } = req.body

      if (checkLockout(email)) {
        return res.status(429).json({ error: 'Account temporarily locked. Try again later.' })
      }

      const user = await User.findOne({ email }).select('+password')
      if (!user) {
        recordFailedAttempt(email)
        return res.status(401).json({ error: 'Invalid credentials.' })
      }

      const match = await bcrypt.compare(password, user.password)
      if (!match) {
        recordFailedAttempt(email)
        return res.status(401).json({ error: 'Invalid credentials.' })
      }

      clearAttempts(email)
      const token = signToken(user._id)

      res.status(200).json({
        token,
        user: {
          id:    user._id,
          name:  user.name,
          email: user.email
        }
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Login failed.' })
    }
  }
)

// GET /api/auth/me  — protected
router.get('/me', authGuard, (req, res) => {
  res.status(200).json({ user: req.user })
})

export default router
