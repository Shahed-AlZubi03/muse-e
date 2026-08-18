import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Artwork from '../src/models/Artwork.js'

dotenv.config()
await mongoose.connect(process.env.MONGODB_URI)

const artworks = [
  {
    title: 'The Starry Night',
    artist: 'Vincent van Gogh',
    year: 1889,
    movement: 'Post-Impressionism',
    museum: 'Museum of Modern Art, New York',
    medium: 'Oil on canvas',
    dimensions: '73.7 cm × 92.1 cm',
    curatorNotes: `Painted in June 1889 during Van Gogh's voluntary stay at the Saint-Paul-de-Mausole asylum in Saint-Rémy-de-Provence. The swirling sky is not purely imaginary — it reflects his turbulent mental state while also capturing actual astronomical phenomena. The cypress tree in the foreground was a symbol of mourning in European culture, yet here it reaches dramatically toward the heavens. The village below is calm and quiet, a sharp contrast to the electric, churning sky above.`,
    funFacts: [
      "Van Gogh wrote about the painting in a letter to his brother Theo, describing the night sky as full of 'terrible passions'.",
      'The church steeple resembles Dutch architecture, not the French village he was actually viewing.',
      'It was largely unknown during his lifetime and only became iconic decades after his death.'
    ],
    tags: ['landscape', 'night', 'sky', 'impressionism', 'dutch', 'oil']
  },
  {
    title: 'Girl with a Pearl Earring',
    artist: 'Johannes Vermeer',
    year: 1665,
    movement: 'Dutch Golden Age',
    museum: 'Mauritshuis, The Hague',
    medium: 'Oil on canvas',
    dimensions: '44.5 cm × 39 cm',
    curatorNotes: `Often called the "Mona Lisa of the North", this is technically not a portrait but a "tronie" — a Dutch term for a character study of an anonymous figure. The subject is unknown. The iconic pearl earring has been studied extensively: some experts believe it may actually be glass or tin, not a real pearl. Vermeer's mastery of light is on full display — the soft illumination against the dark background creates a sense of intimacy and mystery.`,
    funFacts: [
      "The girl's identity has never been confirmed — she is not a commissioned portrait subject.",
      'The pearl may not be a pearl at all — analysis suggests it could be glass.',
      'The painting inspired a bestselling novel by Tracy Chevalier in 1999, later adapted into a film.'
    ],
    tags: ['portrait', 'dutch', 'golden age', 'figure', 'oil', 'vermeer']
  },
  {
    title: 'The Persistence of Memory',
    artist: 'Salvador Dalí',
    year: 1931,
    movement: 'Surrealism',
    museum: 'Museum of Modern Art, New York',
    medium: 'Oil on canvas',
    dimensions: '24 cm × 33 cm',
    curatorNotes: `One of the most recognizable works of Surrealism, this small painting depicts melting pocket watches in a dreamlike landscape. Dalí claimed the soft watches were inspired by the surrealist perception of Camembert cheese melting in the sun. The barren landscape is based on Port Lligat in Catalonia, where Dalí lived. The central figure draped over a block is thought to be a self-portrait in fetal form.`,
    funFacts: [
      'The painting is surprisingly small — only about the size of a sheet of paper.',
      'Dalí supposedly conceived the melting watches while staring at a piece of runny Camembert cheese.',
      'It took Dalí only a few hours to paint once he had the concept.'
    ],
    tags: ['surrealism', 'spanish', 'oil', 'dreamlike', 'watches']
  },
  {
    title: 'The Birth of Venus',
    artist: 'Sandro Botticelli',
    year: 1485,
    movement: 'Early Renaissance',
    museum: 'Uffizi Gallery, Florence',
    medium: 'Tempera on canvas',
    dimensions: '172.5 cm × 278.9 cm',
    curatorNotes: `Depicts the goddess Venus emerging from the sea as a fully grown woman, driven to shore by the winds. It is one of the first large-scale Renaissance paintings on a non-religious, mythological subject. The pose of Venus references the classical Venus Pudica (modest Venus) type. Botticelli's use of flowing lines and idealized beauty became a hallmark of his style.`,
    funFacts: [
      'Venus is thought to have been modeled after Simonetta Vespucci, a famous Florentine beauty.',
      'The painting was nearly destroyed by Savonarola\'s "Bonfire of the Vanities" in the 1490s.',
      'It was painted on canvas rather than the more common wood panel of the era.'
    ],
    tags: ['mythology', 'renaissance', 'italian', 'tempera', 'figure']
  },
  {
    title: 'Las Meninas',
    artist: 'Diego Velázquez',
    year: 1656,
    movement: 'Baroque',
    museum: 'Museo del Prado, Madrid',
    medium: 'Oil on canvas',
    dimensions: '318 cm × 276 cm',
    curatorNotes: `Considered one of the most important paintings in Western art history. The composition is extraordinarily complex — Velázquez places himself in the painting, working on a large canvas, while the young Infanta Margarita is attended by her maids of honor (meninas). A mirror in the background reflects the king and queen, suggesting the viewer stands where the royal couple would be. This play with perspective and spectatorship was centuries ahead of its time.`,
    funFacts: [
      'Velázquez painted himself into the scene — the large figure on the left holding a palette.',
      'The mirror in the back reflects King Philip IV and Queen Mariana.',
      'Pablo Picasso created 58 reinterpretations of this single painting in 1957.'
    ],
    tags: ['baroque', 'spanish', 'oil', 'portrait', 'royal']
  },
  {
    title: 'A Sunday on La Grande Jatte',
    artist: 'Georges Seurat',
    year: 1886,
    movement: 'Pointillism',
    museum: 'Art Institute of Chicago',
    medium: 'Oil on canvas',
    dimensions: '207.6 cm × 308 cm',
    curatorNotes: `Seurat's masterpiece and the defining work of Pointillism (also called Divisionism). The entire painting is composed of tiny dots of pure color that blend optically when viewed from a distance. It depicts Parisians relaxing on a sunny island in the Seine. Seurat spent over two years creating the work, making numerous preparatory sketches and oil studies. The rigid, almost frozen quality of the figures gives the scene a timeless, monumental feel.`,
    funFacts: [
      'Seurat spent over two years working on this painting, completing around 60 studies.',
      'The painting is enormous — over 6 feet tall and 10 feet wide.',
      'It inspired the Stephen Sondheim musical "Sunday in the Park with George".'
    ],
    tags: ['pointillism', 'french', 'oil', 'landscape', 'park']
  },
  {
    title: 'The Great Wave off Kanagawa',
    artist: 'Katsushika Hokusai',
    year: 1831,
    movement: 'Ukiyo-e',
    museum: 'Multiple collections worldwide',
    medium: 'Woodblock print (nishiki-e)',
    dimensions: '25.7 cm × 37.9 cm',
    curatorNotes: `Part of Hokusai's series "Thirty-Six Views of Mount Fuji", this is perhaps the most famous work of Japanese art in the world. The towering wave dwarfs the fishing boats and even Mount Fuji in the background. It reflects the influence of European compositional techniques while remaining quintessentially Japanese. The blue pigment used (Prussian blue) was actually imported from Europe — a testament to the global trade routes of the period.`,
    funFacts: [
      'Hokusai was about 70 years old when he created this print.',
      'The blue color comes from Prussian blue, a synthetic pigment imported from Europe.',
      'Mount Fuji appears tiny in the background, emphasizing nature\'s overwhelming power.'
    ],
    tags: ['japanese', 'woodblock', 'wave', 'landscape', 'ukiyo-e']
  },
  {
    title: 'Water Lilies',
    artist: 'Claude Monet',
    year: 1906,
    movement: 'Impressionism',
    museum: 'Multiple museums worldwide',
    medium: 'Oil on canvas',
    dimensions: 'Various (series)',
    curatorNotes: `Part of Monet's famous series of approximately 250 oil paintings depicting his flower garden at Giverny. In his later years, Monet became increasingly focused on capturing the effects of light on the water's surface. The Water Lilies series is considered a precursor to Abstract Expressionism — as Monet aged and his eyesight deteriorated, the paintings became increasingly abstract, focusing on color, light, and atmosphere rather than precise representation.`,
    funFacts: [
      'Monet created approximately 250 Water Lilies paintings over the last 30 years of his life.',
      'He designed his garden at Giverny specifically to serve as the subject for his paintings.',
      'Some of the largest Water Lilies panels are over 6 feet tall and 40 feet wide.'
    ],
    tags: ['impressionism', 'french', 'oil', 'landscape', 'water', 'flowers']
  },
  {
    title: 'The Creation of Adam',
    artist: 'Michelangelo',
    year: 1512,
    movement: 'High Renaissance',
    museum: 'Sistine Chapel, Vatican City',
    medium: 'Fresco',
    dimensions: '280 cm × 570 cm',
    curatorNotes: `Part of the Sistine Chapel ceiling, this scene depicts God giving life to Adam, the first man. The near-touching fingers have become one of the most replicated images in art history. The composition is remarkable: the shape surrounding God and the angels closely resembles a cross-section of the human brain — which some scholars believe was Michelangelo's hidden message about the gift of intellect. Michelangelo painted the entire ceiling while lying on his back on scaffolding over four years.`,
    funFacts: [
      'Michelangelo considered himself primarily a sculptor, not a painter.',
      'He painted the ceiling largely alone, dismissing his assistants early in the project.',
      'The shape behind God resembles an anatomical cross-section of the human brain.'
    ],
    tags: ['renaissance', 'italian', 'fresco', 'religious', 'figure']
  },
  {
    title: 'American Gothic',
    artist: 'Grant Wood',
    year: 1930,
    movement: 'Regionalism',
    museum: 'Art Institute of Chicago',
    medium: 'Oil on beaverboard',
    dimensions: '78 cm × 65.3 cm',
    curatorNotes: `One of the most familiar images in American art, depicting a farmer and his daughter (often mistaken for his wife) standing before a house with a distinctive Gothic window. Wood intended it as a straightforward depiction of small-town Iowa character, but it was received as both celebration and satire of rural American values. The models were Wood's sister and his dentist. The pitchfork echoes in the stitching of the man's overalls and the Gothic window tracery above.`,
    funFacts: [
      'The woman is actually meant to be the man\'s daughter, not his wife.',
      'The models were Grant Wood\'s sister Nan and his dentist, Dr. Byron McKeeby.',
      'Iowans were initially offended, thinking Wood was mocking them.'
    ],
    tags: ['american', 'regionalism', 'oil', 'portrait', 'rural']
  }
]

await Artwork.insertMany(artworks)
console.log('Artworks seeded successfully.')
await mongoose.disconnect()
