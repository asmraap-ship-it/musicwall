const db = require('../database.js')
const { getPlaylist } = require('./playlist.js')

function getOpgeslagenPlaylists() {
  return db.prepare(`
    SELECT p.id, p.naam, p.aangemaakt_op, COUNT(pv.id) as aantal
    FROM playlists p
    LEFT JOIN playlist_videos pv ON pv.playlist_id = p.id
    GROUP BY p.id
    ORDER BY p.id DESC
  `).all()
}

function bestaatPlaylistNaam(naam) {
  const rij = db.prepare('SELECT id FROM playlists WHERE naam = ? COLLATE NOCASE').get(naam)
  return !!rij
}

// Zoekt eerst in videos (wall-video's), en - alleen voor lokale bestanden, album_tracks hebben geen
// youtube-variant - ook in album_tracks als er geen match in videos was. Twee losse tabellen, dus bron_type
// vertelt slaPlaylistOp()/laadOpgeslagenPlaylist() welke van de twee id daadwerkelijk betekent.
function vindBron(item) {
  if (item.type === 'youtube') {
    if (!item.youtube_url) return null
    const rij = db.prepare('SELECT id FROM videos WHERE youtube_url = ?').get(item.youtube_url)
    return rij ? { id: rij.id, bronType: 'video' } : null
  }
  if (!item.lokaal_pad) return null
  const video = db.prepare('SELECT id FROM videos WHERE lokaal_pad = ?').get(item.lokaal_pad)
  if (video) return { id: video.id, bronType: 'video' }
  const track = db.prepare('SELECT id FROM album_tracks WHERE lokaal_pad = ?').get(item.lokaal_pad)
  return track ? { id: track.id, bronType: 'album_track' } : null
}

function slaPlaylistOp(naam) {
  const huidigeItems = getPlaylist()
  const gekoppeld = huidigeItems.map(item => ({ item, bron: vindBron(item) }))
  const overgeslagen = gekoppeld.filter(g => !g.bron).length

  const result = db.prepare('INSERT INTO playlists (naam) VALUES (?)').run(naam)
  const playlistId = result.lastInsertRowid

  const insert = db.prepare('INSERT INTO playlist_videos (playlist_id, video_id, volgorde, bron_type) VALUES (?, ?, ?, ?)')
  let volgorde = 1
  gekoppeld.filter(g => g.bron).forEach(g => {
    insert.run(playlistId, g.bron.id, volgorde++, g.bron.bronType)
  })

  return { id: playlistId, overgeslagen }
}

function laadOpgeslagenPlaylist(playlistId) {
  const videoRijen = db.prepare(`
    SELECT pv.id as playlist_video_id, pv.volgorde, v.id as video_id, v.type, v.lokaal_pad, v.youtube_url, v.artiest, v.titel, NULL as cover_pad
    FROM playlist_videos pv
    LEFT JOIN videos v ON v.id = pv.video_id
    WHERE pv.playlist_id = ? AND pv.bron_type = 'video'
  `).all(playlistId)

  // album_tracks zijn per definitie lokaal (nooit youtube) en hebben zelf geen cover_pad - die staat op het
  // album, gedeeld door alle tracks (zelfde patroon als db/zoeken.js's albumtrack-tak)
  const trackRijen = db.prepare(`
    SELECT pv.id as playlist_video_id, pv.volgorde, t.id as video_id, 'lokaal' as type, t.lokaal_pad, NULL as youtube_url, t.artiest, t.titel, a.cover_pad
    FROM playlist_videos pv
    LEFT JOIN album_tracks t ON t.id = pv.video_id
    LEFT JOIN albums a ON a.id = t.album_id
    WHERE pv.playlist_id = ? AND pv.bron_type = 'album_track'
  `).all(playlistId)

  const rijen = videoRijen.concat(trackRijen).sort((a, b) => a.volgorde - b.volgorde)

  const ontbrekend = rijen.filter(r => !r.video_id)
  if (ontbrekend.length > 0) {
    const verwijder = db.prepare('DELETE FROM playlist_videos WHERE id = ?')
    ontbrekend.forEach(r => verwijder.run(r.playlist_video_id))
  }

  const items = rijen.filter(r => r.video_id)
  return { items, overgeslagen: ontbrekend.length }
}

function verwijderOpgeslagenPlaylist(playlistId) {
  db.prepare('DELETE FROM playlist_videos WHERE playlist_id = ?').run(playlistId)
  return db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId)
}

module.exports = { getOpgeslagenPlaylists, slaPlaylistOp, laadOpgeslagenPlaylist, verwijderOpgeslagenPlaylist, bestaatPlaylistNaam }
