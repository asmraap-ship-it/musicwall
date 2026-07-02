const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getAlleWalls } = require('./db/walls.js')
const { voegVideoToe } = require('./db/videos.js')
const path = require('path')

let bestanden = []
let bezig = false

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

function startImport() {
  if (bezig) return
  if (bestanden.length === 0) {
    ipcRenderer.send('open-import')
  } else {
    importeer()
  }
}

ipcRenderer.on('import-bestanden', (event, gevonden) => {
  bestanden = gevonden
  const lijst = document.getElementById('bestand-lijst')
  const label = document.getElementById('bestand-label')
  const container = document.getElementById('bestand-lijst-container')

  container.style.display = 'block'
  label.textContent = bestanden.length + ' videobestanden gevonden'
  lijst.innerHTML = ''

  bestanden.forEach((pad, i) => {
    const item = document.createElement('div')
    item.className = 'bestand-item'
    item.id = 'bestand-' + i
    item.textContent = path.basename(pad)
    lijst.appendChild(item)
  })

  document.getElementById('import-btn').textContent = 'Importeren'
  document.getElementById('melding').textContent = ''
})

async function importeer() {
  if (bestanden.length === 0) return
  bezig = true

  const wallId = parseInt(document.getElementById('wall-keuze').value)
  const btn = document.getElementById('import-btn')
  btn.disabled = true

  for (let i = 0; i < bestanden.length; i++) {
    const pad = bestanden[i]
    const naam = path.basename(pad, path.extname(pad))

    const item = document.getElementById('bestand-' + i)
    if (item) item.className = 'bestand-item actief'

    const pct = Math.round((i / bestanden.length) * 100)
    document.getElementById('voortgang-vulling').style.width = pct + '%'
    document.getElementById('voortgang-tekst').textContent = (i + 1) + ' van ' + bestanden.length + ' — ' + naam

    voegVideoToe({
      wallId,
      type: 'lokaal',
      artiest: '',
      titel: naam,
      verhaal: '',
      tag: '',
      lokaalPad: pad
    })

    if (item) item.className = 'bestand-item klaar'
    await new Promise(r => setTimeout(r, 50))
  }

  document.getElementById('voortgang-vulling').style.width = '100%'
  document.getElementById('voortgang-tekst').textContent = 'Klaar — ' + bestanden.length + ' videos geïmporteerd'
  document.getElementById('melding').textContent = '✓ Import voltooid'

  bezig = false
  btn.disabled = false

  setTimeout(() => {
    ipcRenderer.send('import-klaar')
  }, 1200)
}

laadWalls()