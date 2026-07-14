const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

function getUserDataPath() {
  try {
    const electron = require('electron')
    if (electron.app) {
      return electron.app.getPath('userData')
    }
    if (electron.remote && electron.remote.app) {
      return electron.remote.app.getPath('userData')
    }
  } catch (e) {}
  return path.join(require('os').homedir(), 'AppData', 'Roaming', 'Musicwall')
}

const userDataPath = getUserDataPath()
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true })
}

const db = new Database(path.join(userDataPath, 'musicwall.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS walls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    volgorde INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wall_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    artiest TEXT,
    titel TEXT NOT NULL,
    verhaal TEXT,
    tag TEXT,
    youtube_url TEXT,
    lokaal_pad TEXT,
    volgorde INTEGER DEFAULT 0,
    FOREIGN KEY (wall_id) REFERENCES walls(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS concerten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    artiest TEXT,
    datum TEXT,
    verhaal TEXT,
    volgorde INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS concert_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concert_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    bestand_pad TEXT NOT NULL,
    volgorde INTEGER DEFAULT 0,
    FOREIGN KEY (concert_id) REFERENCES concerten(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS wall_groepen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    volgorde INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    aangemaakt_op TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS playlist_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    video_id INTEGER NOT NULL,
    volgorde INTEGER DEFAULT 0
  );
`)

const wallKolommen = db.prepare("PRAGMA table_info(walls)").all().map(k => k.name)
if (!wallKolommen.includes('groep_id')) {
  db.exec('ALTER TABLE walls ADD COLUMN groep_id INTEGER')
}

const playlistVideosTabel = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='playlist_videos'").get()
if (playlistVideosTabel && playlistVideosTabel.sql.includes('FOREIGN KEY')) {
  // vroegere versie had FOREIGN KEY ... ON DELETE CASCADE op video_id, wat opgeslagen playlist-items
  // meteen liet verdwijnen zodra een video verwijderd werd - dat moet juist pas bij het laden gebeuren
  // (met melding), dus deze tabel mag geen (afgedwongen) FK naar videos hebben
  db.exec(`
    ALTER TABLE playlist_videos RENAME TO playlist_videos_oud;
    CREATE TABLE playlist_videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      video_id INTEGER NOT NULL,
      volgorde INTEGER DEFAULT 0
    );
    INSERT INTO playlist_videos (id, playlist_id, video_id, volgorde)
      SELECT id, playlist_id, video_id, volgorde FROM playlist_videos_oud;
    DROP TABLE playlist_videos_oud;
  `)
}

const aantalWalls = db.prepare('SELECT COUNT(*) as n FROM walls').get()
if (aantalWalls.n === 0) {
  db.prepare('INSERT INTO walls (naam, volgorde) VALUES (?, ?)').run('Mijn eerste wall', 1)
}

module.exports = db
