process.env.MUSICWALL_TEST_DB_PAD = ':memory:'

const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../database.js')
const { maakWallGroep } = require('../db/wallgroepen.js')
const {
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
} = require('../db/albums.js')

test.beforeEach(() => {
  db.exec('DELETE FROM album_tracks; DELETE FROM albums; DELETE FROM wall_groepen;')
})

test('maakAlbum / getAlleAlbums geeft volgorde = hoogste bestaande volgorde + 1', () => {
  maakAlbum({ naam: 'Album A', artiest: 'X', coverPad: null, groepId: null })
  maakAlbum({ naam: 'Album B', artiest: 'X', coverPad: null, groepId: null })

  const albums = getAlleAlbums()
  assert.deepEqual(albums.map(a => a.naam), ['Album A', 'Album B'])
  assert.deepEqual(albums.map(a => a.volgorde), [1, 2])
})

test('getAlbumsVoorGroep geeft alleen albums van die groep', () => {
  const groepId = maakWallGroep('Rock albums', 'albums').lastInsertRowid
  maakAlbum({ naam: 'In de groep', artiest: null, coverPad: null, groepId })
  maakAlbum({ naam: 'Ongegroepeerd', artiest: null, coverPad: null, groepId: null })

  const albums = getAlbumsVoorGroep(groepId)
  assert.deepEqual(albums.map(a => a.naam), ['In de groep'])
})

test('getAlbum geeft een enkel album terug op id', () => {
  const albumId = maakAlbum({ naam: 'Innuendo', artiest: 'Queen', coverPad: 'C:/covers/innuendo.jpg', groepId: null }).lastInsertRowid

  const album = getAlbum(albumId)
  assert.equal(album.naam, 'Innuendo')
  assert.equal(album.artiest, 'Queen')
  assert.equal(album.cover_pad, 'C:/covers/innuendo.jpg')
})

test('herschikAlbums herordent volgens de meegegeven id-volgorde', () => {
  const a = maakAlbum({ naam: 'A', artiest: null, coverPad: null, groepId: null }).lastInsertRowid
  const b = maakAlbum({ naam: 'B', artiest: null, coverPad: null, groepId: null }).lastInsertRowid

  herschikAlbums([b, a])

  const albums = getAlleAlbums()
  assert.deepEqual(albums.map(al => al.id), [b, a])
})

test('track-CRUD: toevoegen (volgorde = aantal + 1), ophalen, herordenen en verwijderen', () => {
  const albumId = maakAlbum({ naam: 'Album', artiest: null, coverPad: null, groepId: null }).lastInsertRowid
  const t1 = voegTrackToe({ albumId, artiest: 'X', titel: 'Track 1', lokaalPad: 'track1.mp3' }).lastInsertRowid
  const t2 = voegTrackToe({ albumId, artiest: 'X', titel: 'Track 2', lokaalPad: 'track2.mp3' }).lastInsertRowid

  assert.deepEqual(getTracksVoorAlbum(albumId).map(t => t.id), [t1, t2])

  slaTrackVolgordeOp([t2, t1])
  assert.deepEqual(getTracksVoorAlbum(albumId).map(t => t.id), [t2, t1])

  verwijderTrack(t1)
  assert.deepEqual(getTracksVoorAlbum(albumId).map(t => t.id), [t2])
})

test('verwijderAlbum cascadeert naar zijn album_tracks', () => {
  const albumId = maakAlbum({ naam: 'Te verwijderen', artiest: null, coverPad: null, groepId: null }).lastInsertRowid
  voegTrackToe({ albumId, artiest: null, titel: 'Track 1', lokaalPad: 'track1.mp3' })
  voegTrackToe({ albumId, artiest: null, titel: 'Track 2', lokaalPad: 'track2.mp3' })

  assert.equal(getTracksVoorAlbum(albumId).length, 2)

  verwijderAlbum(albumId)

  assert.equal(getAlbum(albumId), undefined)
  assert.equal(getTracksVoorAlbum(albumId).length, 0)
})

test('updateAlbum wijzigt naam en artiest', () => {
  const albumId = maakAlbum({ naam: 'Oude naam', artiest: 'Oude artiest', coverPad: null, groepId: null }).lastInsertRowid

  updateAlbum({ id: albumId, naam: 'Nieuwe naam', artiest: 'Nieuwe artiest' })

  const album = getAlbum(albumId)
  assert.equal(album.naam, 'Nieuwe naam')
  assert.equal(album.artiest, 'Nieuwe artiest')
})

test('verwijderAlbumsVoorGroep verwijdert alle albums (en hun tracks) van die groep, andere groepen blijven ongemoeid', () => {
  const groepId = maakWallGroep('Te verwijderen groep', 'albums').lastInsertRowid
  const andereGroepId = maakWallGroep('Andere groep', 'albums').lastInsertRowid

  const albumId = maakAlbum({ naam: 'In de groep', artiest: null, coverPad: null, groepId }).lastInsertRowid
  voegTrackToe({ albumId, artiest: null, titel: 'Track 1', lokaalPad: 'track1.mp3' })
  const andereAlbumId = maakAlbum({ naam: 'In een andere groep', artiest: null, coverPad: null, groepId: andereGroepId }).lastInsertRowid

  verwijderAlbumsVoorGroep(groepId)

  assert.equal(getAlbum(albumId), undefined)
  assert.equal(getTracksVoorAlbum(albumId).length, 0)
  assert.ok(getAlbum(andereAlbumId))
})
