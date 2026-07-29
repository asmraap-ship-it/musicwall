const db = require('../database.js')

const kolommen = db.prepare("PRAGMA table_info(playlist)").all().map(k => k.name)

if (kolommen.length === 0) {
  db.exec(`
    CREATE TABLE playlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'lokaal',
      lokaal_pad TEXT,
      youtube_url TEXT,
      artiest TEXT,
      titel TEXT,
      cover_pad TEXT,
      volgorde INTEGER DEFAULT 0
    );
  `)
} else if (!kolommen.includes('lokaal_pad')) {
  db.exec(`ALTER TABLE playlist RENAME TO playlist_oud`)
  db.exec(`
    CREATE TABLE playlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'lokaal',
      lokaal_pad TEXT,
      youtube_url TEXT,
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
} else if (!kolommen.includes('type')) {
  db.exec(`ALTER TABLE playlist RENAME TO playlist_oud`)
  db.exec(`
    CREATE TABLE playlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'lokaal',
      lokaal_pad TEXT,
      youtube_url TEXT,
      artiest TEXT,
      titel TEXT,
      volgorde INTEGER DEFAULT 0
    );
  `)
  db.exec(`
    INSERT INTO playlist (id, type, lokaal_pad, artiest, titel, volgorde)
    SELECT id, 'lokaal', lokaal_pad, artiest, titel, volgorde FROM playlist_oud
  `)
  db.exec(`DROP TABLE playlist_oud`)
}

if (!db.prepare("PRAGMA table_info(playlist)").all().map(k => k.name).includes('cover_pad')) {
  db.exec('ALTER TABLE playlist ADD COLUMN cover_pad TEXT')
}

function getPlaylist() {
  return db.prepare(`
    SELECT id as playlist_id, type, lokaal_pad, youtube_url, artiest, titel, cover_pad
    FROM playlist
    ORDER BY volgorde
  `).all()
}

function voegToeAanPlaylist({ type, lokaalPad, youtubeUrl, artiest, titel, coverPad }) {
  const soort = type === 'youtube' ? 'youtube' : 'lokaal'
  const sleutel = soort === 'youtube' ? youtubeUrl : lokaalPad
  if (!sleutel) return

  const bestaat = soort === 'youtube'
    ? db.prepare('SELECT id FROM playlist WHERE youtube_url = ?').get(sleutel)
    : db.prepare('SELECT id FROM playlist WHERE lokaal_pad = ?').get(sleutel)
  if (bestaat) return

  const hoogste = db.prepare('SELECT COALESCE(MAX(volgorde), 0) as max FROM playlist').get()
  return db.prepare('INSERT INTO playlist (type, lokaal_pad, youtube_url, artiest, titel, cover_pad, volgorde) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(soort, soort === 'lokaal' ? lokaalPad : null, soort === 'youtube' ? youtubeUrl : null, artiest || null, titel || null, coverPad || null, hoogste.max + 1)
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
