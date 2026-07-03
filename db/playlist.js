const db = require('../database.js')

const kolommen = db.prepare("PRAGMA table_info(playlist)").all().map(k => k.name)

if (kolommen.length === 0) {
  db.exec(`
    CREATE TABLE playlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lokaal_pad TEXT NOT NULL,
      artiest TEXT,
      titel TEXT,
      volgorde INTEGER DEFAULT 0
    );
  `)
} else if (!kolommen.includes('lokaal_pad')) {
  db.exec(`ALTER TABLE playlist RENAME TO playlist_oud`)
  db.exec(`
    CREATE TABLE playlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lokaal_pad TEXT NOT NULL,
      artiest TEXT,
      titel TEXT,
      volgorde INTEGER DEFAULT 0
    );
  `)
  db.exec(`
    INSERT INTO playlist (lokaal_pad, artiest, titel, volgorde)
    SELECT videos.lokaal_pad, videos.artiest, videos.titel, playlist_oud.volgorde
    FROM playlist_oud
    JOIN videos ON playlist_oud.video_id = videos.id
    ORDER BY playlist_oud.volgorde
  `)
  db.exec(`DROP TABLE playlist_oud`)
}

function getPlaylist() {
  return db.prepare(`
    SELECT id as playlist_id, lokaal_pad, artiest, titel
    FROM playlist
    ORDER BY volgorde
  `).all()
}

function voegToeAanPlaylist({ lokaalPad, artiest, titel }) {
  const bestaat = db.prepare('SELECT id FROM playlist WHERE lokaal_pad = ?').get(lokaalPad)
  if (bestaat) return

  const hoogste = db.prepare('SELECT COALESCE(MAX(volgorde), 0) as max FROM playlist').get()
  return db.prepare('INSERT INTO playlist (lokaal_pad, artiest, titel, volgorde) VALUES (?, ?, ?, ?)').run(lokaalPad, artiest || null, titel || null, hoogste.max + 1)
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
