const db = require('../database.js')

function getAlleWalls() {
  return db.prepare('SELECT * FROM walls ORDER BY volgorde').all()
}

function maakWall(naam) {
  const aantal = db.prepare('SELECT COUNT(*) as n FROM walls').get()
  return db.prepare('INSERT INTO walls (naam, volgorde) VALUES (?, ?)')
    .run(naam, aantal.n + 1)
}

function verwijderWall(id) {
  db.prepare('DELETE FROM videos WHERE wall_id = ?').run(id)
  return db.prepare('DELETE FROM walls WHERE id = ?').run(id)
}

function hernoemWall(id, naam) {
  return db.prepare('UPDATE walls SET naam = ? WHERE id = ?').run(naam, id)
}

module.exports = { getAlleWalls, maakWall, verwijderWall, hernoemWall }