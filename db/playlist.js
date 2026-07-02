const db = require('../database.js')

db.exec(`
  CREATE TABLE IF NOT EXISTS playlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    volgorde INTEGER DEFAULT 0,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );
`)

function getPlaylist() {
  return db.prepare(`
    SELECT playlist.id as playlist_id, videos.*
    FROM playlist
    JOIN videos ON playlist.video_id = videos.id
    ORDER BY playlist.volgorde
  `).all()
}

function voegToeAanPlaylist(videoId) {
  const bestaat = db.prepare('SELECT id FROM playlist WHERE video_id = ?').get(videoId)
  if (bestaat) return

  const aantal = db.prepare('SELECT COUNT(*) as n FROM playlist').get()
  return db.prepare('INSERT INTO playlist (video_id, volgorde) VALUES (?, ?)').run(videoId, aantal.n + 1)
}

function verwijderUitPlaylist(playlistId) {
  return db.prepare('DELETE FROM playlist WHERE id = ?').run(playlistId)
}

function herschikPlaylist(volgordeArray) {
  const update = db.prepare('UPDATE playlist SET volgorde = ? WHERE id = ?')
  volgordeArray.forEach((playlistId, index) => {
    update.run(index + 1, playlistId)
  })
}

function leegPlaylist() {
  return db.prepare('DELETE FROM playlist').run()
}

module.exports = { getPlaylist, voegToeAanPlaylist, verwijderUitPlaylist, leegPlaylist, herschikPlaylist }