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
`)

const aantalWalls = db.prepare('SELECT COUNT(*) as n FROM walls').get()
if (aantalWalls.n === 0) {
  db.prepare('INSERT INTO walls (naam, volgorde) VALUES (?, ?)').run('Mijn eerste wall', 1)
}

module.exports = db
