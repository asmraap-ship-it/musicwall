const db = require('../database.js')

function getAlleAlbums() {
  return db.prepare('SELECT * FROM albums ORDER BY volgorde').all()
}

function getAlbumsVoorGroep(groepId) {
  return db.prepare('SELECT * FROM albums WHERE groep_id = ? ORDER BY volgorde').all(groepId)
}

function getAlbum(id) {
  return db.prepare('SELECT * FROM albums WHERE id = ?').get(id)
}

function maakAlbum({ naam, artiest, coverPad, groepId }) {
  const hoogste = db.prepare('SELECT COALESCE(MAX(volgorde), 0) as max FROM albums').get()
  return db.prepare(`
    INSERT INTO albums (groep_id, naam, artiest, cover_pad, volgorde)
    VALUES (?, ?, ?, ?, ?)
  `).run(groepId || null, naam, artiest || null, coverPad || null, hoogste.max + 1)
}

function updateAlbum({ id, naam, artiest }) {
  return db.prepare('UPDATE albums SET naam = ?, artiest = ? WHERE id = ?').run(naam, artiest || null, id)
}

function verwijderAlbum(id) {
  db.prepare('DELETE FROM album_tracks WHERE album_id = ?').run(id)
  return db.prepare('DELETE FROM albums WHERE id = ?').run(id)
}

function verwijderAlbumsVoorGroep(groepId) {
  const albums = getAlbumsVoorGroep(groepId)
  albums.forEach(album => verwijderAlbum(album.id))
}

function herschikAlbums(volgordeArray) {
  const update = db.prepare('UPDATE albums SET volgorde = ? WHERE id = ?')
  volgordeArray.forEach((id, index) => {
    update.run(index + 1, id)
  })
}

function getTracksVoorAlbum(albumId) {
  return db.prepare('SELECT * FROM album_tracks WHERE album_id = ? ORDER BY volgorde').all(albumId)
}

function voegTrackToe({ albumId, artiest, titel, lokaalPad }) {
  const aantal = db.prepare('SELECT COUNT(*) as n FROM album_tracks WHERE album_id = ?').get(albumId)
  return db.prepare(`
    INSERT INTO album_tracks (album_id, artiest, titel, lokaal_pad, volgorde)
    VALUES (?, ?, ?, ?, ?)
  `).run(albumId, artiest || null, titel, lokaalPad, aantal.n + 1)
}

function verwijderTrack(id) {
  return db.prepare('DELETE FROM album_tracks WHERE id = ?').run(id)
}

function slaTrackVolgordeOp(volgordeArray) {
  const update = db.prepare('UPDATE album_tracks SET volgorde = ? WHERE id = ?')
  volgordeArray.forEach((id, index) => {
    update.run(index + 1, id)
  })
}

module.exports = {
  getAlleAlbums,
  getAlbumsVoorGroep,
  getAlbum,
  maakAlbum,
  updateAlbum,
  verwijderAlbum,
  verwijderAlbumsVoorGroep,
  herschikAlbums,
  getTracksVoorAlbum,
  voegTrackToe,
  verwijderTrack,
  slaTrackVolgordeOp
}
