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

function vindVideoId(item) {
  if (item.type === 'youtube') {
    if (!item.youtube_url) return null
    const rij = db.prepare('SELECT id FROM videos WHERE youtube_url = ?').get(item.youtube_url)
    return rij ? rij.id : null
  }
  if (!item.lokaal_pad) return null
  const rij = db.prepare('SELECT id FROM videos WHERE lokaal_pad = ?').get(item.lokaal_pad)
  return rij ? rij.id : null
}

function slaPlaylistOp(naam) {
  const huidigeItems = getPlaylist()
  const gekoppeld = huidigeItems.map(item => ({ item, videoId: vindVideoId(item) }))
  const overgeslagen = gekoppeld.filter(g => !g.videoId).length

  const result = db.prepare('INSERT INTO playlists (naam) VALUES (?)').run(naam)
  const playlistId = result.lastInsertRowid

  const insert = db.prepare('INSERT INTO playlist_videos (playlist_id, video_id, volgorde) VALUES (?, ?, ?)')
  let volgorde = 1
  gekoppeld.filter(g => g.videoId).forEach(g => {
    insert.run(playlistId, g.videoId, volgorde++)
  })

  return { id: playlistId, overgeslagen }
}

function laadOpgeslagenPlaylist(playlistId) {
  const rijen = db.prepare(`
    SELECT pv.id as playlist_video_id, v.id as video_id, v.type, v.lokaal_pad, v.youtube_url, v.artiest, v.titel
    FROM playlist_videos pv
    LEFT JOIN videos v ON v.id = pv.video_id
    WHERE pv.playlist_id = ?
    ORDER BY pv.volgorde
  `).all(playlistId)

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
