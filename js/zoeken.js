const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const fs = require('fs')
const path = require('path')
const { getAlleWalls } = require('./db/walls.js')
const { getAlleWallGroepen } = require('./db/wallgroepen.js')
const { voegVideoToe } = require('./db/videos.js')

let apiKey = ''
let resultatenData = {}
let selectie = new Set()
let zoekModus = 'videos'
let huidigePlaylistId = null
let playlistResultatenCache = []

async function laadApiSleutel() {
  try {
    const instellingenPad = await ipcRenderer.invoke('get-instellingen-pad')

    if (!fs.existsSync(instellingenPad)) {
      const voorbeeldPad = await ipcRenderer.invoke('get-instellingen-voorbeeld-pad')
      if (fs.existsSync(voorbeeldPad)) {
        fs.copyFileSync(voorbeeldPad, instellingenPad)
      }
    }

    const instellingen = JSON.parse(fs.readFileSync(instellingenPad, 'utf8'))
    apiKey = instellingen.youtubeApiKey

    if (!apiKey || apiKey.includes('VUL_HIER')) {
      document.getElementById('resultaten').innerHTML = '<div class="fout">' + t('zoeken.apiKeyOntbreekt', { pad: instellingenPad }) + '</div>'
    }
  } catch (e) {
    console.error('Fout bij laden instellingen:', e.message)
    document.getElementById('resultaten').innerHTML = '<div class="fout">' + t('zoeken.instellingenFout', { bericht: e.message }) + '</div>'
  }
}

laadApiSleutel()

function laadGroepen() {
  const groepen = getAlleWallGroepen()
  const select = document.getElementById('groep-keuze')
  select.innerHTML = ''

  const ongegroepeerdOpt = document.createElement('option')
  ongegroepeerdOpt.value = ''
  ongegroepeerdOpt.textContent = t('tabs.walls')
  select.appendChild(ongegroepeerdOpt)

  groepen.forEach(groep => {
    const opt = document.createElement('option')
    opt.value = groep.id
    opt.textContent = groep.naam
    select.appendChild(opt)
  })

  select.onchange = laadWallsVoorGroep
  laadWallsVoorGroep()
}

function laadWallsVoorGroep() {
  const groepId = parseInt(document.getElementById('groep-keuze').value) || null
  const walls = getAlleWalls().filter(w => groepId ? w.groep_id === groepId : !w.groep_id)
  const select = document.getElementById('wall-keuze')
  select.innerHTML = ''

  if (walls.length === 0) {
    const opt = document.createElement('option')
    opt.value = ''
    opt.textContent = t('wallGroep.geenWalls')
    opt.disabled = true
    select.appendChild(opt)
    return
  }

  walls.forEach(wall => {
    const opt = document.createElement('option')
    opt.value = wall.id
    opt.textContent = wall.naam
    select.appendChild(opt)
  })
}

function stelModusIn(modus) {
  zoekModus = modus
  huidigePlaylistId = null
  playlistResultatenCache = []
  resultatenData = {}
  deselecteerAlles()

  document.getElementById('modus-videos-btn').classList.toggle('actief', modus === 'videos')
  document.getElementById('modus-playlists-btn').classList.toggle('actief', modus === 'playlists')

  const zoektermInput = document.getElementById('zoekterm')
  zoektermInput.placeholder = t(modus === 'playlists' ? 'zoeken.playlistZoektermPlaceholder' : 'zoeken.zoektermPlaceholder')

  document.getElementById('resultaten').innerHTML = ''
}

function zoek() {
  if (zoekModus === 'playlists') {
    huidigePlaylistId = null
    zoekPlaylists()
  } else {
    zoekVideos()
  }
}

async function zoekVideos() {
  const term = document.getElementById('zoekterm').value.trim()
  if (!term) return

  const resultaten = document.getElementById('resultaten')
  resultaten.innerHTML = '<div class="laden">' + t('zoeken.zoeken') + '</div>'
  resultatenData = {}
  deselecteerAlles()

  try {
    const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q='
      + encodeURIComponent(term) + '&key=' + apiKey

    const response = await fetch(url)
    const data = await response.json()

    if (data.error) {
      resultaten.innerHTML = '<div class="fout">' + t('zoeken.fout', { bericht: data.error.message }) + '</div>'
      return
    }

    if (!data.items || data.items.length === 0) {
      resultaten.innerHTML = '<div class="geen-resultaten">' + t('zoeken.geenResultaten') + '</div>'
      return
    }

    resultaten.innerHTML = ''
    const acties = document.createElement('div')
    acties.className = 'resultaten-acties'
    acties.innerHTML = '<button class="selecteer-alles-btn" onclick="selecteerAlleZoekresultaten()">' + t('zoeken.selecteerAlles') + '</button>'
    resultaten.appendChild(acties)

    data.items.forEach(item => {
      const videoId = item.id.videoId
      const titel = item.snippet.title
      const kanaal = item.snippet.channelTitle
      const thumb = item.snippet.thumbnails.medium.url

      resultatenData[videoId] = { titel, kanaal }

      const el = document.createElement('div')
      el.className = 'resultaat'
      el.id = 'res-' + videoId
      el.innerHTML = '<img src="' + thumb + '">'
        + '<div class="resultaat-info">'
        + '<div class="resultaat-titel">' + titel + '</div>'
        + '<div class="resultaat-kanaal">' + kanaal + '</div>'
        + '</div>'

      el.onclick = () => toggleSelectie(videoId, el)
      resultaten.appendChild(el)
    })
  } catch (err) {
    resultaten.innerHTML = '<div class="fout">' + t('zoeken.misgegaan', { bericht: err.message }) + '</div>'
  }
}

async function zoekPlaylists() {
  const term = document.getElementById('zoekterm').value.trim()
  if (!term) return

  const resultaten = document.getElementById('resultaten')
  resultaten.innerHTML = '<div class="laden">' + t('zoeken.zoeken') + '</div>'
  deselecteerAlles()

  try {
    const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=playlist&maxResults=50&q='
      + encodeURIComponent(term) + '&key=' + apiKey

    const response = await fetch(url)
    const data = await response.json()

    if (data.error) {
      resultaten.innerHTML = '<div class="fout">' + t('zoeken.fout', { bericht: data.error.message }) + '</div>'
      return
    }

    if (!data.items || data.items.length === 0) {
      playlistResultatenCache = []
      resultaten.innerHTML = '<div class="geen-resultaten">' + t('zoeken.geenPlaylists') + '</div>'
      return
    }

    playlistResultatenCache = data.items.map(item => {
      const thumbs = item.snippet.thumbnails || {}
      return {
        id: item.id.playlistId,
        titel: item.snippet.title,
        kanaal: item.snippet.channelTitle,
        thumb: (thumbs.medium || thumbs.default || thumbs.high || thumbs.standard || thumbs.maxres || {}).url || ''
      }
    })

    renderPlaylistLijst()
  } catch (err) {
    resultaten.innerHTML = '<div class="fout">' + t('zoeken.misgegaan', { bericht: err.message }) + '</div>'
  }
}

function renderPlaylistLijst() {
  const resultaten = document.getElementById('resultaten')
  resultaten.innerHTML = ''

  playlistResultatenCache.forEach(playlist => {
    const el = document.createElement('div')
    el.className = 'resultaat'
    el.innerHTML = (playlist.thumb ? '<img src="' + playlist.thumb + '">' : '')
      + '<div class="resultaat-info">'
      + '<div class="resultaat-titel">' + playlist.titel + '</div>'
      + '<div class="resultaat-kanaal">' + playlist.kanaal + '</div>'
      + '</div>'

    el.onclick = () => toonPlaylistVideos(playlist.id)
    resultaten.appendChild(el)
  })
}

async function toonPlaylistVideos(playlistId) {
  huidigePlaylistId = playlistId
  resultatenData = {}
  deselecteerAlles()

  const resultaten = document.getElementById('resultaten')
  resultaten.innerHTML = '<div class="laden">' + t('zoeken.zoeken') + '</div>'

  try {
    const items = []
    let pageToken = ''
    let pagina = 0

    do {
      const url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId='
        + playlistId + '&key=' + apiKey + (pageToken ? '&pageToken=' + pageToken : '')

      const response = await fetch(url)
      const data = await response.json()

      if (data.error) {
        resultaten.innerHTML = '<div class="fout">' + t('zoeken.fout', { bericht: data.error.message }) + '</div>'
        return
      }

      items.push(...(data.items || []))
      pageToken = data.nextPageToken || ''
      pagina++
    } while (pageToken && pagina < 100)

    resultaten.innerHTML = ''

    const navigatie = document.createElement('div')
    navigatie.className = 'playlist-navigatie'
    navigatie.innerHTML = '<button class="terug-btn" onclick="terugNaarPlaylists()">' + t('zoeken.terugNaarPlaylists') + '</button>'
      + '<button class="selecteer-alles-btn" onclick="selecteerAlleZoekresultaten()">' + t('zoeken.selecteerAlles') + '</button>'
    resultaten.appendChild(navigatie)

    const onbeschikbareTitels = ['private video', 'deleted video']
    const geldigeItems = items.filter(item => {
      if (!item.snippet || !item.snippet.resourceId || !item.snippet.resourceId.videoId) return false
      const titel = (item.snippet.title || '').trim().toLowerCase()
      return !onbeschikbareTitels.includes(titel)
    })

    if (geldigeItems.length === 0) {
      resultaten.innerHTML += '<div class="geen-resultaten">' + t('zoeken.geenResultaten') + '</div>'
      return
    }

    geldigeItems.forEach(item => {
      const videoId = item.snippet.resourceId.videoId
      const titel = item.snippet.title
      const kanaal = item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle
      const thumbs = item.snippet.thumbnails || {}
      const thumb = (thumbs.medium || thumbs.default || thumbs.high || thumbs.standard || thumbs.maxres || {}).url || ''

      resultatenData[videoId] = { titel, kanaal }

      const el = document.createElement('div')
      el.className = 'resultaat'
      el.id = 'res-' + videoId
      el.innerHTML = (thumb ? '<img src="' + thumb + '">' : '')
        + '<div class="resultaat-info">'
        + '<div class="resultaat-titel">' + titel + '</div>'
        + '<div class="resultaat-kanaal">' + kanaal + '</div>'
        + '</div>'

      el.onclick = () => toggleSelectie(videoId, el)
      resultaten.appendChild(el)
    })
  } catch (err) {
    resultaten.innerHTML = '<div class="fout">' + t('zoeken.misgegaan', { bericht: err.message }) + '</div>'
  }
}

function terugNaarPlaylists() {
  huidigePlaylistId = null
  resultatenData = {}
  deselecteerAlles()
  renderPlaylistLijst()
}

function selecteerAlleZoekresultaten() {
  const els = Array.from(document.querySelectorAll('#resultaten .resultaat:not(.toegevoegd)'))
  if (els.length === 0) return

  const alleGeselecteerd = els.every(el => el.classList.contains('geselecteerd'))

  els.forEach(el => {
    const videoId = el.id.replace('res-', '')
    if (alleGeselecteerd) {
      selectie.delete(videoId)
      el.classList.remove('geselecteerd')
    } else {
      selectie.add(videoId)
      el.classList.add('geselecteerd')
    }
  })

  updateSelectieInfo()
}

function toggleSelectie(videoId, el) {
  if (el.classList.contains('toegevoegd')) return

  if (selectie.has(videoId)) {
    selectie.delete(videoId)
    el.classList.remove('geselecteerd')
  } else {
    selectie.add(videoId)
    el.classList.add('geselecteerd')
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
  document.querySelectorAll('.resultaat.geselecteerd').forEach(el => el.classList.remove('geselecteerd'))
  selectie.clear()
  updateSelectieInfo()
}

function voegGeselecteerdeToe() {
  const wallId = parseInt(document.getElementById('wall-keuze').value)
  if (!wallId || selectie.size === 0) return

  selectie.forEach(videoId => {
    const data = resultatenData[videoId]
    if (!data) return

    voegVideoToe({
      wallId,
      type: 'youtube',
      artiest: data.kanaal,
      titel: data.titel,
      verhaal: '',
      tag: '',
      youtubeUrl: 'https://www.youtube.com/watch?v=' + videoId
    })

    const el = document.getElementById('res-' + videoId)
    if (el) {
      el.classList.remove('geselecteerd')
      el.classList.add('toegevoegd')
      el.onclick = null
      el.style.cursor = 'default'
      el.innerHTML += '<div class="toegevoegd-badge">' + t('zoeken.toegevoegd') + '</div>'
    }
  })

  selectie.clear()
  updateSelectieInfo()
  ipcRenderer.send('herlaad-hoofdscherm')
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') deselecteerAlles()
})

window.voegGeselecteerdeToe = voegGeselecteerdeToe
window.stelModusIn = stelModusIn
window.terugNaarPlaylists = terugNaarPlaylists
window.selecteerAlleZoekresultaten = selecteerAlleZoekresultaten

laadGroepen()