const db = require('../database.js')

function getAlleConcerten() {
  return db.prepare('SELECT * FROM concerten ORDER BY datum DESC, volgorde').all()
}

function getConcert(id) {
  return db.prepare('SELECT * FROM concerten WHERE id = ?').get(id)
}

function maakConcert({ naam, artiest, datum, verhaal }) {
  const aantal = db.prepare('SELECT COUNT(*) as n FROM concerten').get()
  return db.prepare(`
    INSERT INTO concerten (naam, artiest, datum, verhaal, volgorde)
    VALUES (?, ?, ?, ?, ?)
  `).run(naam, artiest || null, datum || null, verhaal || null, aantal.n + 1)
}

function updateConcert({ id, naam, artiest, datum, verhaal }) {
  return db.prepare(`
    UPDATE concerten SET naam = ?, artiest = ?, datum = ?, verhaal = ? WHERE id = ?
  `).run(naam, artiest || null, datum || null, verhaal || null, id)
}

function verwijderConcert(id) {
  return db.prepare('DELETE FROM concerten WHERE id = ?').run(id)
}

function herschikConcerten(volgordeArray) {
  const update = db.prepare('UPDATE concerten SET volgorde = ? WHERE id = ?')
  volgordeArray.forEach((id, index) => {
    update.run(index + 1, id)
  })
}

function getMediaVoorConcert(concertId) {
  return db.prepare('SELECT * FROM concert_media WHERE concert_id = ? ORDER BY volgorde').all(concertId)
}

function voegMediaToe({ concertId, type, bestandPad }) {
  const aantal = db.prepare('SELECT COUNT(*) as n FROM concert_media WHERE concert_id = ?').get(concertId)
  return db.prepare(`
    INSERT INTO concert_media (concert_id, type, bestand_pad, volgorde)
    VALUES (?, ?, ?, ?)
  `).run(concertId, type, bestandPad, aantal.n + 1)
}

function verwijderMedia(id) {
  return db.prepare('DELETE FROM concert_media WHERE id = ?').run(id)
}

function slaMediaVolgordeOp(volgordeArray) {
  const update = db.prepare('UPDATE concert_media SET volgorde = ? WHERE id = ?')
  volgordeArray.forEach((id, index) => {
    update.run(index + 1, id)
  })
}

module.exports = {
  getAlleConcerten,
  getConcert,
  maakConcert,
  updateConcert,
  verwijderConcert,
  herschikConcerten,
  getMediaVoorConcert,
  voegMediaToe,
  verwijderMedia,
  slaMediaVolgordeOp
}