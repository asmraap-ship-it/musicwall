const db = require('../database.js')
const { verwijderAlbumsVoorGroep } = require('./albums.js')

function getAlleWallGroepen() {
  return db.prepare('SELECT * FROM wall_groepen ORDER BY volgorde').all()
}

function maakWallGroep(naam, type) {
  const hoogste = db.prepare('SELECT COALESCE(MAX(volgorde), 0) as max FROM wall_groepen').get()
  return db.prepare('INSERT INTO wall_groepen (naam, volgorde, type) VALUES (?, ?, ?)').run(naam, hoogste.max + 1, type || 'walls')
}

function verwijderWallGroep(id) {
  db.prepare('UPDATE walls SET groep_id = NULL WHERE groep_id = ?').run(id)
  // walls blijven bestaan (alleen ongegroepeerd, ze landen vanzelf onder "Mijn walls"), maar voor albums
  // bestaat er geen "Mijn albums"-vangnet - een groep van het type 'albums' verwijderen moet de albums
  // (en hun tracks) er dus ook echt bij verwijderen, anders blijven ze onbereikbaar in de database staan
  verwijderAlbumsVoorGroep(id)
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
