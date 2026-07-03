const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const fs = require('fs')
const path = require('path')
const { getAlleWalls } = require('./db/walls.js')
const { voegVideoToe } = require('./db/videos.js')

let apiKey = ''
let resultatenData = {}
let selectie = new Set()

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

function laadWalls() {
  const walls = getAlleWalls()
  const select = document.getElementById('wall-keuze')
  select.innerHTML = ''
  walls.forEach(wall => {
    const opt = document.createElement('option')
    opt.value = wall.id
    opt.textContent = wall.naam
    select.appendChild(opt)
  })
}

async function zoek() {
  const term = document.getElementById('zoekterm').value.trim()
  if (!term) return

  const resultaten = document.getElementById('resultaten')
  resultaten.innerHTML = '<div class="laden">' + t('zoeken.zoeken') + '</div>'
  resultatenData = {}
  deselecteerAlles()

  try {
    const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=25&q='
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

laadWalls()