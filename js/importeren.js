const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getAlleWalls } = require('./db/walls.js')
const { getAlleWallGroepen } = require('./db/wallgroepen.js')
const { voegVideoToe } = require('./db/videos.js')
const path = require('path')

let bestanden = []
let bezig = false

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
  label.textContent = t('importeren.videobestandenGevonden', { n: bestanden.length })
  lijst.innerHTML = ''

  bestanden.forEach((pad, i) => {
    const item = document.createElement('div')
    item.className = 'bestand-item'
    item.id = 'bestand-' + i
    item.textContent = path.basename(pad)
    lijst.appendChild(item)
  })

  document.getElementById('import-btn').textContent = t('importeren.importerenBtn')
  document.getElementById('melding').textContent = ''
})

async function importeer() {
  if (bestanden.length === 0) return

  const wallId = parseInt(document.getElementById('wall-keuze').value)
  if (!wallId) {
    document.getElementById('melding').textContent = t('validatie.geenWall')
    return
  }

  bezig = true
  const btn = document.getElementById('import-btn')
  btn.disabled = true

  for (let i = 0; i < bestanden.length; i++) {
    const pad = bestanden[i]
    const naam = path.basename(pad, path.extname(pad))

    const item = document.getElementById('bestand-' + i)
    if (item) item.className = 'bestand-item actief'

    const pct = Math.round((i / bestanden.length) * 100)
    document.getElementById('voortgang-vulling').style.width = pct + '%'
    document.getElementById('voortgang-tekst').textContent = t('importeren.voortgang', { i: i + 1, n: bestanden.length, naam })

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
  document.getElementById('voortgang-tekst').textContent = t('importeren.klaar', { n: bestanden.length })
  document.getElementById('melding').textContent = t('importeren.voltooid')

  bezig = false
  btn.disabled = false

  setTimeout(() => {
    ipcRenderer.send('import-klaar')
  }, 1200)
}

laadGroepen()