import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Generate a vector embedding for the given text using OpenAI text-embedding-3-small.
 * Returns a 1536-dimensional float array.
 */
export async function generateEmbedding(text) {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

/**
 * Find the top 3 artworks most similar to the given embedding vector.
 * Uses MongoDB Atlas $vectorSearch aggregation.
 * Excludes the artwork with `excludeId` from results.
 */
export async function findSimilarArtworks(Artwork, embedding, excludeId) {
  const results = await Artwork.aggregate([
    {
      $vectorSearch: {
        index: 'artwork_embeddings',
        path: 'embedding',
        queryVector: embedding,
        numCandidates: 20,
        limit: 4,
      },
    },
    {
      $match: {
        _id: { $ne: excludeId },
      },
    },
    {
      $limit: 3,
    },
    {
      $project: {
        _id: 0,
        title: 1,
        artist: 1,
        year: 1,
        movement: 1,
      },
    },
  ])
  return results
}
