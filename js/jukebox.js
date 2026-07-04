const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getPlaylist, verwijderUitPlaylist, leegPlaylist, herschikPlaylist } = require('./db/playlist.js')

let playlist = []
let huidigeIndex = -1

let ytFrameReady = false
let ytPendingVideoId = null
let ytIsPlaying = false

function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

function stuurNaarYtFrame(bericht) {
  const frame = document.getElementById('youtube-speler-frame')
  if (frame && frame.contentWindow) frame.contentWindow.postMessage(bericht, '*')
}

ipcRenderer.invoke('get-jukebox-server-poort').then(poort => {
  document.getElementById('youtube-speler-frame').src = 'http://127.0.0.1:' + poort + '/yt-embed.html'
})

window.addEventListener('message', (event) => {
  const { type, code } = event.data || {}

  if (type === 'ready') {
    ytFrameReady = true
    if (ytPendingVideoId) {
      stuurNaarYtFrame({ actie: 'laad', videoId: ytPendingVideoId })
      ytPendingVideoId = null
    }
  } else if (type === 'playing') {
    ytIsPlaying = true
    document.getElementById('play-btn').textContent = '⏸'
  } else if (type === 'paused') {
    ytIsPlaying = false
    document.getElementById('play-btn').textContent = '▶'
  } else if (type === 'ended') {
    afgespeeldGaVerder()
  } else if (type === 'error') {
    console.warn('YouTube speler kon nummer niet afspelen, overgeslagen:', code)
    afgespeeldGaVerder()
  }
})

async function laadPlaylist() {
  playlist = getPlaylist()
  const lijst = document.getElementById('playlist-lijst')

  if (playlist.length === 0) {
    lijst.innerHTML = '<div class="playlist-leeg">' + t('jukebox.leegLijst') + '</div>'
    return
  }

  lijst.innerHTML = ''

  const weergaveVolgorde = playlist.map((item, i) => ({ item, i }))
  if (huidigeIndex >= 0) {
    weergaveVolgorde.sort((a, b) => (a.i === huidigeIndex ? -1 : b.i === huidigeIndex ? 1 : 0))
  }

  for (const { item, i } of weergaveVolgorde) {
    let thumb = ''
    const bronLabel = '<div class="playlist-bron ' + (item.type === 'youtube' ? 'youtube' : 'lokaal') + '">'
      + t(item.type === 'youtube' ? 'video.bron.youtube' : 'video.bron.lokaal') + '</div>'

    if (item.type === 'youtube') {
      const id = getYoutubeId(item.youtube_url)
      if (id) thumb = 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg'
    } else if (item.lokaal_pad) {
      const pad = await ipcRenderer.invoke('maak-thumbnail', item.lokaal_pad)
      if (pad) thumb = 'file:///' + pad.replace(/\\/g, '/')
    }

    const el = document.createElement('div')
    el.className = 'playlist-item' + (i === huidigeIndex ? ' actief' : '')
    el.innerHTML = '<div class="playlist-thumb-wrap">'
      + (thumb ? '<img src="' + thumb + '">' : '<div style="width:100%;aspect-ratio:16/9;background:#1a1a1a;border-radius:2px;flex-shrink:0"></div>')
      + bronLabel
      + '</div>'
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
  const verwijderdIndex = playlist.findIndex(p => p.playlist_id === playlistId)
  verwijderUitPlaylist(playlistId)

  if (verwijderdIndex === huidigeIndex) {
    huidigeIndex = -1
    stop()
  } else if (verwijderdIndex >= 0 && verwijderdIndex < huidigeIndex) {
    huidigeIndex -= 1
  }

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
  const ytWrap = document.getElementById('youtube-speler-wrap')
  const placeholder = document.getElementById('speel-placeholder')
  const fsBtn = document.getElementById('fullscreen-btn')

  placeholder.style.display = 'none'
  fsBtn.classList.add('zichtbaar')

  if (item.type === 'youtube') {
    speler.pause()
    speler.removeAttribute('src')
    speler.classList.remove('zichtbaar')

    ytWrap.classList.add('zichtbaar')
    const videoId = getYoutubeId(item.youtube_url)

    if (ytFrameReady) {
      stuurNaarYtFrame({ actie: 'laad', videoId })
    } else {
      ytPendingVideoId = videoId
    }
  } else {
    if (ytFrameReady) {
      stuurNaarYtFrame({ actie: 'stoppen' })
    }
    ytWrap.classList.remove('zichtbaar')

    speler.src = 'file:///' + item.lokaal_pad.replace(/\\/g, '/')
    speler.classList.add('zichtbaar')
    speler.play()
  }

  document.getElementById('play-btn').textContent = '⏸'
  laadPlaylist()
}

function schermvullend() {
  const item = playlist[huidigeIndex]

  if (item && item.type === 'youtube') {
    const ytWrap = document.getElementById('youtube-speler-wrap')
    if (ytWrap.requestFullscreen) ytWrap.requestFullscreen()
    return
  }

  const speler = document.getElementById('speler')
  if (speler.requestFullscreen) speler.requestFullscreen()
}

function speelPauze() {
  if (huidigeIndex === -1 && playlist.length > 0) {
    speelIndex(0)
    return
  }

  const item = playlist[huidigeIndex]

  if (item && item.type === 'youtube') {
    if (!ytFrameReady) return
    if (ytIsPlaying) {
      stuurNaarYtFrame({ actie: 'pauzeren' })
      document.getElementById('play-btn').textContent = '▶'
    } else {
      stuurNaarYtFrame({ actie: 'afspelen' })
      document.getElementById('play-btn').textContent = '⏸'
    }
    return
  }

  const speler = document.getElementById('speler')
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

  const ytWrap = document.getElementById('youtube-speler-wrap')
  ytWrap.classList.remove('zichtbaar')
  if (ytFrameReady) {
    stuurNaarYtFrame({ actie: 'stoppen' })
  }

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
    toonEindeMelding(t('jukebox.eindeLijst'))
  }
}

function toonKlaarMelding() {
  toonEindeMelding(t('jukebox.alleAfgespeeld'))
}

function toonEindeMelding(tekst) {
  const placeholder = document.getElementById('speel-placeholder')
  placeholder.innerHTML = '<div class="speel-icoon">✓</div>'
    + '<div class="speel-tekst">' + tekst + '</div>'
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

function afgespeeldGaVerder() {
  const afgespeeld = playlist[huidigeIndex]
  if (afgespeeld) {
    verwijderUitPlaylist(afgespeeld.playlist_id)
  }

  playlist = getPlaylist()

  if (playlist.length === 0) {
    huidigeIndex = -1
    stop()
    laadPlaylist()
    toonKlaarMelding()
    return
  }

  const volgendeIndex = huidigeIndex < playlist.length ? huidigeIndex : 0
  huidigeIndex = -1
  speelIndex(volgendeIndex)
}

document.getElementById('speler').addEventListener('ended', afgespeeldGaVerder)

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
