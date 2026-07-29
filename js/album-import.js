const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { maakAlbum, voegTrackToe } = require('./db/albums.js')
const path = require('path')

let groepId = null
let mapPad = null
let tracks = []
let coverPad = null
let bezig = false

ipcRenderer.on('stel-groep-in', (event, id) => { groepId = id })

function kiesMap() {
  ipcRenderer.send('kies-album-map')
}

function toonCoverPreview() {
  const container = document.getElementById('cover-container')
  container.innerHTML = coverPad
    ? '<img class="cover-preview" src="file:///' + coverPad.replace(/\\/g, '/') + '" alt="">'
    : '<div class="cover-preview-leeg">&#9835;</div>'
}

ipcRenderer.on('album-map-gekozen', (event, gegevens) => {
  mapPad = gegevens.mapPad
  tracks = gegevens.tracks
  coverPad = gegevens.coverPad

  document.getElementById('voor-map').style.display = 'none'
  document.getElementById('na-map').style.display = 'block'
  document.getElementById('album-naam').value = path.basename(mapPad)

  toonCoverPreview()

  const lijst = document.getElementById('bestand-lijst')
  lijst.innerHTML = ''
  tracks.forEach((track, i) => {
    const item = document.createElement('div')
    item.className = 'bestand-item'
    item.id = 'bestand-' + i

    const nummer = document.createElement('span')
    nummer.className = 'bestand-nummer'
    nummer.textContent = i + 1

    const naam = document.createElement('span')
    naam.className = 'bestand-naam'
    naam.textContent = (track.artiest ? track.artiest + ' - ' : '') + track.titel

    item.appendChild(nummer)
    item.appendChild(naam)
    lijst.appendChild(item)
  })

  document.getElementById('melding').textContent = ''
})

async function importeer() {
  if (bezig || tracks.length === 0) return

  const naam = document.getElementById('album-naam').value.trim()
  const artiest = document.getElementById('album-artiest').value.trim()

  if (!naam || !artiest) {
    document.getElementById('melding').textContent = t('validatie.vulNaamIn')
    return
  }

  bezig = true
  document.getElementById('importeer-btn').disabled = true

  const albumResult = maakAlbum({ naam, artiest, coverPad, groepId })
  const albumId = albumResult.lastInsertRowid

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]

    const item = document.getElementById('bestand-' + i)
    if (item) item.className = 'bestand-item actief'

    const pct = Math.round((i / tracks.length) * 100)
    document.getElementById('voortgang-vulling').style.width = pct + '%'
    document.getElementById('voortgang-tekst').textContent = t('albumImport.voortgang', { i: i + 1, n: tracks.length, naam: track.titel })

    voegTrackToe({ albumId, artiest: track.artiest, titel: track.titel, lokaalPad: track.lokaalPad })

    if (item) item.className = 'bestand-item klaar'
    await new Promise(r => setTimeout(r, 30))
  }

  document.getElementById('voortgang-vulling').style.width = '100%'
  document.getElementById('voortgang-tekst').textContent = t('albumImport.klaar', { n: tracks.length })
  document.getElementById('melding').textContent = t('albumImport.voltooid')

  bezig = false

  setTimeout(() => {
    ipcRenderer.send('album-toegevoegd')
  }, 1200)
}

window.kiesMap = kiesMap
window.importeer = importeer
