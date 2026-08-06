const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getConcert, getMediaVoorConcert, voegMediaToe, bestaatMediaInConcert, verwijderMedia } = require('./db/concerten.js')

let huidigConcertId = null
let huidigConcert = null
let selectie = new Set()
let huidigeMediaLijst = []
let posterMap = {}
let viewerIndex = -1

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
  huidigeMediaLijst = media
  posterMap = {}

  if (media.length === 0) {
    grid.innerHTML = '<div class="media-leeg">' + t('concertDetail.geenMedia') + '</div>'
    return
  }

  for (let i = 0; i < media.length; i++) {
    const item = media[i]
    const tegel = document.createElement('div')
    tegel.className = 'media-tegel'

    const verwijderKnop = '<button class="media-verwijder" title="' + t('concertDetail.verwijderenTooltip') + '" onclick="event.stopPropagation();verwijderMediaItem(' + item.id + ')">&times;</button>'
    const playIcon = '<div class="media-play"><svg viewBox="0 0 24 24" fill="#c8a87a"><polygon points="5,3 19,12 5,21"/></svg></div>'

    if (item.type === 'foto') {
      tegel.innerHTML = '<img src="file:///' + item.bestand_pad.replace(/\\/g, '/') + '" alt="">' + verwijderKnop
      tegel.onclick = () => openViewer(i)
    } else if (item.type === 'youtube') {
      const id = getYoutubeId(item.bestand_pad)
      const poster = id ? 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg' : ''
      posterMap[item.id] = poster
      tegel.innerHTML = (poster
          ? '<img src="' + poster + '" alt="">'
          : '<div class="media-placeholder">&#9835;</div>')
        + playIcon
        + '<div class="media-bron youtube">' + t('video.bron.youtube') + '</div>'
        + '<div class="media-warning verborgen" title="' + t('video.mogelijkNietBeschikbaar') + '">⚠</div>'
        + verwijderKnop
      tegel.dataset.mediaId = item.id
      tegel.dataset.youtubeUrl = item.bestand_pad
      if (selectie.has(item.id)) tegel.classList.add('geselecteerd')
      tegel.onclick = (event) => {
        if (event.ctrlKey) {
          toggleSelectie(item.id, tegel)
        } else {
          openViewer(i)
        }
      }
    } else {
      const pad = await ipcRenderer.invoke('maak-thumbnail', item.bestand_pad)
      const poster = pad ? 'file:///' + pad.replace(/\\/g, '/') : ''
      posterMap[item.id] = poster
      tegel.innerHTML = (poster
          ? '<img src="' + poster + '" alt="">'
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
          openViewer(i)
        }
      }
    }

    grid.appendChild(tegel)
  }

  const selecteerBtn = document.getElementById('selecteer-alles-btn')
  if (selecteerBtn) selecteerBtn.style.display = media.some(m => m.type === 'video' || m.type === 'youtube') ? '' : 'none'

  const tegels = grid.querySelectorAll('.media-tegel')
  if (window.gsap && tegels.length > 0) {
    gsap.fromTo(tegels,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.04 }
    )
  }

  controleerKaartenInContainer(grid)
}

function kiesMedia() {
  ipcRenderer.send('kies-concert-media')
}

ipcRenderer.on('concert-media-gekozen', async (event, paths) => {
  // duplicaat-check gescoped tot dit concert - zelfde redenering als bij wall-video-import
  const aantalDubbel = paths.filter(pad => bestaatMediaInConcert(huidigConcertId, pad)).length
  if (aantalDubbel > 0) {
    const akkoord = await ipcRenderer.invoke('vraag-bevestiging', {
      titel: t('validatie.dubbeleBestandenTitel'),
      bericht: t('validatie.dubbeleBestandenBericht', { n: aantalDubbel, m: paths.length }),
      knopTekst: t('algemeen.tochDoorgaanBtn')
    })
    if (!akkoord) return
  }

  const fotoExtensies = ['.jpg', '.jpeg', '.png', '.heic']
  paths.forEach(pad => {
    const ext = pad.slice(pad.lastIndexOf('.')).toLowerCase()
    const type = fotoExtensies.includes(ext) ? 'foto' : 'video'
    voegMediaToe({ concertId: huidigConcertId, type, bestandPad: pad })
  })
  ipcRenderer.send('concert-media-toegevoegd')
  laadMediaGrid()
})

async function voegYoutubeToe() {
  const input = document.getElementById('youtube-url-input')
  const url = input.value.trim()
  if (!url || !getYoutubeId(url)) {
    input.focus()
    return
  }

  if (bestaatMediaInConcert(huidigConcertId, url)) {
    const akkoord = await ipcRenderer.invoke('vraag-bevestiging', {
      titel: t('validatie.dubbeleBestandenTitel'),
      bericht: t('validatie.dubbeleVideoBericht'),
      knopTekst: t('algemeen.tochToevoegenBtn')
    })
    if (!akkoord) return
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

function toggleSelecteerAlleInConcert() {
  const media = getMediaVoorConcert(huidigConcertId)
  const afspeelbareMedia = media.filter(m => m.type === 'video' || m.type === 'youtube')
  if (afspeelbareMedia.length === 0) return

  const alleGeselecteerd = afspeelbareMedia.every(m => selectie.has(m.id))

  afspeelbareMedia.forEach(m => {
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
    .filter(m => m && (m.type === 'video' || m.type === 'youtube'))
    .map(m => m.type === 'youtube'
      ? { type: 'youtube', youtubeUrl: m.bestand_pad, artiest: huidigConcert.artiest, titel: huidigConcert.naam }
      : { type: 'lokaal', lokaalPad: m.bestand_pad, artiest: huidigConcert.artiest, titel: huidigConcert.naam })

  if (items.length > 0) {
    ipcRenderer.send('concert-media-naar-playlist', items)
  }

  deselecteerAlles()
}

function verwijderSelectie() {
  if (selectie.size === 0) return

  const idArray = Array.from(selectie)
  const namen = idArray.map(id => {
    const m = huidigeMediaLijst.find(m => m.id === id)
    if (!m) return ''
    return m.type === 'youtube' ? m.bestand_pad : m.bestand_pad.split(/[\\/]/).pop()
  }).join('\n')

  ipcRenderer.send('bevestig-concert-media-verwijderen-meerdere', { ids: idArray, namen })
  deselecteerAlles()
}

ipcRenderer.on('concert-media-verwijderd', () => {
  laadMediaGrid()
})

function openViewer(index) {
  if (index < 0 || index >= huidigeMediaLijst.length) return
  viewerIndex = index
  renderViewer()
  document.getElementById('lightbox').classList.add('zichtbaar')
}

function renderViewer() {
  const item = huidigeMediaLijst[viewerIndex]
  const inhoud = document.getElementById('lightbox-inhoud')
  inhoud.innerHTML = ''

  if (item.type === 'foto') {
    inhoud.innerHTML = '<img src="file:///' + item.bestand_pad.replace(/\\/g, '/') + '" alt="">'
    if (window.gsap) {
      const img = inhoud.querySelector('img')
      const varianten = [[1, 1], [-1, 1], [1, -1], [-1, -1]]
      const [dx, dy] = varianten[Math.floor(Math.random() * varianten.length)]
      gsap.fromTo(img,
        { scale: 1, xPercent: 0, yPercent: 0 },
        { scale: 1.08, xPercent: dx * 2.5, yPercent: dy * 2.5, duration: 13, ease: 'power1.inOut' }
      )
    }
  } else {
    const poster = posterMap[item.id] || ''
    const bronLabel = '<div class="viewer-bron ' + (item.type === 'youtube' ? 'youtube' : 'lokaal') + '">'
      + t(item.type === 'youtube' ? 'video.bron.youtube' : 'video.bron.lokaal') + '</div>'
    const wrap = document.createElement('div')
    wrap.className = 'viewer-video-poster'
    wrap.innerHTML = (poster
        ? '<img src="' + poster + '" alt="">'
        : '<div class="media-placeholder">' + (item.type === 'youtube' ? '&#9835;' : '&#9654;') + '</div>')
      + '<div class="viewer-play"><svg viewBox="0 0 24 24" fill="#c8a87a"><polygon points="5,3 19,12 5,21"/></svg></div>'
      + bronLabel
    wrap.onclick = () => {
      if (item.type === 'youtube') {
        ipcRenderer.send('open-video', item.bestand_pad)
      } else {
        ipcRenderer.send('open-lokaal', item.bestand_pad, null, huidigConcert.artiest, huidigConcert.naam)
      }
    }
    inhoud.appendChild(wrap)
  }

  const meerdereItems = huidigeMediaLijst.length > 1
  document.getElementById('viewer-vorige').style.visibility = meerdereItems ? 'visible' : 'hidden'
  document.getElementById('viewer-volgende').style.visibility = meerdereItems ? 'visible' : 'hidden'
}

function viewerVorige(event) {
  if (event) event.stopPropagation()
  if (huidigeMediaLijst.length === 0) return
  viewerIndex = (viewerIndex - 1 + huidigeMediaLijst.length) % huidigeMediaLijst.length
  renderViewer()
}

function viewerVolgende(event) {
  if (event) event.stopPropagation()
  if (huidigeMediaLijst.length === 0) return
  viewerIndex = (viewerIndex + 1) % huidigeMediaLijst.length
  renderViewer()
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
  } else if (document.getElementById('lightbox').classList.contains('zichtbaar')) {
    if (e.key === 'ArrowLeft') viewerVorige()
    else if (e.key === 'ArrowRight') viewerVolgende()
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
window.viewerVorige = viewerVorige
window.viewerVolgende = viewerVolgende
window.stuurNaarJukebox = stuurNaarJukebox
window.toggleSelecteerAlleInConcert = toggleSelecteerAlleInConcert
window.verwijderSelectie = verwijderSelectie
