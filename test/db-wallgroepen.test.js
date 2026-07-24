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

test.beforeEach(() => {
  db.exec('DELETE FROM videos; DELETE FROM walls; DELETE FROM wall_groepen;')
})

test('maakWallGroep geeft volgorde = hoogste bestaande volgorde + 1', () => {
  maakWallGroep('Groep A')
  const info = maakWallGroep('Groep B')
  const groepen = getAlleWallGroepen()
  const groepB = groepen.find(g => g.id === Number(info.lastInsertRowid))
  assert.equal(groepB.volgorde, 2)
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
