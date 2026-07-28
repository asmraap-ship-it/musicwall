process.env.MUSICWALL_TEST_DB_PAD = ':memory:'

const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../database.js')
const { maakWall } = require('../db/walls.js')
const { voegVideoToe } = require('../db/videos.js')
const { maakConcert, voegMediaToe } = require('../db/concerten.js')
const { zoekBibliotheek, alleYoutubeItems } = require('../db/zoeken.js')

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

test('alleYoutubeItems geeft youtube-video\'s uit walls terug, met id en herkomst', () => {
  const wallId = maakWall('Testwall').lastInsertRowid
  const info = voegVideoToe({ wallId, type: 'youtube', artiest: 'Queen', titel: 'Bohemian Rhapsody', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=1' })

  const resultaten = alleYoutubeItems()
  assert.equal(resultaten.length, 1)
  assert.equal(resultaten[0].bron, 'wall')
  assert.equal(resultaten[0].id, info.lastInsertRowid)
  assert.equal(resultaten[0].herkomst, 'Testwall')
  assert.equal(resultaten[0].youtubeUrl, 'https://youtube.com/watch?v=1')
})

test('alleYoutubeItems sluit lokale wall-video\'s uit', () => {
  const wallId = maakWall('Testwall').lastInsertRowid
  voegVideoToe({ wallId, type: 'lokaal', artiest: 'Queen', titel: 'Lokaal nummer', verhaal: null, tag: null, lokaalPad: 'C:/muziek/queen.mp4' })

  assert.equal(alleYoutubeItems().length, 0)
})

test('alleYoutubeItems geeft youtube-media uit concertervaringen terug, met concertnaam als herkomst', () => {
  const concertId = maakConcert({ naam: 'Testconcert', artiest: null, datum: null, verhaal: null }).lastInsertRowid
  const info = voegMediaToe({ concertId, type: 'youtube', bestandPad: 'https://youtube.com/watch?v=2' })

  const resultaten = alleYoutubeItems()
  assert.equal(resultaten.length, 1)
  assert.equal(resultaten[0].bron, 'concert')
  assert.equal(resultaten[0].id, info.lastInsertRowid)
  assert.equal(resultaten[0].herkomst, 'Testconcert')
  assert.equal(resultaten[0].youtubeUrl, 'https://youtube.com/watch?v=2')
})

test('alleYoutubeItems sluit foto\'s en lokale video\'s uit concertervaringen uit', () => {
  const concertId = maakConcert({ naam: 'Testconcert', artiest: null, datum: null, verhaal: null }).lastInsertRowid
  voegMediaToe({ concertId, type: 'foto', bestandPad: 'C:/foto.jpg' })
  voegMediaToe({ concertId, type: 'video', bestandPad: 'C:/video.mp4' })

  assert.equal(alleYoutubeItems().length, 0)
})
