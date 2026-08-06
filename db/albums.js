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

function maakAlbum({ naam, artiest, coverPad, groepId, genre, bronMap }) {
  const hoogste = db.prepare('SELECT COALESCE(MAX(volgorde), 0) as max FROM albums').get()
  return db.prepare(`
    INSERT INTO albums (groep_id, naam, artiest, cover_pad, genre, bron_map, volgorde)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(groepId || null, naam, artiest || null, coverPad || null, genre || null, bronMap || null, hoogste.max + 1)
}

// Duplicaat-check voor album-import: dezelfde map twee keer importeren maakte tot nu toe stilzwijgend een
// tweede, dubbel album aan. Gescoped tot dezelfde groep (net als de video-/media-duplicaat-checks) - bewust
// niet globaal, een gebruiker zou dezelfde map bewust in twee verschillende groepen kunnen willen hebben.
// Geeft de bestaande rij terug (niet enkel een boolean) zodat de bevestigingsmelding de naam van dat album
// kan tonen.
function vindAlbumVoorMap(groepId, bronMap) {
  return db.prepare('SELECT * FROM albums WHERE groep_id IS ? AND bron_map = ?').get(groepId || null, bronMap)
}

function updateAlbum({ id, naam, artiest, genre }) {
  return db.prepare('UPDATE albums SET naam = ?, artiest = ?, genre = ? WHERE id = ?').run(naam, artiest || null, genre || null, id)
}

function getAlleGenres() {
  return db.prepare("SELECT DISTINCT genre FROM albums WHERE genre IS NOT NULL AND genre <> '' ORDER BY genre COLLATE NOCASE").all().map(r => r.genre)
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

// Eenmalige, expliciete sortering (op artiest, dan albumnaam - de gangbare muziekbibliotheek-volgorde),
// géén doorlopende regel: nieuwe albums blijven gewoon achteraan toegevoegd (zelfde "nieuw = onderaan"-
// gedrag als walls/concerten), de gebruiker roept dit desgewenst opnieuw aan na een nieuwe import. Schrijft
// via de bestaande herschikAlbums() weg, dus identiek resultaat als handmatig naar deze volgorde slepen.
function sorteerAlbums(groepId) {
  const albums = getAlbumsVoorGroep(groepId)
  const gesorteerd = albums.slice().sort((a, b) => {
    const opArtiest = (a.artiest || '').localeCompare(b.artiest || '', undefined, { sensitivity: 'base', numeric: true })
    if (opArtiest !== 0) return opArtiest
    return (a.naam || '').localeCompare(b.naam || '', undefined, { sensitivity: 'base', numeric: true })
  })
  herschikAlbums(gesorteerd.map(a => a.id))
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
  vindAlbumVoorMap,
  updateAlbum,
  getAlleGenres,
  verwijderAlbum,
  verwijderAlbumsVoorGroep,
  herschikAlbums,
  sorteerAlbums,
  getTracksVoorAlbum,
  voegTrackToe,
  verwijderTrack,
  slaTrackVolgordeOp
}
