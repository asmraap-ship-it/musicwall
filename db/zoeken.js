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

// Alle YouTube-video's uit zowel walls als concertervaringen, met id + herkomst - gebruikt door het
// kapotte-links-overzichtsscherm (help.html) om proactief te kunnen controleren en losse items te
// kunnen verwijderen. Losse functie i.p.v. zoekBibliotheek('') hergebruiken: die geeft geen id's terug
// (nodig voor de verwijderknop) en '%%' als LIKE-patroon zou een verwarrende impliciete aanname zijn.
function alleYoutubeItems() {
  const videoResultaten = db.prepare(`
    SELECT videos.id, videos.artiest, videos.titel, videos.youtube_url, walls.naam as herkomst
    FROM videos
    JOIN walls ON walls.id = videos.wall_id
    WHERE videos.type = 'youtube'
    ORDER BY videos.titel
  `).all().map(v => ({
    bron: 'wall',
    id: v.id,
    artiest: v.artiest,
    titel: v.titel,
    herkomst: v.herkomst,
    youtubeUrl: v.youtube_url
  }))

  const mediaResultaten = db.prepare(`
    SELECT concert_media.id, concerten.artiest as artiest, concerten.naam as titel, concert_media.bestand_pad
    FROM concert_media
    JOIN concerten ON concerten.id = concert_media.concert_id
    WHERE concert_media.type = 'youtube'
    ORDER BY concerten.naam
  `).all().map(m => ({
    bron: 'concert',
    id: m.id,
    artiest: m.artiest,
    titel: m.titel,
    herkomst: m.titel,
    youtubeUrl: m.bestand_pad
  }))

  return [...videoResultaten, ...mediaResultaten]
}

module.exports = { zoekBibliotheek, alleYoutubeItems }
