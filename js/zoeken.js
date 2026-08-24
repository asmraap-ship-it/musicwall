const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getAlleWalls } = require('./db/walls.js')
const { getAlleWallGroepen } = require('./db/wallgroepen.js')
const { voegVideoToe, bestaatVideoInWall } = require('./db/videos.js')

let apiKey = ''
let resultatenData = {}
let selectie = new Set()
let zoekModus = 'videos'
let huidigePlaylistId = null
let playlistResultatenCache = []
let statsData = {}
let volgordeRelevantie = []
let sortModus = 'relevantie'

async function laadApiSleutel() {
  try {
    apiKey = await ipcRenderer.invoke('haal-api-sleutel-op')

    if (!apiKey) {
      document.getElementById('resultaten').innerHTML = '<div class="fout">' + t('zoeken.apiKeyOntbreekt') + '</div>'
    }
  } catch (e) {
    console.error('Fout bij laden API-sleutel:', e.message)
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

function formatteerWeergaven(n) {
  const locale = huidigeTaalCode() === 'nl' ? 'nl-NL' : 'en-US'
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

// Verrijkt zoekresultaten met view-aantal + HD/SD-resolutie via videos.list (1 quotumeenheid per aanroep,
// ongeacht het aantal ids) - los van de relevantie-sortering van search.list, zodat de gebruiker zelf
// populariteit en kwaliteit kan afwegen i.p.v. blind op een sorteervolgorde te vertrouwen.
async function haalStatistieken(videoIds) {
  const stats = {}
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50)
    try {
      const url = 'https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id='
        + chunk.join(',') + '&key=' + apiKey

      const response = await fetch(url)
      const data = await response.json()
      const items = data.items || []

      items.forEach(item => {
        stats[item.id] = {
          weergaven: parseInt((item.statistics || {}).viewCount, 10) || 0,
          hd: (item.contentDetails || {}).definition === 'hd'
        }
      })
    } catch (e) {
      // statistieken zijn een verrijking, geen kernfunctie - stilzwijgend overslaan bij een netwerkfout
    }
  }
  return stats
}

function toonStatistieken(stats) {
  Object.keys(stats).forEach(videoId => {
    const el = document.getElementById('res-' + videoId)
    const info = el && el.querySelector('.resultaat-info')
    if (!info) return

    const { weergaven, hd } = stats[videoId]
    const statsEl = document.createElement('div')
    statsEl.className = 'resultaat-stats'
    statsEl.innerHTML = '<span class="weergaven">👁 ' + formatteerWeergaven(weergaven) + '</span>'
      + (hd ? '<span class="hd-badge">HD</span>' : '')
    info.appendChild(statsEl)
  })
}

// Sorteertoggle-HTML, gedeeld tussen de normale videozoek-actiebalk en de playlist-navigatiebalk
function bouwSorteerToggleHtml() {
  return '<div class="sorteer-toggle">'
    + '<button class="sorteer-btn' + (sortModus === 'relevantie' ? ' actief' : '') + '" data-modus="relevantie" onclick="stelSorteringIn(\'relevantie\')">' + t('zoeken.sorteerRelevantie') + '</button>'
    + '<button class="sorteer-btn' + (sortModus === 'weergaven' ? ' actief' : '') + '" data-modus="weergaven" onclick="stelSorteringIn(\'weergaven\')">' + t('zoeken.sorteerWeergaven') + '</button>'
    + '</div>'
}

// Sorteert puur client-side op de al opgehaalde statistieken - geen extra API-aanroep. 'weergaven' sorteert
// aflopend op view-aantal (ontbrekende statistieken tellen als 0, dus die zakken naar onder); 'relevantie'
// herstelt de oorspronkelijke search.list-volgorde via de bij het ophalen vastgelegde id-volgorde.
function sorteerResultaten() {
  const container = document.getElementById('resultaten')
  const kaarten = Array.from(container.querySelectorAll('.resultaat'))
  if (kaarten.length === 0) return

  kaarten.sort((a, b) => {
    const idA = a.id.replace('res-', '')
    const idB = b.id.replace('res-', '')

    if (sortModus === 'weergaven') {
      const wA = (statsData[idA] && statsData[idA].weergaven) || 0
      const wB = (statsData[idB] && statsData[idB].weergaven) || 0
      return wB - wA
    }

    return volgordeRelevantie.indexOf(idA) - volgordeRelevantie.indexOf(idB)
  })

  kaarten.forEach(el => container.appendChild(el))
}

function stelSorteringIn(modus) {
  sortModus = modus
  document.querySelectorAll('.sorteer-btn').forEach(btn => {
    btn.classList.toggle('actief', btn.dataset.modus === modus)
  })
  sorteerResultaten()
}

async function zoekVideos() {
  const term = document.getElementById('zoekterm').value.trim()
  if (!term) return

  const resultaten = document.getElementById('resultaten')
  resultaten.innerHTML = '<div class="laden">' + t('zoeken.zoeken') + '</div>'
  resultatenData = {}
  statsData = {}
  volgordeRelevantie = []
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
    acties.innerHTML = bouwSorteerToggleHtml()
      + '<button class="selecteer-alles-btn" onclick="selecteerAlleZoekresultaten()">' + t('zoeken.selecteerAlles') + '</button>'
    resultaten.appendChild(acties)

    volgordeRelevantie = data.items.map(item => item.id.videoId)

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
        + '<div class="resultaat-titel">' + escapeHtml(titel) + '</div>'
        + '<div class="resultaat-kanaal">' + escapeHtml(kanaal) + '</div>'
        + '</div>'

      el.onclick = () => toggleSelectie(videoId, el)
      resultaten.appendChild(el)
    })

    haalStatistieken(Object.keys(resultatenData)).then(stats => {
      Object.assign(statsData, stats)
      toonStatistieken(stats)
      sorteerResultaten()
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
      + '<div class="resultaat-titel">' + escapeHtml(playlist.titel) + '</div>'
      + '<div class="resultaat-kanaal">' + escapeHtml(playlist.kanaal) + '</div>'
      + '</div>'

    el.onclick = () => toonPlaylistVideos(playlist.id)
    resultaten.appendChild(el)
  })
}

async function toonPlaylistVideos(playlistId) {
  huidigePlaylistId = playlistId
  resultatenData = {}
  statsData = {}
  volgordeRelevantie = []
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
      + '<div class="navigatie-rechts">' + bouwSorteerToggleHtml()
      + '<button class="selecteer-alles-btn" onclick="selecteerAlleZoekresultaten()">' + t('zoeken.selecteerAlles') + '</button>'
      + '</div>'
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

    volgordeRelevantie = geldigeItems.map(item => item.snippet.resourceId.videoId)

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
        + '<div class="resultaat-titel">' + escapeHtml(titel) + '</div>'
        + '<div class="resultaat-kanaal">' + escapeHtml(kanaal) + '</div>'
        + '</div>'

      el.onclick = () => toggleSelectie(videoId, el)
      resultaten.appendChild(el)
    })

    haalStatistieken(Object.keys(resultatenData)).then(stats => {
      Object.assign(statsData, stats)
      toonStatistieken(stats)
      sorteerResultaten()
    })
  } catch (err) {
    resultaten.innerHTML = '<div class="fout">' + t('zoeken.misgegaan', { bericht: err.message }) + '</div>'
  }
}

function terugNaarPlaylists() {
  huidigePlaylistId = null
  resultatenData = {}
  statsData = {}
  volgordeRelevantie = []
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

async function voegGeselecteerdeToe() {
  const wallId = parseInt(document.getElementById('wall-keuze').value)
  if (!wallId || selectie.size === 0) return

  // duplicaat-check gescoped tot déze wall - zelfde redenering als bij het importeren van lokale bestanden
  const dubbeleAantal = Array.from(selectie).filter(videoId => {
    const data = resultatenData[videoId]
    return data && bestaatVideoInWall(wallId, { youtubeUrl: 'https://www.youtube.com/watch?v=' + videoId })
  }).length
  if (dubbeleAantal > 0) {
    const akkoord = await ipcRenderer.invoke('vraag-bevestiging', {
      titel: t('validatie.dubbeleBestandenTitel'),
      bericht: t('validatie.dubbeleBestandenBericht', { n: dubbeleAantal, m: selectie.size }),
      knopTekst: t('algemeen.tochDoorgaanBtn')
    })
    if (!akkoord) return
  }

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
window.stelSorteringIn = stelSorteringIn

laadGroepen()