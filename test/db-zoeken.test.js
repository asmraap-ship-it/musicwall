process.env.MUSICWALL_TEST_DB_PAD = ':memory:'

const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../database.js')
const { maakWall } = require('../db/walls.js')
const { voegVideoToe } = require('../db/videos.js')
const { maakConcert, voegMediaToe } = require('../db/concerten.js')
const { maakAlbum, voegTrackToe } = require('../db/albums.js')
const { zoekBibliotheek, alleYoutubeItems } = require('../db/zoeken.js')

test.beforeEach(() => {
  db.exec('DELETE FROM videos; DELETE FROM walls; DELETE FROM concert_media; DELETE FROM concerten; DELETE FROM album_tracks; DELETE FROM albums;')
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

test('zoekBibliotheek vindt een albumtrack op titel/artiest, met album als herkomst en soort lokaal', () => {
  const albumId = maakAlbum({ naam: 'Innuendo', artiest: 'Queen', coverPad: 'C:/covers/innuendo.jpg', groepId: null }).lastInsertRowid
  voegTrackToe({ albumId, artiest: 'Queen', titel: 'The Show Must Go On', lokaalPad: 'C:/muziek/innuendo/06.mp3' })

  const resultaten = zoekBibliotheek('Show Must Go On')
  assert.equal(resultaten.length, 1)
  assert.equal(resultaten[0].bron, 'album')
  assert.equal(resultaten[0].soort, 'lokaal')
  assert.equal(resultaten[0].herkomst, 'Innuendo')
  assert.equal(resultaten[0].coverPad, 'C:/covers/innuendo.jpg')
  assert.equal(resultaten[0].youtubeUrl, null)
})

test('zoekBibliotheek vindt een albumtrack via de albumnaam als de track zelf geen artiest heeft', () => {
  const albumId = maakAlbum({ naam: 'Live Aid Bootleg', artiest: null, coverPad: null, groepId: null }).lastInsertRowid
  voegTrackToe({ albumId, artiest: null, titel: 'Nummer zonder eigen artiest', lokaalPad: 'C:/muziek/liveaid/01.mp3' })

  const resultaten = zoekBibliotheek('Live Aid')
  assert.equal(resultaten.length, 1)
  assert.equal(resultaten[0].titel, 'Nummer zonder eigen artiest')
})
