process.env.MUSICWALL_TEST_DB_PAD = ':memory:'

const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../database.js')
const {
  getAlleConcerten,
  maakConcert,
  updateConcert,
  verwijderConcert,
  herschikConcerten,
  getMediaVoorConcert,
  voegMediaToe,
  bestaatMediaInConcert,
  verwijderMedia,
  slaMediaVolgordeOp
} = require('../db/concerten.js')

test.beforeEach(() => {
  db.exec('DELETE FROM concert_media; DELETE FROM concerten;')
})

test('maakConcert / getAlleConcerten: nieuwste datum eerst', () => {
  maakConcert({ naam: 'Oud concert', artiest: 'X', datum: '2020-01-01', verhaal: null })
  maakConcert({ naam: 'Nieuw concert', artiest: 'X', datum: '2024-01-01', verhaal: null })

  const concerten = getAlleConcerten()
  assert.deepEqual(concerten.map(c => c.naam), ['Nieuw concert', 'Oud concert'])
})

test('updateConcert wijzigt de velden', () => {
  const info = maakConcert({ naam: 'Oud', artiest: 'X', datum: '2024-01-01', verhaal: 'Oud verhaal' })
  updateConcert({ id: info.lastInsertRowid, naam: 'Nieuw', artiest: 'Y', datum: '2024-06-01', verhaal: 'Nieuw verhaal' })

  const concert = getAlleConcerten().find(c => c.id === info.lastInsertRowid)
  assert.equal(concert.naam, 'Nieuw')
  assert.equal(concert.artiest, 'Y')
  assert.equal(concert.verhaal, 'Nieuw verhaal')
})

test('herschikConcerten herordent volgens de meegegeven id-volgorde binnen dezelfde datum', () => {
  const a = maakConcert({ naam: 'A', artiest: 'X', datum: '2024-01-01', verhaal: null }).lastInsertRowid
  const b = maakConcert({ naam: 'B', artiest: 'X', datum: '2024-01-01', verhaal: null }).lastInsertRowid

  herschikConcerten([b, a])

  const concerten = getAlleConcerten()
  assert.deepEqual(concerten.map(c => c.id), [b, a])
})

test('media-CRUD: toevoegen, ophalen, herordenen en verwijderen', () => {
  const concertId = maakConcert({ naam: 'Concert', artiest: 'X', datum: '2024-01-01', verhaal: null }).lastInsertRowid
  const m1 = voegMediaToe({ concertId, type: 'foto', bestandPad: 'foto1.jpg' }).lastInsertRowid
  const m2 = voegMediaToe({ concertId, type: 'foto', bestandPad: 'foto2.jpg' }).lastInsertRowid

  assert.deepEqual(getMediaVoorConcert(concertId).map(m => m.id), [m1, m2])

  slaMediaVolgordeOp([m2, m1])
  assert.deepEqual(getMediaVoorConcert(concertId).map(m => m.id), [m2, m1])

  verwijderMedia(m1)
  assert.deepEqual(getMediaVoorConcert(concertId).map(m => m.id), [m2])
})

test('bestaatMediaInConcert matcht op bestand_pad/url, alleen binnen hetzelfde concert', () => {
  const concertA = maakConcert({ naam: 'Concert A', artiest: 'X', datum: '2024-01-01', verhaal: null }).lastInsertRowid
  const concertB = maakConcert({ naam: 'Concert B', artiest: 'X', datum: '2024-01-01', verhaal: null }).lastInsertRowid
  voegMediaToe({ concertId: concertA, type: 'foto', bestandPad: 'foto1.jpg' })

  assert.equal(bestaatMediaInConcert(concertA, 'foto1.jpg'), true)
  assert.equal(bestaatMediaInConcert(concertA, 'foto2.jpg'), false)
  assert.equal(bestaatMediaInConcert(concertB, 'foto1.jpg'), false)
})

test('verwijderConcert cascadeert naar zijn concert_media (FK ON DELETE CASCADE)', () => {
  const concertId = maakConcert({ naam: 'Te verwijderen', artiest: 'X', datum: '2024-01-01', verhaal: null }).lastInsertRowid
  voegMediaToe({ concertId, type: 'foto', bestandPad: 'foto1.jpg' })
  voegMediaToe({ concertId, type: 'video', bestandPad: 'video1.mp4' })

  assert.equal(getMediaVoorConcert(concertId).length, 2)

  verwijderConcert(concertId)

  assert.equal(getAlleConcerten().find(c => c.id === concertId), undefined)
  assert.equal(getMediaVoorConcert(concertId).length, 0)
})
