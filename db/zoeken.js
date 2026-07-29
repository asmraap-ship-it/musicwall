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
    youtubeUrl: v.youtube_url,
    coverPad: null
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
    youtubeUrl: m.type === 'youtube' ? m.bestand_pad : null,
    coverPad: null
  }))

  // Albumtracks zijn altijd lokale audiobestanden (nooit YouTube) - soort is daarom altijd 'lokaal',
  // waardoor deze resultaten vanzelf meelopen in alle bestaande soort==='lokaal'-afhandeling
  // (playlist-tabel, afspeelstatistieken, de alle/YouTube/lokaal-filters) zonder die code aan te passen.
  const trackResultaten = db.prepare(`
    SELECT album_tracks.artiest as track_artiest, album_tracks.titel, album_tracks.lokaal_pad,
           albums.naam as album_naam, albums.artiest as album_artiest, albums.cover_pad
    FROM album_tracks
    JOIN albums ON albums.id = album_tracks.album_id
    WHERE album_tracks.artiest LIKE ? OR album_tracks.titel LIKE ? OR albums.naam LIKE ?
    ORDER BY albums.naam, album_tracks.volgorde
  `).all(patroon, patroon, patroon).map(track => ({
    bron: 'album',
    soort: 'lokaal',
    artiest: track.track_artiest || track.album_artiest,
    titel: track.titel,
    herkomst: track.album_naam,
    lokaalPad: track.lokaal_pad,
    youtubeUrl: null,
    coverPad: track.cover_pad
  }))

  return [...videoResultaten, ...mediaResultaten, ...trackResultaten]
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
