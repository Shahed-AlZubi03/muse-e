import 'dotenv/config'
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function callClaudeVision(imageBase64, mimeType, prompt) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        { type: 'text', text: prompt }
      ]
    }]
  })
  const raw = response.choices[0].message.content.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`Vision model returned non-JSON: ${raw.slice(0, 300)}`)
  }
}

export async function callClaudeChat(systemPrompt, messages) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ]
  })
  return response.choices[0].message.content
}

export async function generateQuiz(artwork, messages, difficulty = 'novice') {
  const systemPrompt = `You are an expert art educator and quiz designer for a premium museum guide application called Muse.

Your task is to generate a 5-question multiple choice quiz based on the artwork information and conversation provided. The quiz should test what the user just learned.

Rules:
- Exactly 5 questions, one per category: factual, biography, technique, symbolism, movement
- Each question has exactly 4 options: A, B, C, D
- Exactly one correct answer per question
- Wrong options (distractors) must be plausible — not obviously wrong
- The explanation must be 1-2 sentences, clear and educational
- Difficulty: ${difficulty}
- Questions must be answerable from the artwork data and conversation provided
- Never repeat the same fact across questions

Respond ONLY with a valid JSON array. No preamble, no markdown, no explanation outside the JSON.

Format:
[
  {
    "index": 0,
    "category": "factual",
    "question": "...",
    "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "correctOption": "B",
    "explanation": "..."
  }
]`

  const conversationSummary = messages
    .slice(-6)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n')

  const userPrompt = `Artwork:
Title: ${artwork.title || 'Unknown'}
Artist: ${artwork.artist || 'Unknown'}
Year: ${artwork.year || 'Unknown'}
Movement: ${artwork.movement || 'Unknown'}
Medium: ${artwork.medium || 'Unknown'}
Museum: ${artwork.museum || 'Unknown'}

Curator notes:
${artwork.curatorNotes || 'N/A'}

Fun facts:
${artwork.funFacts?.join(' | ') || 'N/A'}

Recent conversation summary:
${conversationSummary}

Generate the quiz now.`

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2048,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  })

  const raw = response.choices[0].message.content.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`Quiz model returned non-JSON: ${raw.slice(0, 300)}`)
  }
}
