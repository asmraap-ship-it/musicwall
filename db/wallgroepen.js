const db = require('../database.js')

function getAlleWallGroepen() {
  return db.prepare('SELECT * FROM wall_groepen ORDER BY volgorde').all()
}

function maakWallGroep(naam) {
  const hoogste = db.prepare('SELECT COALESCE(MAX(volgorde), 0) as max FROM wall_groepen').get()
  return db.prepare('INSERT INTO wall_groepen (naam, volgorde) VALUES (?, ?)').run(naam, hoogste.max + 1)
}

function verwijderWallGroep(id) {
  db.prepare('UPDATE walls SET groep_id = NULL WHERE groep_id = ?').run(id)
  return db.prepare('DELETE FROM wall_groepen WHERE id = ?').run(id)
}

function hernoemWallGroep(id, naam) {
  return db.prepare('UPDATE wall_groepen SET naam = ? WHERE id = ?').run(naam, id)
}

function verplaatsWallNaarGroep(wallId, groepId) {
  return db.prepare('UPDATE walls SET groep_id = ? WHERE id = ?').run(groepId || null, wallId)
}

function herschikWallGroepen(volgordeArray) {
  const update = db.prepare('UPDATE wall_groepen SET volgorde = ? WHERE id = ?')
  volgordeArray.forEach((id, index) => {
    update.run(index + 1, id)
  })
}

module.exports = { getAlleWallGroepen, maakWallGroep, verwijderWallGroep, hernoemWallGroep, verplaatsWallNaarGroep, herschikWallGroepen }
