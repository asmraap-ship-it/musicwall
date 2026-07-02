const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getConcert, getMediaVoorConcert, voegMediaToe, verwijderMedia } = require('./db/concerten.js')

let huidigConcertId = null

function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

async function laadConcert(concertId) {
  huidigConcertId = concertId
  const concert = getConcert(concertId)
  if (!concert) return

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
    grid.innerHTML = '<div class="media-leeg">Nog geen foto\'s of video\'s toegevoegd.</div>'
    return
  }

  for (const item of media) {
    const tegel = document.createElement('div')
    tegel.className = 'media-tegel'

    const verwijderKnop = '<button class="media-verwijder" onclick="event.stopPropagation();verwijderMediaItem(' + item.id + ')">&times;</button>'
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
        + '<div class="media-bron youtube">YouTube</div>'
        + verwijderKnop
      tegel.onclick = () => ipcRenderer.send('open-video', item.bestand_pad)
    } else {
      const pad = await ipcRenderer.invoke('maak-thumbnail', item.bestand_pad)
      tegel.innerHTML = (pad
          ? '<img src="file:///' + pad.replace(/\\/g, '/') + '" alt="">'
          : '<div class="media-placeholder">&#9654;</div>')
        + playIcon
        + verwijderKnop
      tegel.onclick = () => ipcRenderer.send('open-lokaal', item.bestand_pad)
    }

    grid.appendChild(tegel)
  }

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
  ipcRenderer.send('concert-media-toegevoegd')
  laadMediaGrid()
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
  if (e.key === 'Escape') sluitLightbox()
})

ipcRenderer.on('laad-concert', (event, concertId) => laadConcert(concertId))

window.kiesMedia = kiesMedia
window.voegYoutubeToe = voegYoutubeToe
window.verwijderMediaItem = verwijderMediaItem
window.sluitLightbox = sluitLightbox
