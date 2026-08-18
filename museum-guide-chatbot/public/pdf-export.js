// === pdf-export.js ===
// Client-side PDF generation for the Musée Personal Gallery.
//
// Why client-side: the gallery is already fully loaded in the browser
// (images, summaries, notes), so building the PDF here avoids re-fetching
// every image server-side and keeps PDF buffers off the Express process.
//
// We use jsPDF directly (not html2canvas) so the output is vector text —
// crisp and selectable — and so cross-origin images (e.g. Wikipedia
// thumbnails) don't taint a canvas the way html2canvas would.
//
// Depends on the global `jspdf` UMD bundle loaded via CDN in gallery.html.

const PAGE = {
  format: 'a4',
  unit: 'mm',
  width: 210,
  height: 297,
  margin: 16,
}

// Two artworks per page → each block gets roughly half the printable height.
const ARTWORKS_PER_PAGE = 2

// Palette mirrors the gallery's dark-on-gold theme, adapted for print (light bg).
const COLOR = {
  ink: [28, 28, 28],
  muted: [120, 113, 108],
  accent: [168, 137, 50],
  rule: [220, 216, 208],
  summaryBg: [248, 245, 238],
}

const MAX_SUMMARY_CHARS = 600
const MAX_NOTE_CHARS = 400

// 1x1 transparent PNG used when an image is missing or fails to load.
const PLACEHOLDER_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/**
 * Load an image URL into a data-URL via canvas so jsPDF can embed it.
 * Returns { dataUrl, width, height } or null on any failure (missing,
 * CORS-blocked, decode error). Callers fall back to a placeholder box.
 */
function loadImageAsDataUrl(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null)

    const img = new Image()
    img.crossOrigin = 'anonymous'

    const timeout = setTimeout(() => resolve(null), 8000)

    img.onload = () => {
      clearTimeout(timeout)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.85),
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      } catch {
        // toDataURL throws if the canvas is tainted (CORS without ACAO header).
        resolve(null)
      }
    }

    img.onerror = () => {
      clearTimeout(timeout)
      resolve(null)
    }

    img.src = url
  })
}

function truncate(text, max) {
  if (!text) return ''
  const trimmed = String(text).trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 1).trimEnd() + '…'
}

function formatDate(d) {
  const date = d ? new Date(d) : new Date()
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function sanitizeFilenamePart(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'guest'
}

/**
 * Generate and trigger download of a gallery PDF.
 *
 * @param {Array} artworks  savedArtworks array from GET /api/gallery
 * @param {string} username for the filename and header
 */
export async function exportGalleryToPdf(artworks, username) {
  const { jsPDF } = window.jspdf
  if (!jsPDF) throw new Error('jsPDF library is not loaded.')

  const doc = new jsPDF({ unit: PAGE.unit, format: PAGE.format })
  const contentWidth = PAGE.width - PAGE.margin * 2

  // Pre-load all images concurrently so layout isn't blocked one-by-one.
  const items = artworks.map((item) => {
    const art = item.artworkId || {}
    return {
      title: art.title || 'Untitled',
      artist: art.artist || 'Unknown artist',
      movement: art.movement || '',
      year: art.year || '',
      museum: art.museum || '',
      summary: item.aiSummary || '',
      note: item.personalNote || '',
      savedAt: item.savedAt,
      imageUrl: item.imageUrl || art.imageUrl || '',
    }
  })

  const images = await Promise.all(items.map((it) => loadImageAsDataUrl(it.imageUrl)))

  // --- Header (drawn once on the first page) ---
  let y = PAGE.margin

  doc.setFont('times', 'normal')
  doc.setFontSize(24)
  doc.setTextColor(...COLOR.ink)
  doc.text('My Gallery — Musée', PAGE.margin, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLOR.muted)
  doc.text(
    `${username || 'Guest'}  ·  ${items.length} artwork${items.length === 1 ? '' : 's'}  ·  ${formatDate()}`,
    PAGE.margin,
    y + 13
  )

  doc.setDrawColor(...COLOR.accent)
  doc.setLineWidth(0.4)
  doc.line(PAGE.margin, y + 17, PAGE.width - PAGE.margin, y + 17)

  y += 26

  // Vertical budget for one artwork block (half the page minus the header band).
  const usableHeight = PAGE.height - PAGE.margin - 26
  const blockHeight = usableHeight / ARTWORKS_PER_PAGE

  items.forEach((it, i) => {
    // Page break: new page after every ARTWORKS_PER_PAGE blocks.
    if (i > 0 && i % ARTWORKS_PER_PAGE === 0) {
      doc.addPage()
      y = PAGE.margin
    }

    drawArtworkBlock(doc, it, images[i], y, contentWidth)
    y += blockHeight
  })

  const filename = `muse-gallery-${sanitizeFilenamePart(username)}-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}

/**
 * Draw a single artwork block: image on the left, text on the right.
 */
function drawArtworkBlock(doc, it, image, top, contentWidth) {
  const imgW = 50
  const imgH = 50
  const x = PAGE.margin
  const textX = x + imgW + 8
  const textWidth = contentWidth - imgW - 8

  // --- Image (or placeholder box) ---
  if (image && image.dataUrl) {
    // Fit within imgW x imgH preserving aspect ratio.
    const ratio = image.width / image.height
    let w = imgW
    let h = imgW / ratio
    if (h > imgH) {
      h = imgH
      w = imgH * ratio
    }
    const offX = x + (imgW - w) / 2
    const offY = top + (imgH - h) / 2
    try {
      doc.addImage(image.dataUrl, 'JPEG', offX, offY, w, h)
    } catch {
      drawPlaceholder(doc, x, top, imgW, imgH)
    }
  } else {
    drawPlaceholder(doc, x, top, imgW, imgH)
  }

  let ty = top + 4

  // --- Title ---
  doc.setFont('times', 'italic')
  doc.setFontSize(15)
  doc.setTextColor(...COLOR.ink)
  const titleLines = doc.splitTextToSize(it.title, textWidth)
  doc.text(titleLines.slice(0, 2), textX, ty)
  ty += titleLines.slice(0, 2).length * 6 + 1

  // --- Artist ---
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...COLOR.accent)
  doc.text(it.artist, textX, ty)
  ty += 5

  // --- Meta line: movement · year · museum ---
  const meta = [it.movement, it.year, it.museum].filter(Boolean).join('  ·  ')
  if (meta) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...COLOR.muted)
    doc.text(meta.toUpperCase(), textX, ty)
    ty += 5
  }

  // --- AI summary ---
  if (it.summary) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLOR.accent)
    doc.text('AI SUMMARY', textX, ty)
    ty += 4

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...COLOR.ink)
    const summaryLines = doc.splitTextToSize(truncate(it.summary, MAX_SUMMARY_CHARS), textWidth)
    // Cap lines so the block can't overflow into the next artwork.
    const shown = summaryLines.slice(0, 6)
    doc.text(shown, textX, ty)
    ty += shown.length * 4.5 + 2
  }

  // --- Personal note ---
  if (it.note) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.muted)
    const noteLines = doc.splitTextToSize('Note: ' + truncate(it.note, MAX_NOTE_CHARS), textWidth)
    doc.text(noteLines.slice(0, 3), textX, ty)
  }
}

function drawPlaceholder(doc, x, y, w, h) {
  doc.setFillColor(...COLOR.summaryBg)
  doc.setDrawColor(...COLOR.rule)
  doc.setLineWidth(0.3)
  doc.rect(x, y, w, h, 'FD')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.muted)
  doc.text('No image', x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
}
