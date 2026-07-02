const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getPlaylist, verwijderUitPlaylist, leegPlaylist, herschikPlaylist } = require('./db/playlist.js')

let playlist = []
let huidigeIndex = -1

async function laadPlaylist() {
  playlist = getPlaylist()
  const lijst = document.getElementById('playlist-lijst')

  if (playlist.length === 0) {
    lijst.innerHTML = '<div class="playlist-leeg">' + t('jukebox.leegLijst') + '</div>'
    return
  }

  lijst.innerHTML = ''

  for (let i = 0; i < playlist.length; i++) {
    const item = playlist[i]
    let thumb = ''

    if (item.lokaal_pad) {
      const pad = await ipcRenderer.invoke('maak-thumbnail', item.lokaal_pad)
      if (pad) thumb = 'file:///' + pad.replace(/\\/g, '/')
    }

    const el = document.createElement('div')
    el.className = 'playlist-item' + (i === huidigeIndex ? ' actief' : '')
    el.innerHTML = (thumb ? '<img src="' + thumb + '">' : '<div style="width:56px;aspect-ratio:16/9;background:#1a1a1a;border-radius:2px;flex-shrink:0"></div>')
      + '<div class="playlist-info">'
      + '<div class="playlist-artiest">' + (item.artiest || '') + '</div>'
      + '<div class="playlist-titel">' + item.titel + '</div>'
      + '</div>'
      + '<button class="playlist-verwijder" onclick="event.stopPropagation();verwijderItem(' + item.playlist_id + ')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>'
      + '</button>'
    el.onclick = () => speelIndex(i)
    lijst.appendChild(el)
  }
}

function verwijderItem(playlistId) {
  verwijderUitPlaylist(playlistId)
  laadPlaylist()
}

function leegMaken() {
  leegPlaylist()
  huidigeIndex = -1
  stop()
  laadPlaylist()
}
function schudPlaylist() {
  if (playlist.length < 2) return

  const playlistIds = playlist.map(p => p.playlist_id)

  for (let i = playlistIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[playlistIds[i], playlistIds[j]] = [playlistIds[j], playlistIds[i]]
  }

  herschikPlaylist(playlistIds)
  huidigeIndex = -1
  laadPlaylist()
}

function speelIndex(i) {
  if (i < 0 || i >= playlist.length) return
  huidigeIndex = i
  const item = playlist[i]

  const speler = document.getElementById('speler')
  const placeholder = document.getElementById('speel-placeholder')
  const fsBtn = document.getElementById('fullscreen-btn')

  speler.src = 'file:///' + item.lokaal_pad.replace(/\\/g, '/')
  speler.classList.add('zichtbaar')
  placeholder.style.display = 'none'
  fsBtn.classList.add('zichtbaar')
  speler.play()

  document.getElementById('play-btn').textContent = '⏸'
  laadPlaylist()
}

function schermvullend() {
  const speler = document.getElementById('speler')
  if (speler.requestFullscreen) speler.requestFullscreen()
}

function speelPauze() {
  const speler = document.getElementById('speler')

  if (huidigeIndex === -1 && playlist.length > 0) {
    speelIndex(0)
    return
  }

  if (speler.paused) {
    speler.play()
    document.getElementById('play-btn').textContent = '⏸'
  } else {
    speler.pause()
    document.getElementById('play-btn').textContent = '▶'
  }
}

function stop() {
  const speler = document.getElementById('speler')
  speler.pause()
  speler.removeAttribute('src')
  speler.classList.remove('zichtbaar')
  document.getElementById('speel-placeholder').style.display = 'block'
  document.getElementById('fullscreen-btn').classList.remove('zichtbaar')
  document.getElementById('play-btn').textContent = '▶'
}

function vorige() {
  if (huidigeIndex > 0) speelIndex(huidigeIndex - 1)
}

function volgende() {
  if (huidigeIndex < playlist.length - 1) {
    speelIndex(huidigeIndex + 1)
  } else {
    huidigeIndex = -1
    stop()
    laadPlaylist()
    toonKlaarMelding()
  }
}

function toonKlaarMelding() {
  const scherm = document.getElementById('speel-scherm')
  const placeholder = document.getElementById('speel-placeholder')
  placeholder.innerHTML = '<div class="speel-icoon">✓</div>'
    + '<div class="speel-tekst">' + t('jukebox.alleAfgespeeld') + '</div>'
  placeholder.style.display = 'flex'

  setTimeout(() => {
    placeholder.innerHTML = '<div class="speel-icoon">♪</div>'
      + '<div class="speel-tekst">' + t('jukebox.kiesNummer') + '</div>'
  }, 4000)
}

function naarEerste() {
  if (playlist.length > 0) speelIndex(0)
}

function naarLaatste() {
  if (playlist.length > 0) speelIndex(playlist.length - 1)
}

document.getElementById('speler').addEventListener('ended', () => {
  volgende()
})

window.leegMaken = leegMaken
window.verwijderItem = verwijderItem
window.speelPauze = speelPauze
window.stop = stop
window.vorige = vorige
window.volgende = volgende
window.naarEerste = naarEerste
window.naarLaatste = naarLaatste
window.schermvullend = schermvullend
window.schudPlaylist = schudPlaylist


laadPlaylist()