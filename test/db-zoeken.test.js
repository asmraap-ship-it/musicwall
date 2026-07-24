process.env.MUSICWALL_TEST_DB_PAD = ':memory:'

const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../database.js')
const { maakWall } = require('../db/walls.js')
const { voegVideoToe } = require('../db/videos.js')
const { zoekBibliotheek } = require('../db/zoeken.js')

test.beforeEach(() => {
  db.exec('DELETE FROM videos; DELETE FROM walls; DELETE FROM concert_media; DELETE FROM concerten;')
})

test('zoekBibliotheek vindt een video op artiest', () => {
  const wallId = maakWall('Testwall').lastInsertRowid
  voegVideoToe({ wallId, type: 'youtube', artiest: 'Queen', titel: 'Bohemian Rhapsody', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=1' })

  const resultaten = zoekBibliotheek('Queen')
  assert.equal(resultaten.length, 1)
  assert.equal(resultaten[0].titel, 'Bohemian Rhapsody')
})

test('zoekBibliotheek vindt een video op titel', () => {
  const wallId = maakWall('Testwall').lastInsertRowid
  voegVideoToe({ wallId, type: 'youtube', artiest: 'Queen', titel: 'Bohemian Rhapsody', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=1' })

  const resultaten = zoekBibliotheek('Rhapsody')
  assert.equal(resultaten.length, 1)
})

test('zoekBibliotheek vindt een video die alleen via de tag matcht', () => {
  const wallId = maakWall('Testwall').lastInsertRowid
  voegVideoToe({ wallId, type: 'youtube', artiest: 'Onbekend', titel: 'Nummer zonder titelmatch', verhaal: null, tag: 'bruiloft', youtubeUrl: 'https://youtube.com/watch?v=2' })

  const resultaten = zoekBibliotheek('bruiloft')
  assert.equal(resultaten.length, 1)
  assert.equal(resultaten[0].titel, 'Nummer zonder titelmatch')
})

test('zoekBibliotheek geeft niets terug bij geen match', () => {
  const wallId = maakWall('Testwall').lastInsertRowid
  voegVideoToe({ wallId, type: 'youtube', artiest: 'Queen', titel: 'Bohemian Rhapsody', verhaal: null, tag: 'rock', youtubeUrl: 'https://youtube.com/watch?v=1' })

  const resultaten = zoekBibliotheek('nergensvindbaar')
  assert.equal(resultaten.length, 0)
})
