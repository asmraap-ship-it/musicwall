process.env.MUSICWALL_TEST_DB_PAD = ':memory:'

const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../database.js')
const { maakWall } = require('../db/walls.js')
const { voegVideoToe } = require('../db/videos.js')
const { maakAlbum, voegTrackToe } = require('../db/albums.js')
const { voegToeAanPlaylist, leegPlaylist } = require('../db/playlist.js')
const { slaPlaylistOp, laadOpgeslagenPlaylist, getOpgeslagenPlaylists, bestaatPlaylistNaam, verwijderOpgeslagenPlaylist } = require('../db/opgeslagenPlaylists.js')

test.beforeEach(() => {
  db.exec('DELETE FROM playlist_videos; DELETE FROM playlists; DELETE FROM playlist; DELETE FROM album_tracks; DELETE FROM albums; DELETE FROM videos; DELETE FROM walls;')
})

test('slaPlaylistOp slaat een MP3-albumtrack op (niet langer overgeslagen)', () => {
  const album = maakAlbum({ naam: 'Moon Music', artiest: 'Coldplay', coverPad: 'C:\\covers\\moon.jpg', groepId: null })
  voegTrackToe({ albumId: album.lastInsertRowid, artiest: 'Coldplay', titel: 'AETERNA', lokaalPad: 'C:\\muziek\\AETERNA.mp3' })

  voegToeAanPlaylist({ type: 'lokaal', lokaalPad: 'C:\\muziek\\AETERNA.mp3', artiest: 'Coldplay', titel: 'AETERNA' })

  const { overgeslagen } = slaPlaylistOp('Mijn playlist')
  assert.equal(overgeslagen, 0)
})

test('laadOpgeslagenPlaylist geeft de albumtrack terug met cover_pad van het album', () => {
  const album = maakAlbum({ naam: 'Moon Music', artiest: 'Coldplay', coverPad: 'C:\\covers\\moon.jpg', groepId: null })
  voegTrackToe({ albumId: album.lastInsertRowid, artiest: 'Coldplay', titel: 'AETERNA', lokaalPad: 'C:\\muziek\\AETERNA.mp3' })
  voegToeAanPlaylist({ type: 'lokaal', lokaalPad: 'C:\\muziek\\AETERNA.mp3', artiest: 'Coldplay', titel: 'AETERNA' })

  const { id } = slaPlaylistOp('Mijn playlist')
  const { items, overgeslagen } = laadOpgeslagenPlaylist(id)

  assert.equal(overgeslagen, 0)
  assert.equal(items.length, 1)
  assert.equal(items[0].titel, 'AETERNA')
  assert.equal(items[0].type, 'lokaal')
  assert.equal(items[0].cover_pad, 'C:\\covers\\moon.jpg')
})

test('slaPlaylistOp / laadOpgeslagenPlaylist werken met een mix van wall-video, youtube en albumtrack', () => {
  const wall = maakWall('Test wall')
  voegVideoToe({ wallId: wall.lastInsertRowid, type: 'lokaal', artiest: 'A', titel: 'Wall-video', lokaalPad: 'C:\\video\\a.mp4' })
  voegVideoToe({ wallId: wall.lastInsertRowid, type: 'youtube', artiest: 'C', titel: 'YouTube-nummer', youtubeUrl: 'https://youtu.be/xyz' })
  const album = maakAlbum({ naam: 'Album', artiest: 'B', coverPad: null, groepId: null })
  voegTrackToe({ albumId: album.lastInsertRowid, artiest: 'B', titel: 'Track', lokaalPad: 'C:\\muziek\\b.mp3' })

  voegToeAanPlaylist({ type: 'lokaal', lokaalPad: 'C:\\video\\a.mp4', artiest: 'A', titel: 'Wall-video' })
  voegToeAanPlaylist({ type: 'youtube', youtubeUrl: 'https://youtu.be/xyz', artiest: 'C', titel: 'YouTube-nummer' })
  voegToeAanPlaylist({ type: 'lokaal', lokaalPad: 'C:\\muziek\\b.mp3', artiest: 'B', titel: 'Track' })

  const { id, overgeslagen: overgeslagenBijOpslaan } = slaPlaylistOp('Gemengde playlist')
  assert.equal(overgeslagenBijOpslaan, 0)

  const { items } = laadOpgeslagenPlaylist(id)
  assert.deepEqual(items.map(i => i.titel), ['Wall-video', 'YouTube-nummer', 'Track'])
})

test('slaPlaylistOp telt een item zonder match nergens (verwijderd bestand) als overgeslagen', () => {
  voegToeAanPlaylist({ type: 'lokaal', lokaalPad: 'C:\\bestaat-niet-meer.mp3', artiest: 'X', titel: 'Weg' })

  const { overgeslagen } = slaPlaylistOp('Playlist met gat')
  assert.equal(overgeslagen, 1)
})

test('getOpgeslagenPlaylists / bestaatPlaylistNaam / verwijderOpgeslagenPlaylist', () => {
  const album = maakAlbum({ naam: 'Album', artiest: 'B', coverPad: null, groepId: null })
  voegTrackToe({ albumId: album.lastInsertRowid, artiest: 'B', titel: 'Track', lokaalPad: 'C:\\muziek\\b.mp3' })
  voegToeAanPlaylist({ type: 'lokaal', lokaalPad: 'C:\\muziek\\b.mp3', artiest: 'B', titel: 'Track' })

  const { id } = slaPlaylistOp('Naam')
  assert.equal(bestaatPlaylistNaam('naam'), true)
  assert.equal(bestaatPlaylistNaam('iets anders'), false)

  const lijst = getOpgeslagenPlaylists()
  assert.equal(lijst.length, 1)
  assert.equal(lijst[0].aantal, 1)

  verwijderOpgeslagenPlaylist(id)
  assert.equal(getOpgeslagenPlaylists().length, 0)
})
