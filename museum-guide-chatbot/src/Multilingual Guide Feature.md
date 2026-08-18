# Multilingual Guide — Feature Brief

## What it does

Detects the user's preferred language from the request and instructs OpenAI to respond in that language automatically. No UI changes needed — the guide simply speaks the user's language.

---

## How it works

1. Frontend sends the browser's language (e.g. , `en`, `ar`, `fr`, `ja`) in the request body
2. Backend injects it into OpenAI's system prompt
3. OpenAI responds entirely in that language — same curator quality, different tongue

---

## Changes required

**Frontend** — add one line to the `fetch` call:
```js
formData.append('language', navigator.language) // e.g. "ar", "fr-FR", "ja"
```

**Backend** — extract language in the route and inject into system prompt:
```js
const language = req.body.language || 'en'

const systemPrompt = `You are an expert museum guide.
Always respond in the language with code: "${language}".
If the language is Arabic, use right-to-left friendly phrasing.
${artworkContext}
Be warm, conversational, and accessible.`
```

That's it. No new dependencies, no schema changes.

---

## Edge cases to handle

- Unknown or unsupported language code → default to English
- Mixed locale codes like `fr-FR` → strip to just `fr` with `.split('-')[0]`
- Arabic / Hebrew → remind OpenAI to phrase naturally for RTL readers
