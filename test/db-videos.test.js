process.env.MUSICWALL_TEST_DB_PAD = ':memory:'

const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../database.js')
const { maakWall } = require('../db/walls.js')
const { voegVideoToe, getVideosVoorWall, getVideo, bestaatVideoInWall, verwijderVideo, updateVideo, verplaatsVideo, slaVolgordeOp } = require('../db/videos.js')

let wallA, wallB

test.beforeEach(() => {
  db.exec('DELETE FROM videos; DELETE FROM walls;')
  wallA = maakWall('Wall A').lastInsertRowid
  wallB = maakWall('Wall B').lastInsertRowid
})

test('voegVideoToe geeft volgorde = aantal video\'s in die wall + 1', () => {
  voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'Een', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=1' })
  const info = voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'Twee', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=2' })
  const video = getVideo(info.lastInsertRowid)
  assert.equal(video.volgorde, 2)
})

test('volgorde-teller is per wall onafhankelijk', () => {
  voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'A1', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=1' })
  const info = voegVideoToe({ wallId: wallB, type: 'youtube', artiest: 'X', titel: 'B1', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=2' })
  const video = getVideo(info.lastInsertRowid)
  assert.equal(video.volgorde, 1)
})

test('getVideosVoorWall geeft alleen video\'s van die wall, gesorteerd op volgorde', () => {
  voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'A1', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=1' })
  voegVideoToe({ wallId: wallB, type: 'youtube', artiest: 'X', titel: 'B1', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=2' })
  voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'A2', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=3' })

  const videos = getVideosVoorWall(wallA)
  assert.deepEqual(videos.map(v => v.titel), ['A1', 'A2'])
})

test('bestaatVideoInWall matcht op lokaal_pad of youtube_url, alleen binnen dezelfde wall', () => {
  voegVideoToe({ wallId: wallA, type: 'lokaal', artiest: 'X', titel: 'Lokaal', verhaal: null, tag: null, lokaalPad: 'C:/muziek/track.mp3' })
  voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'YT', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=1' })

  assert.equal(bestaatVideoInWall(wallA, { lokaalPad: 'C:/muziek/track.mp3' }), true)
  assert.equal(bestaatVideoInWall(wallA, { youtubeUrl: 'https://youtube.com/watch?v=1' }), true)
  assert.equal(bestaatVideoInWall(wallA, { lokaalPad: 'C:/muziek/anders.mp3' }), false)
  // zelfde bestand/url in een ANDERE wall telt niet als duplicaat - bewust legitiem
  assert.equal(bestaatVideoInWall(wallB, { lokaalPad: 'C:/muziek/track.mp3' }), false)
  assert.equal(bestaatVideoInWall(wallB, { youtubeUrl: 'https://youtube.com/watch?v=1' }), false)
})

test('updateVideo wijzigt artiest/titel/verhaal/tag', () => {
  const info = voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'Oud', titel: 'Oud', verhaal: 'Oud verhaal', tag: 'oud', youtubeUrl: 'https://youtube.com/watch?v=1' })
  updateVideo({ id: info.lastInsertRowid, artiest: 'Nieuw', titel: 'Nieuwe titel', verhaal: 'Nieuw verhaal', tag: 'nieuw' })

  const video = getVideo(info.lastInsertRowid)
  assert.equal(video.artiest, 'Nieuw')
  assert.equal(video.titel, 'Nieuwe titel')
  assert.equal(video.verhaal, 'Nieuw verhaal')
  assert.equal(video.tag, 'nieuw')
})

test('verplaatsVideo wijzigt de wall_id', () => {
  const info = voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'Verplaatst', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=1' })
  verplaatsVideo(info.lastInsertRowid, wallB)

  assert.equal(getVideosVoorWall(wallA).length, 0)
  assert.equal(getVideosVoorWall(wallB).length, 1)
})

test('slaVolgordeOp herordent video\'s volgens de meegegeven id-volgorde', () => {
  const v1 = voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'Een', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=1' }).lastInsertRowid
  const v2 = voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'Twee', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=2' }).lastInsertRowid
  const v3 = voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'Drie', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=3' }).lastInsertRowid

  slaVolgordeOp([v3, v1, v2])

  const videos = getVideosVoorWall(wallA)
  assert.deepEqual(videos.map(v => v.id), [v3, v1, v2])
})

test('verwijderVideo laat een gat in de volgorde (herordent de rest niet)', () => {
  const v1 = voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'Een', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=1' }).lastInsertRowid
  const v2 = voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'Twee', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=2' }).lastInsertRowid
  const v3 = voegVideoToe({ wallId: wallA, type: 'youtube', artiest: 'X', titel: 'Drie', verhaal: null, tag: null, youtubeUrl: 'https://youtube.com/watch?v=3' }).lastInsertRowid

  verwijderVideo(v2)

  const overgebleven = getVideosVoorWall(wallA)
  assert.deepEqual(overgebleven.map(v => v.id), [v1, v3])
  assert.deepEqual(overgebleven.map(v => v.volgorde), [1, 3])
})
