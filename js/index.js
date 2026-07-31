const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getAlleWalls, verwijderWall, hernoemWall } = require('./db/walls.js')
const { getVideosVoorWall, verplaatsVideo, slaVolgordeOp } = require('./db/videos.js')
const { zoekBibliotheek } = require('./db/zoeken.js')

const geluiden = {
  click: new Audio('./sounds/click.mp3'),
  whoosh: new Audio('./sounds/whoosh.wav'),
  open: new Audio('./sounds/open.wav')
}

function speelGeluid(type) {
  const geluid = geluiden[type]
  if (!geluid) return
  geluid.currentTime = 0
  geluid.volume = 0.4
  geluid.play()
}

let active = {}
let videoData = []
let selectie = new Set()
let zoekResultaten = []
let zoekResultatenRuw = []
let zoekTypeFilter = 'alle'
let zoekSelectie = new Set()
let zoekGeneratie = 0

function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(/[?&]v=([^&]+)/)
  return match ? match[1] : null
}

async function getThumbnail(video, idx) {
  const playIcon = '<div class="card-thumb-play">'
    + '<svg viewBox="0 0 24 24" fill="#c8a87a"><polygon points="5,3 19,12 5,21"/></svg>'
    + '</div>'

  const deleteKnop = '<button class="card-delete" title="' + t('video.verwijderenTooltip') + '" onclick="event.stopPropagation();bevestigVerwijderen(' + video.id + ')">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>'
    + '</button>'

  const bewerkKnop = '<button class="card-bewerk" title="' + t('video.bewerkenTooltip') + '" onclick="event.stopPropagation();bewerkVideo(' + idx + ')">✎</button>'

  const bronLabel = video.type === 'youtube'
    ? '<div class="card-bron youtube">' + t('video.bron.youtube') + '</div>'
    : '<div class="card-bron lokaal">' + t('video.bron.lokaal') + '</div>'

  if (video.type === 'youtube') {
    const id = getYoutubeId(video.youtube_url)
    if (id) {
      return '<div class="card-thumb-wrap" data-youtube-url="' + video.youtube_url + '" onclick="if(!event.ctrlKey)speelAfIdx(' + idx + ')">'
        + '<img class="card-thumbnail" loading="lazy" src="https://img.youtube.com/vi/' + id + '/hqdefault.jpg">'
        + playIcon + deleteKnop + bewerkKnop + bronLabel
        + '<div class="card-warning verborgen" title="' + t('video.mogelijkNietBeschikbaar') + '">⚠</div>'
        + '</div>'
    }
  }

  if (video.type === 'lokaal' && video.lokaal_pad) {
    const pad = await ipcRenderer.invoke('maak-thumbnail', video.lokaal_pad)
    if (pad) {
      return '<div class="card-thumb-wrap" onclick="if(!event.ctrlKey)speelAfIdx(' + idx + ')">'
        + '<img class="card-thumbnail" loading="lazy" src="file:///' + pad.replace(/\\/g, '/') + '">'
        + playIcon + deleteKnop + bewerkKnop + bronLabel
        + '</div>'
    }
  }

  return '<div class="card-thumb-wrap" onclick="if(!event.ctrlKey)speelAfIdx(' + idx + ')">'
    + '<div class="card-thumbnail-placeholder">\u25b6</div>'
    + deleteKnop + bronLabel
    + '</div>'
}

function openToevoegen(wallId) {
  ipcRenderer.send('open-toevoegen', wallId)
}

function openImporteren() {
  ipcRenderer.send('open-importeren')
}

function openZoeken() {
  ipcRenderer.send('open-zoeken')
}

function openHelp() {
  ipcRenderer.send('open-help')
}

function openJukebox() {
  ipcRenderer.send('open-jukebox')
}

function stuurNaarJukebox() {
  if (zoekModusActief()) {
    if (zoekSelectie.size === 0) {
      alert(t('jukebox.geenSelectie'))
      return
    }

    const items = zoekResultatenRuw
      .filter(r => zoekSelectie.has(zoekSleutel(r)))
      .map(r => ({ type: r.soort, lokaalPad: r.lokaalPad, youtubeUrl: r.youtubeUrl, artiest: r.artiest, titel: r.titel, coverPad: r.coverPad }))
    ipcRenderer.send('globaal-zoeken-naar-playlist', items)
    zoekSelectie.clear()
    document.querySelectorAll('#globale-zoek-resultaten .card.geselecteerd').forEach(c => c.classList.remove('geselecteerd'))
    updateSelectieInfo()
    return
  }

  if (selectie.size === 0) {
    alert(t('jukebox.geenSelectie'))
    return
  }

  ipcRenderer.send('toevoegen-aan-playlist', Array.from(selectie))
  deselecteerAlles()
}

function verwijderSelectie() {
  if (selectie.size === 0) return

  const idArray = Array.from(selectie)
  const namen = idArray.map(id => {
    const v = videoData.find(v => v.id === id)
    return v ? (v.artiest ? v.artiest + ' — ' : '') + v.titel : ''
  }).join('\n')

  ipcRenderer.send('bevestig-verwijderen-meerdere', { ids: idArray, namen })
  deselecteerAlles()
}

function wisselThema(thema) {
  if (thema) {
    document.documentElement.setAttribute('data-thema', thema)
  } else {
    document.documentElement.removeAttribute('data-thema')
  }
  localStorage.setItem('musicwall-thema', thema)
  ipcRenderer.send('thema-gewijzigd', thema)
}

const themaLabelSleutels = { '': 'thema.standaard', metaal: 'thema.metaal', jukebox: 'thema.jukebox', nacht: 'thema.nacht', jr: 'thema.raw', natuur: 'thema.natuur', licht: 'thema.licht' }

function kiesThema(thema) {
  wisselThema(thema)
  document.getElementById('thema-label').textContent = t(themaLabelSleutels[thema] || 'thema.standaard')
  document.getElementById('thema-dropdown').classList.remove('open')
  document.getElementById('thema-menu').style.display = 'none'
}

function toggleThemaMenu(event) {
  if (event) event.stopPropagation()

  const dropdown = document.getElementById('thema-dropdown')
  const menu = document.getElementById('thema-menu')
  const knop = dropdown.querySelector('.thema-knop')

  const isOpen = menu.style.display === 'block'

  if (isOpen) {
    menu.style.display = 'none'
    dropdown.classList.remove('open')
  } else {
    const rect = knop.getBoundingClientRect()
    menu.style.display = 'block'
    menu.style.top = (rect.bottom + 6) + 'px'
    menu.style.left = (rect.right - menu.offsetWidth) + 'px'
    dropdown.classList.add('open')
  }
}

function kiesTaal(taal) {
  wisselTaal(taal)
  document.getElementById('taal-label').textContent = taal.toUpperCase()
  document.getElementById('taal-dropdown').classList.remove('open')
  document.getElementById('taal-menu').style.display = 'none'
}

function toggleTaalMenu(event) {
  if (event) event.stopPropagation()

  const dropdown = document.getElementById('taal-dropdown')
  const menu = document.getElementById('taal-menu')
  const knop = dropdown.querySelector('.thema-knop')

  const isOpen = menu.style.display === 'block'

  if (isOpen) {
    menu.style.display = 'none'
    dropdown.classList.remove('open')
  } else {
    const rect = knop.getBoundingClientRect()
    menu.style.display = 'block'
    menu.style.top = (rect.bottom + 6) + 'px'
    menu.style.left = (rect.right - menu.offsetWidth) + 'px'
    dropdown.classList.add('open')
  }
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('thema-dropdown')
  const menu = document.getElementById('thema-menu')
  if (dropdown && !dropdown.contains(e.target)) {
    dropdown.classList.remove('open')
    if (menu) menu.style.display = 'none'
  }

  const taalDropdown = document.getElementById('taal-dropdown')
  const taalMenu = document.getElementById('taal-menu')
  if (taalDropdown && !taalDropdown.contains(e.target)) {
    taalDropdown.classList.remove('open')
    if (taalMenu) taalMenu.style.display = 'none'
  }
})

function laadOpgeslagenThema() {
  let thema = localStorage.getItem('musicwall-thema')
  if (thema === null) {
    thema = ''
    localStorage.setItem('musicwall-thema', thema)
  }
  if (thema) {
    document.documentElement.setAttribute('data-thema', thema)
  }
  const label = document.getElementById('thema-label')
  if (label) label.textContent = t(themaLabelSleutels[thema || ''] || 'thema.standaard')
  ipcRenderer.send('thema-gewijzigd', thema || '')

  const taalLabel = document.getElementById('taal-label')
  if (taalLabel) taalLabel.textContent = huidigeTaalCode().toUpperCase()
}

function speelAfIdx(idx) {
  const video = videoData[idx]
  speelGeluid('whoosh')
  if (video.type === 'youtube') {
    ipcRenderer.send('open-video', video.youtube_url)
  } else {
    ipcRenderer.send('open-lokaal', video.lokaal_pad)
  }
}

function zoekModusActief() {
  const el = document.getElementById('globale-zoek-resultaten')
  return !!el && el.style.display !== 'none'
}

function toonZoekResultaten() {
  document.getElementById('walls-container').style.display = 'none'
  document.getElementById('concerten-container').style.display = 'none'
  const albumsContainer = document.getElementById('albums-container')
  if (albumsContainer) albumsContainer.style.display = 'none'
  document.getElementById('globale-zoek-resultaten').style.display = 'grid'
  const prullenbak = document.getElementById('prullenbak')
  if (prullenbak) prullenbak.style.display = 'none'
  const selectieInfo = document.getElementById('selectie-info')
  if (selectieInfo) selectieInfo.style.display = ''
}

// Herstelt na het zoeken exact de container die vóór het zoeken actief was - inclusief het albums-type van
// een groepstab (schakelSectie() zelf verbergt globale-zoek-resultaten al bij het wisselen van tab, dus deze
// functie hoeft alleen het geval "zoekveld leegmaken terwijl dezelfde tab actief blijft" te dekken)
function verbergZoekResultaten() {
  document.getElementById('globale-zoek-resultaten').style.display = 'none'
  const albumsContainer = document.getElementById('albums-container')
  const isConcerten = typeof huidigeSectie !== 'undefined' && huidigeSectie === 'concerten'
  let isAlbumGroep = false
  if (!isConcerten && typeof huidigeSectie !== 'undefined' && huidigeSectie === 'groep' &&
      typeof huidigeGroepId !== 'undefined' && huidigeGroepId && typeof getAlleWallGroepen === 'function') {
    const groep = getAlleWallGroepen().find(g => g.id === huidigeGroepId)
    isAlbumGroep = !!(groep && groep.type === 'albums')
  }
  const isWalls = !isConcerten && !isAlbumGroep
  document.getElementById('walls-container').style.display = isWalls ? 'flex' : 'none'
  document.getElementById('concerten-container').style.display = isConcerten ? 'flex' : 'none'
  if (albumsContainer) albumsContainer.style.display = isAlbumGroep ? 'flex' : 'none'
  const prullenbak = document.getElementById('prullenbak')
  if (prullenbak) prullenbak.style.display = isWalls ? '' : 'none'
  const selectieInfo = document.getElementById('selectie-info')
  if (selectieInfo) selectieInfo.style.display = isWalls ? '' : 'none'
}

function zoekSleutel(resultaat) {
  return resultaat.soort + '|' + (resultaat.lokaalPad || resultaat.youtubeUrl)
}

function zoekLive() {
  const term = document.getElementById('globaal-zoekveld').value.trim()
  const generatie = ++zoekGeneratie

  if (!term) {
    zoekResultatenRuw = []
    zoekResultaten = []
    zoekSelectie.clear()
    verbergZoekResultaten()
    updateSelectieInfo()
    return
  }

  zoekResultatenRuw = zoekBibliotheek(term)
  pasZoekTypeFilterToe()
  toonZoekResultaten()
  renderZoekResultaten(generatie)
}

function zoekMediaSoort(resultaat) {
  if (resultaat.soort === 'youtube') return 'youtube'
  return resultaat.bron === 'album' ? 'muziek' : 'video'
}

function pasZoekTypeFilterToe() {
  zoekResultaten = zoekTypeFilter === 'alle'
    ? zoekResultatenRuw
    : zoekResultatenRuw.filter(r => zoekMediaSoort(r) === zoekTypeFilter)
}

function stelZoekTypeFilter(type) {
  zoekTypeFilter = type
  pasZoekTypeFilterToe()
  const generatie = ++zoekGeneratie
  renderZoekResultaten(generatie)
}

function bouwZoekTypeFilterHtml() {
  return '<div class="zoek-type-filter">'
    + '<button class="zoek-filter-btn' + (zoekTypeFilter === 'alle' ? ' actief' : '') + '" onclick="stelZoekTypeFilter(\'alle\')">' + t('zoeken.filterAlle') + '</button>'
    + '<button class="zoek-filter-btn' + (zoekTypeFilter === 'youtube' ? ' actief' : '') + '" onclick="stelZoekTypeFilter(\'youtube\')">' + t('video.bron.youtube') + '</button>'
    + '<button class="zoek-filter-btn' + (zoekTypeFilter === 'video' ? ' actief' : '') + '" onclick="stelZoekTypeFilter(\'video\')">' + t('zoeken.filterVideo') + '</button>'
    + '<button class="zoek-filter-btn' + (zoekTypeFilter === 'muziek' ? ' actief' : '') + '" onclick="stelZoekTypeFilter(\'muziek\')">' + t('zoeken.filterMuziek') + '</button>'
    + '</div>'
}

async function getZoekThumbnail(resultaat, idx) {
  const playIcon = '<div class="card-thumb-play">'
    + '<svg viewBox="0 0 24 24" fill="#c8a87a"><polygon points="5,3 19,12 5,21"/></svg>'
    + '</div>'

  const bronLabel = resultaat.soort === 'youtube'
    ? '<div class="card-bron youtube">' + t('video.bron.youtube') + '</div>'
    : '<div class="card-bron lokaal">' + t('video.bron.lokaal') + '</div>'

  if (resultaat.soort === 'youtube') {
    const id = getYoutubeId(resultaat.youtubeUrl)
    if (id) {
      return '<div class="card-thumb-wrap" onclick="if(!event.ctrlKey)zoekKlikAfspelen(' + idx + ')">'
        + '<img class="card-thumbnail" loading="lazy" src="https://img.youtube.com/vi/' + id + '/hqdefault.jpg">'
        + playIcon + bronLabel
        + '</div>'
    }
  }

  if (resultaat.coverPad) {
    // albumtrack: hoesafbeelding rechtstreeks tonen, geen ffmpeg-frame-grab proberen op een audio-only bestand
    return '<div class="card-thumb-wrap" onclick="if(!event.ctrlKey)zoekKlikAfspelen(' + idx + ')">'
      + '<img class="card-thumbnail" loading="lazy" src="file:///' + resultaat.coverPad.replace(/\\/g, '/') + '">'
      + playIcon + bronLabel
      + '</div>'
  }

  if (resultaat.lokaalPad) {
    const pad = await ipcRenderer.invoke('maak-thumbnail', resultaat.lokaalPad)
    if (pad) {
      return '<div class="card-thumb-wrap" onclick="if(!event.ctrlKey)zoekKlikAfspelen(' + idx + ')">'
        + '<img class="card-thumbnail" loading="lazy" src="file:///' + pad.replace(/\\/g, '/') + '">'
        + playIcon + bronLabel
        + '</div>'
    }
  }

  return '<div class="card-thumb-wrap" onclick="if(!event.ctrlKey)zoekKlikAfspelen(' + idx + ')">'
    + '<div class="card-thumbnail-placeholder">▶</div>'
    + bronLabel
    + '</div>'
}

async function bouwZoekKaartHtml(resultaat, idx) {
  const sleutel = zoekSleutel(resultaat)
  const thumbnail = await getZoekThumbnail(resultaat, idx)
  const herkomstLabel = resultaat.bron === 'concert'
    ? t('jukebox.herkomstConcert', { naam: resultaat.herkomst })
    : resultaat.bron === 'album'
      ? t('jukebox.herkomstAlbum', { naam: resultaat.herkomst })
      : t('jukebox.herkomstWall', { naam: resultaat.herkomst })
  const geselecteerdClass = zoekSelectie.has(sleutel) ? ' geselecteerd' : ''

  return '<div class="card' + geselecteerdClass + '" onclick="toggleZoekSelectie(event, this,' + idx + ')">'
    + thumbnail
    + '<div class="card-face card-front">'
    + '<div class="card-number">' + (idx + 1) + '</div>'
    + '<div class="card-meta">'
    + '<div class="card-artist">' + (resultaat.artiest || '') + '</div>'
    + '<div class="card-title">' + resultaat.titel + '</div>'
    + '<div class="card-herkomst">' + herkomstLabel + '</div>'
    + '</div>'
    + '</div>'
    + '</div>'
}

async function renderZoekResultaten(generatie) {
  const container = document.getElementById('globale-zoek-resultaten')

  if (zoekResultatenRuw.length === 0) {
    container.innerHTML = '<div class="zoek-leeg">' + t('zoeken.geenResultaten') + '</div>'
    return
  }

  let html = '<div class="zoek-resultaten-balk">'
    + '<button class="zoek-selecteer-alles-btn" onclick="toggleSelecteerAlleZoekResultaten()">' + t('zoeken.selecteerAlles') + '</button>'
    + bouwZoekTypeFilterHtml()
    + '<span class="zoek-aantal">' + t('zoeken.aantalResultaten', { n: zoekResultaten.length }) + '</span>'
    + '</div>'

  if (zoekResultaten.length === 0) {
    html += '<div class="zoek-leeg">' + t('zoeken.geenResultaten') + '</div>'
    container.innerHTML = html
    return
  }

  for (let idx = 0; idx < zoekResultaten.length; idx++) {
    html += await bouwZoekKaartHtml(zoekResultaten[idx], idx)
    if (generatie !== zoekGeneratie) return
  }
  container.innerHTML = html
}

function toggleSelecteerAlleZoekResultaten() {
  if (zoekResultaten.length === 0) return

  const sleutels = zoekResultaten.map(zoekSleutel)
  const alleGeselecteerd = sleutels.every(s => zoekSelectie.has(s))

  sleutels.forEach(s => {
    if (alleGeselecteerd) zoekSelectie.delete(s)
    else zoekSelectie.add(s)
  })

  document.querySelectorAll('#globale-zoek-resultaten .card').forEach((c, i) => {
    c.classList.toggle('geselecteerd', zoekSelectie.has(sleutels[i]))
  })

  updateSelectieInfo()
}

function zoekKlikAfspelen(idx) {
  const resultaat = zoekResultaten[idx]
  if (!resultaat) return
  speelGeluid('whoosh')
  if (resultaat.soort === 'youtube') {
    ipcRenderer.send('open-video', resultaat.youtubeUrl)
  } else {
    ipcRenderer.send('open-lokaal', resultaat.lokaalPad, resultaat.coverPad)
  }
}

function toggleZoekSelectie(event, cardEl, idx) {
  if (!event.ctrlKey) return

  event.stopPropagation()
  event.preventDefault()

  const resultaat = zoekResultaten[idx]
  if (!resultaat) return
  const sleutel = zoekSleutel(resultaat)

  if (zoekSelectie.has(sleutel)) {
    zoekSelectie.delete(sleutel)
    cardEl.classList.remove('geselecteerd')
  } else {
    zoekSelectie.add(sleutel)
    cardEl.classList.add('geselecteerd')
  }

  updateSelectieInfo()
}

ipcRenderer.on('herlaad', () => {
  laadWalls()
})

function voegWallToe() {
  const groepId = typeof huidigeGroepId !== 'undefined' ? huidigeGroepId : null
  ipcRenderer.send('open-nieuwe-wall', groepId)
}

function bevestigWallVerwijderen(wallId, wallNaam) {
  ipcRenderer.send('bevestig-wall-verwijderen', { wallId, wallNaam })
}

function hernoemWallPrompt(wallId, huidigeNaam) {
  ipcRenderer.send('open-hernoem-wall', { wallId, huidigeNaam })
}

function bevestigVerwijderen(videoId) {
  const video = videoData.find(v => v.id === videoId)
  if (!video) return
  const naam = (video.artiest ? video.artiest + ' — ' : '') + video.titel
  ipcRenderer.send('bevestig-verwijderen', { videoId, naam })
}

function bewerkVideo(idx) {
  const video = videoData[idx]
  if (!video) return
  ipcRenderer.send('open-bewerken', video)
}

function toggleSelectie(event, cardEl, videoId) {
  if (!event.ctrlKey) return

  event.stopPropagation()
  event.preventDefault()

  if (selectie.has(videoId)) {
    selectie.delete(videoId)
    cardEl.classList.remove('geselecteerd')
  } else {
    selectie.add(videoId)
    cardEl.classList.add('geselecteerd')
  }

  updateSelectieInfo()
}

function updateSelectieInfo() {
  const info = document.getElementById('selectie-info')
  const tekst = document.getElementById('selectie-tekst')
  const verwijderBtn = document.getElementById('verwijder-selectie-btn')
  const zoekActief = zoekModusActief()
  const actieveSelectie = zoekActief ? zoekSelectie : selectie

  if (actieveSelectie.size === 0) {
    info.classList.remove('zichtbaar')
  } else {
    info.classList.add('zichtbaar')
    tekst.textContent = t('selectie.tekst', { n: actieveSelectie.size })
  }

  if (verwijderBtn) verwijderBtn.style.display = zoekActief ? 'none' : ''
}

function deselecteerAlles() {
  document.querySelectorAll('.card.geselecteerd').forEach(c => c.classList.remove('geselecteerd'))
  selectie.clear()
  updateSelectieInfo()
}

function toggleSelecteerAlleInWall(wallId) {
  const wallEl = document.getElementById('wall-' + wallId)
  if (!wallEl) return

  const alleVideos = getVideosVoorWall(wallId)
  if (alleVideos.length === 0) return

  const alleGeselecteerd = alleVideos.every(v => selectie.has(v.id))

  alleVideos.forEach(v => {
    if (alleGeselecteerd) {
      selectie.delete(v.id)
    } else {
      selectie.add(v.id)
    }
  })

  wallEl.querySelectorAll('.card').forEach(c => {
    c.classList.toggle('geselecteerd', selectie.has(parseInt(c.dataset.videoId)))
  })

  updateSelectieInfo()
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return

  if (zoekModusActief()) {
    zoekSelectie.clear()
    document.querySelectorAll('#globale-zoek-resultaten .card.geselecteerd').forEach(c => c.classList.remove('geselecteerd'))
    updateSelectieInfo()
  } else {
    deselecteerAlles()
  }
})

function prullenbakOver(event) {
  event.preventDefault()
  document.getElementById('prullenbak').classList.add('hover')
}

function prullenbakLeave(event) {
  document.getElementById('prullenbak').classList.remove('hover')
}

function prullenbakDrop(event) {
  event.preventDefault()
  document.getElementById('prullenbak').classList.remove('hover')

  const ids = event.dataTransfer.getData('selectieIds')
  if (ids) {
    const idArray = ids.split(',').map(id => parseInt(id))
    const namen = idArray.map(id => {
      const v = videoData.find(v => v.id === id)
      return v ? (v.artiest ? v.artiest + ' — ' : '') + v.titel : ''
    }).join('\n')
    ipcRenderer.send('bevestig-verwijderen-meerdere', { ids: idArray, namen })
  }
}

function dragStart(event, videoId) {
  if (selectie.size > 0 && selectie.has(videoId)) {
    const ids = Array.from(selectie).join(',')
    event.dataTransfer.setData('videoId', videoId.toString())
    event.dataTransfer.setData('selectieIds', ids)
    document.querySelectorAll('.card.geselecteerd').forEach(c => c.style.opacity = '0.4')
  } else {
    deselecteerAlles()
    event.dataTransfer.setData('videoId', videoId.toString())
    event.dataTransfer.setData('selectieIds', videoId.toString())
    event.currentTarget.style.opacity = '0.4'
  }
  document.getElementById('prullenbak').classList.add('actief')
}

function dragEnd(event) {
  document.querySelectorAll('.card').forEach(c => c.style.opacity = '1')
  document.getElementById('prullenbak').classList.remove('actief')
}

function dragOver(event) {
  event.preventDefault()
  event.currentTarget.classList.add('drag-over')
}

function dragLeave(event) {
  event.currentTarget.classList.remove('drag-over')
}

let sleepBronId = null
let sleepBronWallId = null
let sleepWallBronId = null

function wallDragStart(event, wallId) {
  sleepWallBronId = wallId
  event.dataTransfer.setData('wallId', wallId.toString())
  event.currentTarget.closest('.wall').style.opacity = '0.4'
}

function wallDragEnd(event) {
  document.querySelectorAll('.wall').forEach(w => w.style.opacity = '1')
  sleepWallBronId = null
}

function wallDragOver(event, el) {
  if (sleepWallBronId === null) return
  event.preventDefault()
  el.classList.add('drag-over-kaart')
}

function wallDragLeave(el) {
  el.classList.remove('drag-over-kaart')
}

function wallDrop(event, doelWallId) {
  const bronWallId = parseInt(event.dataTransfer.getData('wallId'))
  if (!bronWallId) return

  event.preventDefault()
  event.currentTarget.classList.remove('drag-over-kaart')

  if (bronWallId === doelWallId) return

  const container = document.getElementById('walls-container')
  const bronWall = document.getElementById('wall-' + bronWallId)
  const doelWall = document.getElementById('wall-' + doelWallId)
  if (!bronWall || !doelWall) return

  const walls = Array.from(container.querySelectorAll('.wall'))
  const bronIdx = walls.indexOf(bronWall)
  const doelIdx = walls.indexOf(doelWall)

  if (bronIdx < doelIdx) {
    container.insertBefore(bronWall, doelWall.nextSibling)
  } else {
    container.insertBefore(bronWall, doelWall)
  }

  const nieuweVolgorde = Array.from(container.querySelectorAll('.wall'))
    .map(w => parseInt(w.id.replace('wall-', '')))
    .filter(id => !isNaN(id))

  ipcRenderer.send('sla-wall-volgorde-op', nieuweVolgorde)
}

function kaartDragStart(event, videoId, wallId) {
  sleepBronId = videoId
  sleepBronWallId = wallId

  if (selectie.size > 0 && selectie.has(videoId)) {
    const ids = Array.from(selectie).join(',')
    event.dataTransfer.setData('videoId', videoId.toString())
    event.dataTransfer.setData('selectieIds', ids)
    document.querySelectorAll('.card.geselecteerd').forEach(c => c.style.opacity = '0.4')
  } else {
    deselecteerAlles()
    event.dataTransfer.setData('videoId', videoId.toString())
    event.dataTransfer.setData('selectieIds', videoId.toString())
    event.currentTarget.style.opacity = '0.4'
  }
  document.getElementById('prullenbak').classList.add('actief')
}

function kaartDragOver(event, el) {
  event.preventDefault()
  el.classList.add('drag-over-kaart')
}

function kaartDragLeave(el) {
  el.classList.remove('drag-over-kaart')
}

function kaartDrop(event, doelVideoId, wallId) {
  event.preventDefault()

  const bronId = parseInt(event.dataTransfer.getData('videoId'))
  if (!bronId) return

  const bronCard = document.querySelector('[data-video-id="' + bronId + '"]')
  const doelCard = document.querySelector('[data-video-id="' + doelVideoId + '"]')
  if (!bronCard || !doelCard) return

  const bronWall = bronCard.closest('.wall-videos')
  const doelWall = doelCard.closest('.wall-videos')

  doelCard.classList.remove('drag-over-kaart')
  bronCard.style.opacity = '1'
  document.getElementById('prullenbak').classList.remove('actief')

  if (bronWall.isSameNode(doelWall) && bronId !== doelVideoId) {
    event.stopPropagation()

    const flipState = window.Flip ? Flip.getState(doelWall.querySelectorAll('[data-flip-id]')) : null

    const cards = Array.from(doelWall.querySelectorAll('.card'))
    const bronIdx = cards.indexOf(bronCard)
    const doelIdx = cards.indexOf(doelCard)

    if (bronIdx < doelIdx) {
      doelWall.insertBefore(bronCard, doelCard.nextSibling)
    } else {
      doelWall.insertBefore(bronCard, doelCard)
    }

    if (flipState) Flip.from(flipState, { duration: 0.4, ease: 'power2.inOut' })

    const nieuweVolgorde = Array.from(doelWall.querySelectorAll('.card'))
      .map(c => parseInt(c.dataset.videoId))
      .filter(id => !isNaN(id))

    ipcRenderer.send('sla-volgorde-op', nieuweVolgorde)
  }

  sleepBronId = null
  sleepBronWallId = null
}

async function drop(event, wallId) {
  event.preventDefault()
  event.currentTarget.classList.remove('drag-over')

  const ids = event.dataTransfer.getData('selectieIds')
  if (ids) {
    const flipState = window.Flip ? Flip.getState(document.querySelectorAll('[data-flip-id]')) : null

    ids.split(',').forEach(id => {
      verplaatsVideo(parseInt(id), wallId)
    })
    deselecteerAlles()
    await laadWalls()

    if (flipState) Flip.from(flipState, { duration: 0.5, ease: 'power2.inOut', stagger: 0.02, absolute: true })
  }
}

function toggle(wallId, n) {
  const inner = document.getElementById('flip' + wallId + '-' + n)
  const ch = document.getElementById('ch' + wallId + '-' + n)
  const isOpen = inner.classList.contains('flipped')
  speelGeluid(isOpen ? 'click' : 'open')

  if (active[wallId] && active[wallId] !== n) {
    const vorigeInner = document.getElementById('flip' + wallId + '-' + active[wallId])
    const vorigeCh = document.getElementById('ch' + wallId + '-' + active[wallId])
    vorigeInner.classList.remove('flipped')
    if (window.gsap) {
      gsap.to(vorigeInner, { rotationY: 0, duration: 0.5, ease: 'power2.inOut' })
    }
    vorigeCh.classList.remove('open')
  }

  if (isOpen) {
    inner.classList.remove('flipped')
    if (window.gsap) gsap.to(inner, { rotationY: 0, duration: 0.5, ease: 'power2.inOut' })
    ch.classList.remove('open')
    active[wallId] = null
  } else {
    inner.classList.add('flipped')
    ch.classList.add('open')
    active[wallId] = n
    if (window.gsap) gsap.to(inner, { rotationY: 180, duration: 0.5, ease: 'power2.inOut' })
  }
}

function kaartHoverIn(el) {
  if (window.gsap) gsap.to(el, { scale: 1.02, duration: 0.2, ease: 'power2.out' })
}

function kaartHoverUit(el) {
  if (window.gsap) gsap.to(el, { scale: 1, duration: 0.2, ease: 'power2.out' })
}

// Eén gedeelde observer i.p.v. per kaart: alleen kaarten die daadwerkelijk in beeld zijn krijgen de
// .card-ademend-animatie, kaarten buiten het zichtbare (scrollbare) gebied van hun wall niet - bij walls met
// veel video's draaide de animatie voorheen ook door voor tientallen kaarten die de gebruiker nooit ziet.
// rootMargin geeft een kleine marge zodat de animatie net vóór het scrollen in beeld al aan/uit gaat, i.p.v.
// een merkbare "flits" precies op de rand.
let ademObserver = null

function krijgAdemObserver() {
  if (!ademObserver) {
    ademObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('card-ademend', entry.isIntersecting))
    }, { rootMargin: '150px' })
  }
  return ademObserver
}

function startKaartAdemhaling(cardEls) {
  // Zie css/index.css's .card-ademend: dit was ooit een losse GSAP-tween per kaart, nu een puur CSS-gedreven
  // animatie, alleen actief zolang de observer de kaart als zichtbaar meldt. --adem-duur is een volledige
  // heen-en-terug-cyclus (dus 2x de oude GSAP-duration per richting).
  const observer = krijgAdemObserver()
  cardEls.forEach(el => {
    el.style.setProperty('--adem-duur', (6 + Math.random() * 4) + 's')
    el.style.setProperty('--adem-vertraging', (Math.random() * 3) + 's')
    observer.observe(el)
  })
}

window.addEventListener('mousemove', (e) => {
  const container = document.getElementById('walls-container')
  if (!container) return

  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  const dx = (e.clientX - cx) / cx
  const dy = (e.clientY - cy) / cy

  const walls = container.querySelectorAll('.wall')
  walls.forEach((wall, i) => {
    const diepte = (i % 3 + 1) * 1
    wall.style.transform = 'translate(' + (dx * diepte * -1) + 'px, ' + (dy * diepte * 0.5 * -1) + 'px)'
    wall.style.transition = 'transform 0.3s ease-out'
  })
})

const KAART_RENDER_LIMIT = 150

async function bouwKaartHtml(video, wallId, idx, n) {
  const thumbnail = await getThumbnail(video, idx)
  const geselecteerdClass = selectie.has(video.id) ? ' geselecteerd' : ''

  return '<div class="card' + geselecteerdClass + '" id="c' + wallId + '-' + n + '" data-video-id="' + video.id + '" data-flip-id="video-' + video.id + '"'
    + ' draggable="true"'
    + ' ondragstart="kaartDragStart(event,' + video.id + ',' + wallId + ')"'
    + ' ondragend="dragEnd(event)"'
    + ' ondragover="kaartDragOver(event, this)"'
    + ' ondragleave="kaartDragLeave(this)"'
    + ' ondrop="kaartDrop(event,' + video.id + ',' + wallId + ')"'
    + ' onclick="toggleSelectie(event, this,' + video.id + ')"'
    + ' onmouseenter="kaartHoverIn(this)"'
    + ' onmouseleave="kaartHoverUit(this)">'
    + thumbnail
    + '<div class="card-flip" onclick="toggle(' + wallId + ',' + n + ')">'
    + '<div class="card-flip-inner" id="flip' + wallId + '-' + n + '">'
    + '<div class="card-face card-front">'
    + '<div class="card-number">0' + n + '</div>'
    + '<div class="card-meta">'
    + '<div class="card-artist">' + (video.artiest || '') + '</div>'
    + '<div class="card-title">' + video.titel + '</div>'
    + '<div class="card-tag">\u25cf ' + (video.tag || '') + '</div>'
    + '</div>'
    + '<div class="chevron" id="ch' + wallId + '-' + n + '">&#8964;</div>'
    + '</div>'
    + '<div class="card-face card-back">'
    + '<div class="card-story"><p>' + (video.verhaal || '') + '</p></div>'
    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>'
}

async function toonAlleKaarten(wallId) {
  const wallVideosEl = document.querySelector('#wall-' + wallId + ' .wall-videos')
  const knop = wallVideosEl && wallVideosEl.querySelector('.wall-toon-meer-btn')
  if (!wallVideosEl || !knop) return

  const videos = getVideosVoorWall(wallId)
  const alGerenderd = wallVideosEl.querySelectorAll('.card').length
  const startIdx = videoData.findIndex(v => v.id === videos[0].id)

  let toegevoegd = ''
  for (let index = alGerenderd; index < videos.length; index++) {
    toegevoegd += await bouwKaartHtml(videos[index], wallId, startIdx + index, index + 1)
  }

  const tijdelijk = document.createElement('div')
  tijdelijk.innerHTML = toegevoegd
  const nieuweKaarten = Array.from(tijdelijk.children)
  nieuweKaarten.forEach(kaart => wallVideosEl.insertBefore(kaart, knop))
  knop.remove()

  if (window.gsap && nieuweKaarten.length > 0) {
    gsap.fromTo(nieuweKaarten, { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: Math.min(0.02, 0.6 / nieuweKaarten.length) })
  }
  startKaartAdemhaling(nieuweKaarten)
  controleerKaartenInContainer(wallVideosEl)
}

async function laadWalls() {
  const container = document.getElementById('walls-container')
  container.innerHTML = ''
  // Voorkomt dat de ademhaling-observer (zie startKaartAdemhaling) kaarten van de vorige render blijft
  // volgen nadat hun DOM-node hierboven al vervangen is - observe() zonder een bijbehorende unobserve() zou
  // die verwijderde kaarten voor altijd als geobserveerd blijven vasthouden
  if (ademObserver) ademObserver.disconnect()

  const alleWalls = getAlleWalls()
  const walls = typeof huidigeGroepId !== 'undefined' && huidigeGroepId
    ? alleWalls.filter(w => w.groep_id === huidigeGroepId)
    : alleWalls.filter(w => !w.groep_id)
  videoData = []

  for (const wall of walls) {
    const videos = getVideosVoorWall(wall.id)
    const wallStartIdx = videoData.length
    videos.forEach(v => videoData.push(v))

    let kaarten = ''
    const renderAantal = Math.min(videos.length, KAART_RENDER_LIMIT)

    for (let index = 0; index < renderAantal; index++) {
      kaarten += await bouwKaartHtml(videos[index], wall.id, wallStartIdx + index, index + 1)
    }

    const verborgenAantal = videos.length - renderAantal
    if (verborgenAantal > 0) {
      kaarten += '<button class="wall-toon-meer-btn" onclick="toonAlleKaarten(' + wall.id + ')">' + t('wall.toonAlle', { n: verborgenAantal }) + '</button>'
    }

    const wallHtml = '<div class="wall" id="wall-' + wall.id + '">'
      + '<div class="wall-header"'
      + ' draggable="true"'
      + ' ondragstart="wallDragStart(event,' + wall.id + ')"'
      + ' ondragend="wallDragEnd(event)"'
      + ' ondragover="wallDragOver(event, this)"'
      + ' ondragleave="wallDragLeave(this)"'
      + ' ondrop="wallDrop(event,' + wall.id + ')">'
      + '<span class="wall-naam" onclick="hernoemWallPrompt(' + wall.id + ',\'' + wall.naam.replace(/'/g, "\\'") + '\')" title="' + t('wall.hernoemenTooltip') + '" style="cursor:pointer">' + wall.naam + '</span>'
      + '<div style="display:flex;align-items:center;gap:0.5rem">'
      + '<span class="wall-aantal">' + videos.length + '</span>'
      + (videos.length > 0
        ? '<button class="wall-selecteer-btn" onclick="toggleSelecteerAlleInWall(' + wall.id + ')" title="' + t('wall.selecteerAllesTooltip') + '">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7,12 10.5,15.5 17,8.5"/></svg>'
          + '</button>'
        : '')
      + '<button class="wall-verwijder-btn" onclick="bevestigWallVerwijderen(' + wall.id + ',\'' + wall.naam.replace(/'/g, "\\'") + '\')" title="' + t('wall.verwijderenTooltip') + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>'
      + '</button>'
      + '</div>'
      + '</div>'
      + '<div class="wall-videos"'
      + ' ondragover="dragOver(event)"'
      + ' ondragleave="dragLeave(event)"'
      + ' ondrop="drop(event,' + wall.id + ')">'
      + kaarten + '</div>'
      + '<div class="wall-footer">'
      + '<button class="wall-toevoegen-btn" onclick="openToevoegen(' + wall.id + ')">' + t('wall.nummerToevoegen') + '</button>'
      + '</div>'
      + '</div>'

    container.innerHTML += wallHtml
  }

  container.innerHTML += '<button class="nieuwe-wall-btn" onclick="voegWallToe()" title="' + t('wall.nieuweWall') + '">+</button>'

  if (window.gsap) {
    gsap.fromTo(document.querySelectorAll('.wall'),
      { opacity: 0, y: 24, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', stagger: 0.08 }
    )
    const kaartElementen = container.querySelectorAll('.card')
    const kaartStagger = kaartElementen.length > 0 ? Math.min(0.03, 0.6 / kaartElementen.length) : 0.03
    gsap.fromTo(kaartElementen,
      { opacity: 0, x: -12 },
      { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out', stagger: kaartStagger, delay: 0.2 }
    )
    startKaartAdemhaling(Array.from(kaartElementen))
  } else {
    document.querySelectorAll('.wall, .card').forEach(el => { el.style.opacity = '1' })
  }

  controleerKaartenInContainer(container)
}

laadWalls()
laadOpgeslagenThema()

document.addEventListener('taal-gewijzigd', () => {
  laadWalls()
  if (huidigeSectie === 'concerten' && typeof laadConcerten === 'function') laadConcerten()
})

window.kiesTaal = kiesTaal
window.toggleTaalMenu = toggleTaalMenu
window.wisselThema = wisselThema
window.toggle = toggle
window.speelAfIdx = speelAfIdx
window.openToevoegen = openToevoegen
window.openImporteren = openImporteren
window.voegWallToe = voegWallToe
window.bevestigVerwijderen = bevestigVerwijderen
window.bewerkVideo = bewerkVideo
window.dragStart = dragStart
window.dragEnd = dragEnd
window.dragOver = dragOver
window.dragLeave = dragLeave
window.drop = drop
window.prullenbakOver = prullenbakOver
window.prullenbakLeave = prullenbakLeave
window.prullenbakDrop = prullenbakDrop
window.toggleSelectie = toggleSelectie
window.toggleSelecteerAlleInWall = toggleSelecteerAlleInWall
window.toonAlleKaarten = toonAlleKaarten
window.kaartHoverIn = kaartHoverIn
window.kaartHoverUit = kaartHoverUit
window.openJukebox = openJukebox
window.stuurNaarJukebox = stuurNaarJukebox
window.verwijderSelectie = verwijderSelectie
window.openHelp = openHelp
window.bevestigWallVerwijderen = bevestigWallVerwijderen
window.hernoemWallPrompt = hernoemWallPrompt
window.kiesThema = kiesThema
window.toggleThemaMenu = toggleThemaMenu
window.openZoeken = openZoeken
window.kaartDragStart = kaartDragStart
window.kaartDragOver = kaartDragOver
window.kaartDragLeave = kaartDragLeave
window.kaartDrop = kaartDrop
window.wallDragStart = wallDragStart
window.wallDragEnd = wallDragEnd
window.wallDragOver = wallDragOver
window.wallDragLeave = wallDragLeave
window.wallDrop = wallDrop
window.zoekLive = zoekLive
window.zoekKlikAfspelen = zoekKlikAfspelen
window.toggleZoekSelectie = toggleZoekSelectie
window.toggleSelecteerAlleZoekResultaten = toggleSelecteerAlleZoekResultaten
window.stelZoekTypeFilter = stelZoekTypeFilter

if (window.gsap) {
  const introTl = gsap.timeline({ delay: 0.2 })

  if (document.querySelector('.logo')) {
    introTl.fromTo('.logo',
      { opacity: 0, letterSpacing: '0.8em' },
      { opacity: 1, letterSpacing: '0.4em', duration: 1.2, ease: 'power3.out' }
    )
  }

  if (document.querySelector('h1')) {
    introTl.fromTo('h1',
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' },
      '-=0.7'
    )
  }

  if (document.querySelectorAll('.toevoegen-btn').length > 0) {
    introTl.fromTo('.toevoegen-btn',
      { opacity: 0, x: -15 },
      { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out', stagger: 0.08 },
      '-=0.3'
    )
  }

  if (document.querySelector('.thema-dropdown')) {
    introTl.fromTo('.thema-dropdown',
      { opacity: 0, x: 15 },
      { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' },
      '-=0.4'
    )
  }
} else {
  document.querySelectorAll('.toevoegen-btn, .thema-dropdown, .logo, h1').forEach(el => {
    el.style.opacity = '1'
  })
}