const db = require('../database.js')

function getVideosVoorWall(wallId) {
  return db.prepare('SELECT * FROM videos WHERE wall_id = ? ORDER BY volgorde').all(wallId)
}

function getVideo(id) {
  return db.prepare('SELECT * FROM videos WHERE id = ?').get(id)
}

function voegVideoToe({ wallId, type, artiest, titel, verhaal, tag, youtubeUrl, lokaalPad }) {
  const aantal = db.prepare('SELECT COUNT(*) as n FROM videos WHERE wall_id = ?').get(wallId)
  return db.prepare(`
    INSERT INTO videos (wall_id, type, artiest, titel, verhaal, tag, youtube_url, lokaal_pad, volgorde)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(wallId, type, artiest, titel, verhaal, tag, youtubeUrl || null, lokaalPad || null, aantal.n + 1)
}

// Duplicaat-check is bewust gescoped tot dezelfde wall, niet globaal: hetzelfde nummer kan legitiem in
// meerdere walls staan (ander levensmoment, ander verhaal) - alleen twéé keer in dezelfde wall is bijna
// altijd een vergissing. Match op het exacte pad/de exacte url, geen titel-fuzzy-matching.
function bestaatVideoInWall(wallId, { lokaalPad, youtubeUrl }) {
  if (lokaalPad) {
    return !!db.prepare('SELECT 1 FROM videos WHERE wall_id = ? AND lokaal_pad = ?').get(wallId, lokaalPad)
  }
  if (youtubeUrl) {
    return !!db.prepare('SELECT 1 FROM videos WHERE wall_id = ? AND youtube_url = ?').get(wallId, youtubeUrl)
  }
  return false
}

function verwijderVideo(id) {
  return db.prepare('DELETE FROM videos WHERE id = ?').run(id)
}

function updateVideo({ id, artiest, titel, verhaal, tag }) {
  return db.prepare(`
    UPDATE videos SET artiest = ?, titel = ?, verhaal = ?, tag = ? WHERE id = ?
  `).run(artiest, titel, verhaal, tag, id)
}

function verplaatsVideo(id, nieuweWallId) {
  return db.prepare('UPDATE videos SET wall_id = ? WHERE id = ?').run(nieuweWallId, id)
}

function slaVolgordeOp(volgordeArray) {
  const update = db.prepare('UPDATE videos SET volgorde = ? WHERE id = ?')
  volgordeArray.forEach((id, index) => {
    update.run(index + 1, id)
  })
}

module.exports = { getVideosVoorWall, getVideo, voegVideoToe, bestaatVideoInWall, verwijderVideo, updateVideo, verplaatsVideo, slaVolgordeOp }
