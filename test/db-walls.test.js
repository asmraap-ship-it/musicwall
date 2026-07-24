process.env.MUSICWALL_TEST_DB_PAD = ':memory:'

const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../database.js')
const { getAlleWalls, maakWall, verwijderWall, hernoemWall, herschikWalls } = require('../db/walls.js')
const { voegVideoToe, getVideosVoorWall } = require('../db/videos.js')

test.beforeEach(() => {
  db.exec('DELETE FROM videos; DELETE FROM walls;')
})

test('maakWall geeft de wall volgorde = aantal bestaande walls + 1', () => {
  maakWall('Eerste')
  const info = maakWall('Tweede')
  const walls = getAlleWalls()
  const tweede = walls.find(w => w.id === Number(info.lastInsertRowid))
  assert.equal(tweede.volgorde, 2)
})

test('getAlleWalls geeft walls terug gesorteerd op volgorde', () => {
  maakWall('A')
  maakWall('B')
  maakWall('C')
  const walls = getAlleWalls()
  assert.deepEqual(walls.map(w => w.naam), ['A', 'B', 'C'])
})

test('hernoemWall wijzigt de naam', () => {
  const info = maakWall('Oude naam')
  hernoemWall(info.lastInsertRowid, 'Nieuwe naam')
  const walls = getAlleWalls()
  assert.equal(walls[0].naam, 'Nieuwe naam')
})

test('herschikWalls herordent volgens de meegegeven id-volgorde', () => {
  const a = maakWall('A').lastInsertRowid
  const b = maakWall('B').lastInsertRowid
  const c = maakWall('C').lastInsertRowid

  herschikWalls([c, a, b])

  const walls = getAlleWalls()
  assert.deepEqual(walls.map(w => w.id), [c, a, b])
})

test('verwijderWall cascadeert naar zijn video\'s', () => {
  const wallId = maakWall('Met video\'s').lastInsertRowid
  voegVideoToe({ wallId, type: 'youtube', artiest: 'Artiest', titel: 'Titel', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=1' })
  voegVideoToe({ wallId, type: 'youtube', artiest: 'Artiest 2', titel: 'Titel 2', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=2' })

  assert.equal(getVideosVoorWall(wallId).length, 2)

  verwijderWall(wallId)

  assert.equal(getAlleWalls().find(w => w.id === wallId), undefined)
  assert.equal(getVideosVoorWall(wallId).length, 0)
})
