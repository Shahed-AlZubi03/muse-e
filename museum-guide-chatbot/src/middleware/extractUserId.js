const extractUserId = (req, res, next) => {
  const userId = req.headers['x-user-id']
  if (!userId) {
    return res.status(400).json({ error: 'x-user-id header required' })
  }
  req.userId = userId
  next()
}

export default extractUserId
