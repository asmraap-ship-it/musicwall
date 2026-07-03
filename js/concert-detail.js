const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getConcert, getMediaVoorConcert, voegMediaToe, verwijderMedia } = require('./db/concerten.js')

let huidigConcertId = null
let huidigConcert = null
let selectie = new Set()

function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

async function laadConcert(concertId) {
  huidigConcertId = concertId
  const concert = getConcert(concertId)
  if (!concert) return
  huidigConcert = concert

  document.title = concert.naam
  document.getElementById('detail-artiest').textContent = concert.artiest || ''
  document.getElementById('detail-naam').textContent = concert.naam
  document.getElementById('detail-datum').textContent = concert.datum || ''

  const verhaalEl = document.getElementById('detail-verhaal')
  verhaalEl.textContent = concert.verhaal || ''
  verhaalEl.style.display = concert.verhaal ? '' : 'none'

  await laadMediaGrid()
}

async function laadMediaGrid() {
  const grid = document.getElementById('media-grid')
  grid.innerHTML = ''

  const media = getMediaVoorConcert(huidigConcertId)

  if (media.length === 0) {
    grid.innerHTML = '<div class="media-leeg">' + t('concertDetail.geenMedia') + '</div>'
    return
  }

  for (const item of media) {
    const tegel = document.createElement('div')
    tegel.className = 'media-tegel'

    const verwijderKnop = '<button class="media-verwijder" title="' + t('concertDetail.verwijderenTooltip') + '" onclick="event.stopPropagation();verwijderMediaItem(' + item.id + ')">&times;</button>'
    const playIcon = '<div class="media-play"><svg viewBox="0 0 24 24" fill="#c8a87a"><polygon points="5,3 19,12 5,21"/></svg></div>'

    if (item.type === 'foto') {
      tegel.innerHTML = '<img src="file:///' + item.bestand_pad.replace(/\\/g, '/') + '" alt="">' + verwijderKnop
      tegel.onclick = () => openLightbox('file:///' + item.bestand_pad.replace(/\\/g, '/'))
    } else if (item.type === 'youtube') {
      const id = getYoutubeId(item.bestand_pad)
      tegel.innerHTML = (id
          ? '<img src="https://img.youtube.com/vi/' + id + '/hqdefault.jpg" alt="">'
          : '<div class="media-placeholder">&#9835;</div>')
        + playIcon
        + '<div class="media-bron youtube">' + t('video.bron.youtube') + '</div>'
        + verwijderKnop
      tegel.onclick = () => ipcRenderer.send('open-video', item.bestand_pad)
    } else {
      const pad = await ipcRenderer.invoke('maak-thumbnail', item.bestand_pad)
      tegel.innerHTML = (pad
          ? '<img src="file:///' + pad.replace(/\\/g, '/') + '" alt="">'
          : '<div class="media-placeholder">&#9654;</div>')
        + playIcon
        + '<div class="media-bron lokaal">' + t('video.bron.lokaal') + '</div>'
        + verwijderKnop
      tegel.dataset.mediaId = item.id
      if (selectie.has(item.id)) tegel.classList.add('geselecteerd')
      tegel.onclick = (event) => {
        if (event.ctrlKey) {
          toggleSelectie(item.id, tegel)
        } else {
          ipcRenderer.send('open-lokaal', item.bestand_pad)
        }
      }
    }

    grid.appendChild(tegel)
  }

  const selecteerBtn = document.getElementById('selecteer-lokale-btn')
  if (selecteerBtn) selecteerBtn.style.display = media.some(m => m.type === 'video') ? '' : 'none'

  const tegels = grid.querySelectorAll('.media-tegel')
  if (window.gsap && tegels.length > 0) {
    gsap.fromTo(tegels,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.04 }
    )
  }
}

function kiesMedia() {
  ipcRenderer.send('kies-concert-media')
}

ipcRenderer.on('concert-media-gekozen', (event, paths) => {
  const fotoExtensies = ['.jpg', '.jpeg', '.png', '.heic']
  paths.forEach(pad => {
    const ext = pad.slice(pad.lastIndexOf('.')).toLowerCase()
    const type = fotoExtensies.includes(ext) ? 'foto' : 'video'
    voegMediaToe({ concertId: huidigConcertId, type, bestandPad: pad })
  })
  ipcRenderer.send('concert-media-toegevoegd')
  laadMediaGrid()
})

function voegYoutubeToe() {
  const input = document.getElementById('youtube-url-input')
  const url = input.value.trim()
  if (!url || !getYoutubeId(url)) {
    input.focus()
    return
  }

  voegMediaToe({ concertId: huidigConcertId, type: 'youtube', bestandPad: url })
  input.value = ''
  ipcRenderer.send('concert-media-toegevoegd')
  laadMediaGrid()
}

function verwijderMediaItem(mediaId) {
  verwijderMedia(mediaId)
  selectie.delete(mediaId)
  updateSelectieInfo()
  ipcRenderer.send('concert-media-toegevoegd')
  laadMediaGrid()
}

function toggleSelectie(mediaId, tegelEl) {
  if (selectie.has(mediaId)) {
    selectie.delete(mediaId)
    tegelEl.classList.remove('geselecteerd')
  } else {
    selectie.add(mediaId)
    tegelEl.classList.add('geselecteerd')
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
  document.querySelectorAll('.media-tegel.geselecteerd').forEach(el => el.classList.remove('geselecteerd'))
  selectie.clear()
  updateSelectieInfo()
}

function toggleSelecteerAlleLokaal() {
  const media = getMediaVoorConcert(huidigConcertId)
  const lokaleVideos = media.filter(m => m.type === 'video')
  if (lokaleVideos.length === 0) return

  const alleGeselecteerd = lokaleVideos.every(m => selectie.has(m.id))

  lokaleVideos.forEach(m => {
    if (alleGeselecteerd) selectie.delete(m.id)
    else selectie.add(m.id)
  })

  document.querySelectorAll('.media-tegel[data-media-id]').forEach(tegel => {
    const id = parseInt(tegel.dataset.mediaId)
    tegel.classList.toggle('geselecteerd', selectie.has(id))
  })

  updateSelectieInfo()
}

function stuurNaarJukebox() {
  if (selectie.size === 0) {
    alert(t('jukebox.geenSelectie'))
    return
  }

  const media = getMediaVoorConcert(huidigConcertId)
  const items = Array.from(selectie)
    .map(id => media.find(m => m.id === id))
    .filter(m => m && m.type === 'video')
    .map(m => ({ lokaalPad: m.bestand_pad, artiest: huidigConcert.artiest, titel: huidigConcert.naam }))

  if (items.length > 0) {
    ipcRenderer.send('concert-media-naar-playlist', items)
  }

  deselecteerAlles()
}

function openLightbox(src) {
  document.getElementById('lightbox-img').src = src
  document.getElementById('lightbox').classList.add('zichtbaar')
}

function sluitLightbox() {
  document.getElementById('lightbox').classList.remove('zichtbaar')
}

document.getElementById('youtube-url-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') voegYoutubeToe()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    sluitLightbox()
    deselecteerAlles()
  }
})

ipcRenderer.on('laad-concert', (event, concertId) => laadConcert(concertId))

document.addEventListener('taal-gewijzigd', () => {
  if (huidigConcertId) laadMediaGrid()
})

window.kiesMedia = kiesMedia
window.voegYoutubeToe = voegYoutubeToe
window.verwijderMediaItem = verwijderMediaItem
window.sluitLightbox = sluitLightbox
window.stuurNaarJukebox = stuurNaarJukebox
window.toggleSelecteerAlleLokaal = toggleSelecteerAlleLokaal
