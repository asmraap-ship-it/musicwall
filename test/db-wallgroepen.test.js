process.env.MUSICWALL_TEST_DB_PAD = ':memory:'

const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../database.js')
const {
  getAlleWallGroepen,
  maakWallGroep,
  verwijderWallGroep,
  hernoemWallGroep,
  verplaatsWallNaarGroep,
  herschikWallGroepen
} = require('../db/wallgroepen.js')
const { maakWall, getAlleWalls } = require('../db/walls.js')
const { maakAlbum, getAlbum, voegTrackToe, getTracksVoorAlbum } = require('../db/albums.js')

test.beforeEach(() => {
  db.exec('DELETE FROM videos; DELETE FROM walls; DELETE FROM wall_groepen; DELETE FROM album_tracks; DELETE FROM albums;')
})

test('maakWallGroep geeft volgorde = hoogste bestaande volgorde + 1', () => {
  maakWallGroep('Groep A')
  const info = maakWallGroep('Groep B')
  const groepen = getAlleWallGroepen()
  const groepB = groepen.find(g => g.id === Number(info.lastInsertRowid))
  assert.equal(groepB.volgorde, 2)
})

test('maakWallGroep zonder type geeft \'walls\' als default', () => {
  const info = maakWallGroep('Zonder type opgegeven')
  const groep = getAlleWallGroepen().find(g => g.id === Number(info.lastInsertRowid))
  assert.equal(groep.type, 'walls')
})

test('maakWallGroep met type \'albums\' slaat dat type op', () => {
  const info = maakWallGroep('Albumgroep', 'albums')
  const groep = getAlleWallGroepen().find(g => g.id === Number(info.lastInsertRowid))
  assert.equal(groep.type, 'albums')
})

test('hernoemWallGroep wijzigt de naam', () => {
  const info = maakWallGroep('Oude naam')
  hernoemWallGroep(info.lastInsertRowid, 'Nieuwe naam')
  assert.equal(getAlleWallGroepen()[0].naam, 'Nieuwe naam')
})

test('verplaatsWallNaarGroep koppelt een wall aan een groep', () => {
  const groepId = maakWallGroep('Groep').lastInsertRowid
  const wallId = maakWall('Wall').lastInsertRowid

  verplaatsWallNaarGroep(wallId, groepId)

  const wall = getAlleWalls().find(w => w.id === wallId)
  assert.equal(wall.groep_id, groepId)
})

test('herschikWallGroepen herordent volgens de meegegeven id-volgorde', () => {
  const a = maakWallGroep('A').lastInsertRowid
  const b = maakWallGroep('B').lastInsertRowid
  const c = maakWallGroep('C').lastInsertRowid

  herschikWallGroepen([c, a, b])

  const groepen = getAlleWallGroepen()
  assert.deepEqual(groepen.map(g => g.id), [c, a, b])
})

test('verwijderWallGroep ontkoppelt zijn walls (groep_id = NULL) maar verwijdert de walls zelf niet', () => {
  const groepId = maakWallGroep('Groep').lastInsertRowid
  const wallId = maakWall('Wall').lastInsertRowid
  verplaatsWallNaarGroep(wallId, groepId)

  verwijderWallGroep(groepId)

  assert.equal(getAlleWallGroepen().find(g => g.id === groepId), undefined)
  const wall = getAlleWalls().find(w => w.id === wallId)
  assert.ok(wall)
  assert.equal(wall.groep_id, null)
})

test('verwijderWallGroep verwijdert (i.t.t. walls) wél echt de albums en hun tracks in een albums-groep', () => {
  const groepId = maakWallGroep('Albumgroep', 'albums').lastInsertRowid
  const albumId = maakAlbum({ naam: 'Album', artiest: null, coverPad: null, groepId }).lastInsertRowid
  voegTrackToe({ albumId, artiest: null, titel: 'Track 1', lokaalPad: 'track1.mp3' })

  verwijderWallGroep(groepId)

  assert.equal(getAlleWallGroepen().find(g => g.id === groepId), undefined)
  assert.equal(getAlbum(albumId), undefined)
  assert.equal(getTracksVoorAlbum(albumId).length, 0)
})
