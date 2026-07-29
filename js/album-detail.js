const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getAlbum, getTracksVoorAlbum, verwijderTrack } = require('./db/albums.js')

let huidigAlbumId = null
let huidigAlbum = null
let selectie = new Set()
let huidigeTrackLijst = []
let huidigSpeelTrackId = null
const albumSpeler = document.getElementById('album-speler')

async function laadAlbum(albumId) {
  huidigAlbumId = albumId
  const album = getAlbum(albumId)
  if (!album) return
  huidigAlbum = album

  document.title = album.naam

  const coverEl = document.getElementById('album-cover')
  coverEl.innerHTML = album.cover_pad
    ? '<img src="file:///' + album.cover_pad.replace(/\\/g, '/') + '" alt="">'
    : '<div class="media-placeholder">&#9835;</div>'

  document.getElementById('detail-artiest').textContent = album.artiest || ''
  document.getElementById('detail-naam').textContent = album.naam

  laadTrackLijst()
}

function bewerkHuidigAlbum() {
  if (!huidigAlbum) return
  ipcRenderer.send('open-bewerk-album', huidigAlbum)
}

function laadTrackLijst() {
  const lijst = document.getElementById('track-lijst')
  lijst.innerHTML = ''

  const tracks = getTracksVoorAlbum(huidigAlbumId)
  huidigeTrackLijst = tracks

  // een track die net verwijderd is (los, of via bulkverwijderen vanuit de selectiebalk) kan de track zijn
  // die op dit moment in #album-speler staat - zonder deze check zou de navigatiebalk een niet meer
  // bestaande track blijven tonen
  if (huidigSpeelTrackId !== null && !tracks.some(t => t.id === huidigSpeelTrackId)) {
    albumStop()
  }

  document.getElementById('detail-aantal').textContent = t('albums.trackAantal', { n: tracks.length })

  if (tracks.length === 0) {
    lijst.innerHTML = '<div class="media-leeg">' + t('albumDetail.geenTracks') + '</div>'
    const selecteerBtn = document.getElementById('selecteer-alles-btn')
    if (selecteerBtn) selecteerBtn.style.display = 'none'
    bijwerkenSpeelUI()
    return
  }

  tracks.forEach((track, i) => {
    const rij = document.createElement('div')
    rij.className = 'track-rij'
    rij.dataset.trackId = track.id
    if (selectie.has(track.id)) rij.classList.add('geselecteerd')

    rij.innerHTML = '<span class="track-nummer">' + (i + 1) + '</span>'
      + '<button class="track-play" title="' + t('albumDetail.afspelenTooltip') + '" onclick="event.stopPropagation();speelTrackAf(' + track.id + ')"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg></button>'
      + '<div class="track-info"><div class="track-titel">' + track.titel + '</div><div class="track-artiest">' + (track.artiest || huidigAlbum.artiest || '') + '</div></div>'
      + '<button class="track-verwijder" title="' + t('albumDetail.trackVerwijderenTooltip') + '" onclick="event.stopPropagation();verwijderTrackItem(' + track.id + ')">&times;</button>'

    rij.onclick = (event) => {
      if (event.ctrlKey) toggleSelectie(track.id, rij)
    }

    lijst.appendChild(rij)
  })

  const selecteerBtn = document.getElementById('selecteer-alles-btn')
  if (selecteerBtn) selecteerBtn.style.display = ''

  const rijen = lijst.querySelectorAll('.track-rij')
  if (window.gsap && rijen.length > 0) {
    gsap.fromTo(rijen,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', stagger: 0.02 }
    )
  }

  bijwerkenSpeelUI()
}

function bijwerkenSpeelUI() {
  document.querySelectorAll('.track-rij.speelt').forEach(el => el.classList.remove('speelt'))

  const label = document.getElementById('album-navigatie-track')
  const track = huidigSpeelTrackId !== null ? huidigeTrackLijst.find(t => t.id === huidigSpeelTrackId) : null

  if (!track) {
    if (label) label.textContent = ''
    return
  }

  const rij = document.querySelector('.track-rij[data-track-id="' + track.id + '"]')
  if (rij) {
    rij.classList.add('speelt')
    rij.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  if (label) label.textContent = (track.artiest || (huidigAlbum && huidigAlbum.artiest) || '') + ' - ' + track.titel
}

function huidigSpeelIndex() {
  return huidigeTrackLijst.findIndex(t => t.id === huidigSpeelTrackId)
}

function laadTrack(track) {
  huidigSpeelTrackId = track.id
  albumSpeler.src = 'file:///' + track.lokaal_pad.replace(/\\/g, '/')
  albumSpeler.play()
  document.getElementById('album-play-btn').textContent = '⏸'
  document.getElementById('album-progress-vulling').style.width = '0%'
  document.getElementById('album-tijd-huidig').textContent = '0:00'
  document.getElementById('album-tijd-duur').textContent = '0:00'
  bijwerkenSpeelUI()
}

function formatTijd(seconden) {
  if (!isFinite(seconden) || seconden < 0) seconden = 0
  const m = Math.floor(seconden / 60)
  const s = Math.floor(seconden % 60)
  return m + ':' + String(s).padStart(2, '0')
}

albumSpeler.addEventListener('timeupdate', () => {
  const pct = albumSpeler.duration ? (albumSpeler.currentTime / albumSpeler.duration) * 100 : 0
  document.getElementById('album-progress-vulling').style.width = pct + '%'
  document.getElementById('album-tijd-huidig').textContent = formatTijd(albumSpeler.currentTime)
})

albumSpeler.addEventListener('loadedmetadata', () => {
  document.getElementById('album-tijd-duur').textContent = formatTijd(albumSpeler.duration)
})

function zoekInAlbumSpeler(event) {
  if (!albumSpeler.duration) return
  const balk = document.getElementById('album-progress-balk')
  const rect = balk.getBoundingClientRect()
  const fractie = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  albumSpeler.currentTime = fractie * albumSpeler.duration
}

function albumSpeelPauze() {
  if (huidigSpeelTrackId === null) {
    if (huidigeTrackLijst.length > 0) laadTrack(huidigeTrackLijst[0])
    return
  }

  if (albumSpeler.paused) {
    albumSpeler.play()
    document.getElementById('album-play-btn').textContent = '⏸'
  } else {
    albumSpeler.pause()
    document.getElementById('album-play-btn').textContent = '▶'
  }
}

function albumStop() {
  albumSpeler.pause()
  albumSpeler.removeAttribute('src')
  huidigSpeelTrackId = null
  document.getElementById('album-play-btn').textContent = '▶'
  document.getElementById('album-progress-vulling').style.width = '0%'
  document.getElementById('album-tijd-huidig').textContent = '0:00'
  document.getElementById('album-tijd-duur').textContent = '0:00'
  bijwerkenSpeelUI()
}

function albumVorige() {
  const i = huidigSpeelIndex()
  if (i <= 0) return
  laadTrack(huidigeTrackLijst[i - 1])
}

function albumVolgende() {
  const i = huidigSpeelIndex()
  if (i === -1 || i >= huidigeTrackLijst.length - 1) return
  laadTrack(huidigeTrackLijst[i + 1])
}

function albumEerste() {
  if (huidigeTrackLijst.length === 0) return
  laadTrack(huidigeTrackLijst[0])
}

function albumLaatste() {
  if (huidigeTrackLijst.length === 0) return
  laadTrack(huidigeTrackLijst[huidigeTrackLijst.length - 1])
}

albumSpeler.addEventListener('ended', () => {
  const i = huidigSpeelIndex()
  if (i !== -1 && i < huidigeTrackLijst.length - 1) {
    albumVolgende()
  } else {
    document.getElementById('album-play-btn').textContent = '▶'
  }
})

function toggleSelecteerAlleInAlbum() {
  if (huidigeTrackLijst.length === 0) return

  const alleGeselecteerd = huidigeTrackLijst.every(t => selectie.has(t.id))

  huidigeTrackLijst.forEach(t => {
    if (alleGeselecteerd) selectie.delete(t.id)
    else selectie.add(t.id)
  })

  document.querySelectorAll('.track-rij[data-track-id]').forEach(rij => {
    const id = parseInt(rij.dataset.trackId)
    rij.classList.toggle('geselecteerd', selectie.has(id))
  })

  updateSelectieInfo()
}

function speelTrackAf(trackId) {
  const track = huidigeTrackLijst.find(t => t.id === trackId)
  if (!track) return
  laadTrack(track)
}

function verwijderTrackItem(trackId) {
  verwijderTrack(trackId)
  selectie.delete(trackId)
  updateSelectieInfo()
  laadTrackLijst()
}

function toggleSelectie(trackId, rijEl) {
  if (selectie.has(trackId)) {
    selectie.delete(trackId)
    rijEl.classList.remove('geselecteerd')
  } else {
    selectie.add(trackId)
    rijEl.classList.add('geselecteerd')
  }
  updateSelectieInfo()
}

function updateSelectieInfo() {
  const info = document.getElementById('selectie-info')
  const tekst = document.getElementById('selectie-tekst')

  if (selectie.size === 0) {
    info.classList.remove('zichtbaar')
  } else {
    info.classList.add('zichtbaar')
    tekst.textContent = t('selectie.tekst', { n: selectie.size })
  }
}

function deselecteerAlles() {
  document.querySelectorAll('.track-rij.geselecteerd').forEach(el => el.classList.remove('geselecteerd'))
  selectie.clear()
  updateSelectieInfo()
}

function stuurNaarJukebox() {
  if (selectie.size === 0) return

  const items = Array.from(selectie)
    .map(id => huidigeTrackLijst.find(t => t.id === id))
    .filter(Boolean)
    .map(track => ({
      type: 'lokaal',
      lokaalPad: track.lokaal_pad,
      artiest: track.artiest || huidigAlbum.artiest,
      titel: track.titel,
      coverPad: huidigAlbum.cover_pad
    }))

  if (items.length > 0) {
    ipcRenderer.send('album-tracks-naar-playlist', items)
  }

  deselecteerAlles()
}

function verwijderSelectie() {
  if (selectie.size === 0) return

  const idArray = Array.from(selectie)
  const namen = idArray.map(id => {
    const track = huidigeTrackLijst.find(t => t.id === id)
    return track ? track.titel : ''
  }).join('\n')

  ipcRenderer.send('bevestig-album-tracks-verwijderen-meerdere', { ids: idArray, namen })
  deselecteerAlles()
}

ipcRenderer.on('album-tracks-verwijderd', () => {
  laadTrackLijst()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') deselecteerAlles()
})

ipcRenderer.on('laad-album', (event, albumId) => laadAlbum(albumId))

ipcRenderer.on('herlaad-albums', () => {
  if (huidigAlbumId) laadAlbum(huidigAlbumId)
})

document.addEventListener('taal-gewijzigd', () => {
  if (huidigAlbumId) laadTrackLijst()
})

window.speelTrackAf = speelTrackAf
window.verwijderTrackItem = verwijderTrackItem
window.bewerkHuidigAlbum = bewerkHuidigAlbum
window.stuurNaarJukebox = stuurNaarJukebox
window.verwijderSelectie = verwijderSelectie
window.toggleSelecteerAlleInAlbum = toggleSelecteerAlleInAlbum
window.albumSpeelPauze = albumSpeelPauze
window.albumStop = albumStop
window.albumVorige = albumVorige
window.albumVolgende = albumVolgende
window.albumEerste = albumEerste
window.albumLaatste = albumLaatste
window.zoekInAlbumSpeler = zoekInAlbumSpeler
