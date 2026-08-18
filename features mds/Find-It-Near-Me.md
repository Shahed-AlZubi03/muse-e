# Find It Near Me — Feature Brief

## What it does

After Muse identifies an artwork, this feature tells the user exactly where the real physical piece lives — which museum, which city, which room — and if the user shares their location, it calculates the nearest museum where they could see it or a thematically similar work in person.

It closes the loop between the digital experience and the real world. Muse stops being just a chatbot and becomes a travel companion that nudges people toward actual cultural visits.

---

## User flow

User explores artwork via Muse
        ↓
Muse identifies: "The Starry Night — MoMA, New York, Gallery 505"
        ↓
"Find It Near Me" button appears
        ↓
User grants browser geolocation (or types their city)
        ↓
Backend calculates distance to host museum
        ↓
If far → suggests nearest museum with a similar work
If close → gives exact visiting info (address, hours, ticket link)
        ↓
OpenAI narrates the response warmly:
"You're 2.3 km from the Louvre, which holds several
Post-Impressionist works you'd love based on this..."

---

## Architecture
Frontend
  └── "Find It Near Me" button
  └── navigator.geolocation.getCurrentPosition()
  └── Sends { lat, lng, artworkId } to backend

Backend: GET /api/nearby
  └── Fetch artwork from MongoDB (get host museum name + city)
  └── Query museums collection for nearby institutions
  └── Calculate distance (Haversine formula or Google Maps API)
  └── If no exact match → find museums with similar movement/tags
  └── Pass results to OpenAI for warm, natural narration
  └── Return structured response to frontend

---

## New MongoDB collection: Museums

const museumSchema = new Schema({
  name: String,                        // "Musée d'Orsay"
  city: String,                        // "Paris"
  country: String,                     // "France"
  address: String,
  coordinates: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]              // [longitude, latitude]
  },
  website: String,
  ticketUrl: String,
  openingHours: String,
  notableMovements: [String],          // ["Impressionism", "Post-Impressionism"]
  notableArtists: [String],
  highlights: [String]                 // Famous works they hold
}, { timestamps: true })

museumSchema.index({ coordinates: '2dsphere' })  // Required for geo queries
---

## Key backend logic

### Geospatial query (MongoDB native)

// Find museums within N km of user
const nearbyMuseums = await Museum.find({
  coordinates: {
    $near: {
      $geometry: { type: 'Point', coordinates: [userLng, userLat] },
      $maxDistance: 100000   // 100 km radius
    }
  }
}).limit(5) 

### Fallback: Similar movement match

// If no museum nearby, find one with matching art movement
const artwork = await Artwork.findById(artworkId)
const similarMuseums = await Museum.find({
  notableMovements: { $in: [artwork.movement] }
}).limit(3) 

### OpenAI narration call

const prompt = `
You are Muse, an expert art guide.
The user is exploring "${artwork.title}" by ${artwork.artist}.
The real painting is located at: ${artwork.museum}, ${artwork.museumCity}.
The user is currently in: ${userCity} (${distanceKm} km away).

Nearby museums with relevant works:
${JSON.stringify(nearbyMuseums)}

Write a warm, 2-3 sentence response that:
1. Tells them where the real painting lives
2. Recommends the closest museum they could visit
3. Mentions one specific work they'd love there based on the current artwork's style

Be conversational, like a knowledgeable friend — not a travel brochure.
`
`
---

## Frontend changes

- Add a location icon button below the artwork panel — only appears after artwork is identified
- On click: request geolocation → show a small loading state → render the response in a dedicated card below the chat
- The card shows: museum name, distance, address, a "Get Directions" link (opens Google Maps), and OpenAI's narration

---

## APIs & tools involved

| Tool | Purpose |
|---|---|
| navigator.geolocation | Get user coordinates in browser |
| MongoDB 2dsphere index | Geospatial nearest-neighbor queries |
| Google Maps Directions URL | "Get Directions" deeplink (no API key needed) |
| OpenAI API | Warm, natural narration of the result |
| Optional: Google Places API | Richer museum data (hours, photos, ratings) |

---

## Data to seed

Start with 20–30 major museums with coordinates and their notable movements. Good starting list:

- MoMA, New York — Modern, Abstract Expressionism
- The Louvre, Paris — Renaissance, Baroque, Neoclassicism
- Musée d'Orsay, Paris — Impressionism, Post-Impressionism
- The Prado, Madrid — Renaissance, Baroque, Spanish masters
- Uffizi Gallery, Florence — Early Renaissance, Mannerism
- Rijksmuseum, Amsterdam — Dutch Golden Age, Baroque
- Tate Modern, London — Modern, Contemporary, Surrealism
- The Met, New York — Everything (encyclopedic)
- National Gallery, London — Renaissance, Impressionism
- Hermitage, St. Petersburg — Baroque, Impressionism, Dutch masters

---

## Effort estimate

| Task | Time |
|---|---|
| Museum schema + seed data | 2–3 hours |
| Geospatial query logic | 1–2 hours |
| /api/nearby route | 2 hours |
| OpenAI narration prompt | 30 minutes |
| Frontend button + card UI | 2–3 hours |
| Total | ~8–10 hours |

