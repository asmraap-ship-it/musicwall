const db = require('../database.js')

function zoekBibliotheek(term) {
  const patroon = '%' + term + '%'

  const videoResultaten = db.prepare(`
    SELECT videos.type, videos.artiest, videos.titel,
           videos.youtube_url, videos.lokaal_pad, walls.naam as herkomst
    FROM videos
    JOIN walls ON walls.id = videos.wall_id
    WHERE videos.artiest LIKE ? OR videos.titel LIKE ? OR videos.tag LIKE ?
    ORDER BY videos.titel
  `).all(patroon, patroon, patroon).map(v => ({
    bron: 'wall',
    soort: v.type === 'youtube' ? 'youtube' : 'lokaal',
    artiest: v.artiest,
    titel: v.titel,
    herkomst: v.herkomst,
    lokaalPad: v.lokaal_pad,
    youtubeUrl: v.youtube_url
  }))

  const mediaResultaten = db.prepare(`
    SELECT concert_media.type, concert_media.bestand_pad,
           concerten.artiest as artiest, concerten.naam as titel
    FROM concert_media
    JOIN concerten ON concerten.id = concert_media.concert_id
    WHERE (concerten.artiest LIKE ? OR concerten.naam LIKE ?)
      AND concert_media.type IN ('video', 'youtube')
    ORDER BY concerten.naam
  `).all(patroon, patroon).map(m => ({
    bron: 'concert',
    soort: m.type === 'youtube' ? 'youtube' : 'lokaal',
    artiest: m.artiest,
    titel: m.titel,
    herkomst: m.titel,
    lokaalPad: m.type === 'youtube' ? null : m.bestand_pad,
    youtubeUrl: m.type === 'youtube' ? m.bestand_pad : null
  }))

  return [...videoResultaten, ...mediaResultaten]
}

module.exports = { zoekBibliotheek }
