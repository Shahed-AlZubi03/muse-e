import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Voice options: alloy, echo, fable, onyx, nova, shimmer
const TTS_VOICE = process.env.TTS_VOICE || 'nova' // nova has a warm, engaging tone perfect for museum narration

export async function textToSpeech(text) {
  const response = await openai.audio.speech.create({
    model: 'tts-1', // use tts-1-hd for higher quality (slightly slower)
    voice: TTS_VOICE,
    input: text,
    response_format: 'mp3'
  })

  // Convert response to ArrayBuffer
  const arrayBuffer = await response.arrayBuffer()
  return arrayBuffer
}
