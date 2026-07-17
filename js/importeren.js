const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getAlleWalls } = require('./db/walls.js')
const { getAlleWallGroepen } = require('./db/wallgroepen.js')
const { voegVideoToe } = require('./db/videos.js')
const path = require('path')

let bestanden = []
let bestandenSelectie = new Set()
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

function updateBestandLabel() {
  document.getElementById('bestand-label').textContent = t('importeren.gevondenGeselecteerd', {
    gevonden: bestanden.length,
    geselecteerd: bestandenSelectie.size
  })
}

function toggleBestandSelectie(event, el, idx) {
  if (!event.ctrlKey) return

  event.stopPropagation()
  event.preventDefault()

  if (bestandenSelectie.has(idx)) {
    bestandenSelectie.delete(idx)
    el.classList.remove('geselecteerd')
  } else {
    bestandenSelectie.add(idx)
    el.classList.add('geselecteerd')
  }

  updateBestandLabel()
}

function toggleSelecteerAlleBestanden() {
  if (bestanden.length === 0) return

  if (bestandenSelectie.size === bestanden.length) {
    bestandenSelectie.clear()
  } else {
    bestandenSelectie = new Set(bestanden.map((_, i) => i))
  }

  document.querySelectorAll('#bestand-lijst .bestand-item').forEach((el, i) => {
    el.classList.toggle('geselecteerd', bestandenSelectie.has(i))
  })

  updateBestandLabel()
}

function filterBestanden() {
  const term = document.getElementById('bestand-filter').value.trim().toLowerCase()

  bestanden.forEach((pad, i) => {
    const item = document.getElementById('bestand-' + i)
    if (!item) return

    const matcht = path.basename(pad).toLowerCase().includes(term)
    item.style.display = (!term || matcht) ? 'flex' : 'none'

    if (term) {
      if (matcht) bestandenSelectie.add(i)
      else bestandenSelectie.delete(i)
      item.classList.toggle('geselecteerd', matcht)
    }
  })

  updateBestandLabel()
}

ipcRenderer.on('import-bestanden', (event, gevonden) => {
  bestanden = gevonden
  bestandenSelectie = new Set(bestanden.map((_, i) => i))

  const lijst = document.getElementById('bestand-lijst')
  const container = document.getElementById('bestand-lijst-container')

  document.getElementById('bestand-filter').value = ''
  container.style.display = 'block'
  lijst.innerHTML = ''

  bestanden.forEach((pad, i) => {
    const item = document.createElement('div')
    item.className = 'bestand-item geselecteerd'
    item.id = 'bestand-' + i
    item.onclick = (e) => toggleBestandSelectie(e, item, i)

    const nummer = document.createElement('span')
    nummer.className = 'bestand-nummer'
    nummer.textContent = i + 1

    const naam = document.createElement('span')
    naam.className = 'bestand-naam'
    naam.textContent = path.basename(pad)

    item.appendChild(nummer)
    item.appendChild(naam)
    lijst.appendChild(item)
  })

  updateBestandLabel()
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

  if (bestandenSelectie.size === 0) {
    document.getElementById('melding').textContent = t('validatie.geenBestandenGeselecteerd')
    return
  }

  const teImporteren = bestanden.map((_, i) => i).filter(i => bestandenSelectie.has(i))

  bezig = true
  const btn = document.getElementById('import-btn')
  btn.disabled = true

  for (let n = 0; n < teImporteren.length; n++) {
    const i = teImporteren[n]
    const pad = bestanden[i]
    const naam = path.basename(pad, path.extname(pad))

    const item = document.getElementById('bestand-' + i)
    if (item) item.className = 'bestand-item actief'

    const pct = Math.round((n / teImporteren.length) * 100)
    document.getElementById('voortgang-vulling').style.width = pct + '%'
    document.getElementById('voortgang-tekst').textContent = t('importeren.voortgang', { i: n + 1, n: teImporteren.length, naam })

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
  document.getElementById('voortgang-tekst').textContent = t('importeren.klaar', { n: teImporteren.length })
  document.getElementById('melding').textContent = t('importeren.voltooid')

  bezig = false
  btn.disabled = false

  setTimeout(() => {
    ipcRenderer.send('import-klaar')
  }, 1200)
}

laadGroepen()