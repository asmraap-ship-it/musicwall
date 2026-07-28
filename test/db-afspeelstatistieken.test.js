process.env.MUSICWALL_TEST_DB_PAD = ':memory:'

const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../database.js')
const { registreerAfspeling, getMeestGespeeld } = require('../db/afspeelstatistieken.js')

test.beforeEach(() => {
  db.exec('DELETE FROM afspeelstatistieken;')
})

test('registreerAfspeling maakt een nieuwe statistiek aan met aantal 1', () => {
  registreerAfspeling({ type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=1', artiest: 'Queen', titel: 'Bohemian Rhapsody' })

  const resultaten = getMeestGespeeld()
  assert.equal(resultaten.length, 1)
  assert.equal(resultaten[0].aantal, 1)
  assert.equal(resultaten[0].titel, 'Bohemian Rhapsody')
})

test('registreerAfspeling hoogt het aantal op bij een volgende afspeling van dezelfde url', () => {
  registreerAfspeling({ type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=1', artiest: 'Queen', titel: 'Bohemian Rhapsody' })
  registreerAfspeling({ type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=1', artiest: 'Queen', titel: 'Bohemian Rhapsody' })
  registreerAfspeling({ type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=1', artiest: 'Queen', titel: 'Bohemian Rhapsody' })

  const resultaten = getMeestGespeeld()
  assert.equal(resultaten.length, 1)
  assert.equal(resultaten[0].aantal, 3)
})

test('lokale en youtube-nummers met hetzelfde pad/url tellen apart via type in de sleutel', () => {
  registreerAfspeling({ type: 'lokaal', lokaalPad: 'C:/muziek/nummer.mp4', artiest: 'A', titel: 'Nummer' })
  registreerAfspeling({ type: 'youtube', youtubeUrl: 'C:/muziek/nummer.mp4', artiest: 'A', titel: 'Nummer' })

  assert.equal(getMeestGespeeld().length, 2)
})

test('registreerAfspeling doet niets zonder lokaalPad/youtubeUrl', () => {
  registreerAfspeling({ type: 'youtube', artiest: 'A', titel: 'Nummer' })
  assert.equal(getMeestGespeeld().length, 0)
})

test('getMeestGespeeld sorteert aflopend op aantal', () => {
  registreerAfspeling({ type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=1', artiest: 'A', titel: 'Eén keer' })
  registreerAfspeling({ type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=2', artiest: 'B', titel: 'Drie keer' })
  registreerAfspeling({ type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=2', artiest: 'B', titel: 'Drie keer' })
  registreerAfspeling({ type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=2', artiest: 'B', titel: 'Drie keer' })

  const resultaten = getMeestGespeeld()
  assert.equal(resultaten[0].titel, 'Drie keer')
  assert.equal(resultaten[0].aantal, 3)
  assert.equal(resultaten[1].titel, 'Eén keer')
})

test('getMeestGespeeld respecteert de limiet', () => {
  registreerAfspeling({ type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=1', artiest: 'A', titel: 'Een' })
  registreerAfspeling({ type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=2', artiest: 'B', titel: 'Twee' })

  assert.equal(getMeestGespeeld(1).length, 1)
})
