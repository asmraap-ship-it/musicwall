const db = require('../database.js')

db.exec(`
  CREATE TABLE IF NOT EXISTS afspeelstatistieken (
    sleutel TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    lokaal_pad TEXT,
    youtube_url TEXT,
    artiest TEXT,
    titel TEXT,
    aantal INTEGER NOT NULL DEFAULT 0,
    laatst_afgespeeld TEXT
  )
`)

// Sleutel/opbouw bewust hetzelfde patroon als db/playlist.js (type + lokaal_pad/youtube_url als kopie i.p.v.
// een FK naar videos/concert_media) - een afspeelstatistiek moet blijven bestaan en tonen ook nadat de
// bron-video verwijderd is, en hetzelfde nummer dat in meerdere walls voorkomt (zelfde url/pad) telt bewust
// als één afspeelstatistiek, net als bij de bibliotheekzoek-selectiesleutel in de jukebox.
function registreerAfspeling({ type, lokaalPad, youtubeUrl, artiest, titel }) {
  const soort = type === 'youtube' ? 'youtube' : 'lokaal'
  const pad = soort === 'youtube' ? youtubeUrl : lokaalPad
  if (!pad) return

  const sleutel = soort + '|' + pad

  db.prepare(`
    INSERT INTO afspeelstatistieken (sleutel, type, lokaal_pad, youtube_url, artiest, titel, aantal, laatst_afgespeeld)
    VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
    ON CONFLICT(sleutel) DO UPDATE SET
      aantal = aantal + 1,
      artiest = excluded.artiest,
      titel = excluded.titel,
      laatst_afgespeeld = excluded.laatst_afgespeeld
  `).run(sleutel, soort, soort === 'lokaal' ? pad : null, soort === 'youtube' ? pad : null, artiest || null, titel || null)
}

function getMeestGespeeld(limiet) {
  return db.prepare('SELECT * FROM afspeelstatistieken ORDER BY aantal DESC, laatst_afgespeeld DESC LIMIT ?').all(limiet || 50)
}

module.exports = { registreerAfspeling, getMeestGespeeld }
