import crypto from 'crypto'

const apiKeyAuth = (req, res, next) => {
  const key = req.headers['x-api-key']
  if (!key || !process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing API key.' })
  }

  const expected = Buffer.from(process.env.API_KEY)
  const provided = Buffer.from(key)
  if (expected.length !== provided.length ||
      !crypto.timingSafeEqual(expected, provided)) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing API key.' })
  }

  next()
}

export default apiKeyAuth
