const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { alleYoutubeItems } = require('./db/zoeken.js')
const { verwijderVideo } = require('./db/videos.js')
const { verwijderMedia } = require('./db/concerten.js')

let kapotteItems = []
let selectie = new Set()

async function start() {
  const items = alleYoutubeItems()
  const statusEl = document.getElementById('status')

  if (items.length === 0) {
    statusEl.textContent = t('kapotteLinks.geenYoutubeVideos')
    return
  }

  let gecontroleerd = 0
  statusEl.textContent = t('kapotteLinks.bezig', { gecontroleerd, totaal: items.length })

  for (const item of items) {
    const beschikbaar = await controleerYoutubeLink(item.youtubeUrl)
    gecontroleerd++

    if (!beschikbaar) {
      toonKapotItem(item)
    }

    statusEl.textContent = t('kapotteLinks.bezig', { gecontroleerd, totaal: items.length })
  }

  statusEl.textContent = kapotteItems.length === 0
    ? t('kapotteLinks.alleWerken', { totaal: items.length })
    : t('kapotteLinks.klaar', { n: kapotteItems.length })
}

// Index-gebaseerde selectie i.p.v. video-id - een kapot item kan uit een wall of een concertervaring komen,
// en heeft dus geen gedeeld id-type; de index in kapotteItems is altijd uniek. Verwijderde items worden niet
// uit kapotteItems gesplitst (zou alle latere indices verschuiven) - i.p.v. daarvan checkt elke functie op het
// nog bestaan van het DOM-element (document.getElementById('kapot-' + i)) om verwijderde items over te slaan.
function toonKapotItem(item) {
  const index = kapotteItems.length
  kapotteItems.push(item)

  if (index === 0) {
    document.getElementById('acties').innerHTML =
      '<button class="selecteer-alles-btn" onclick="toggleSelecteerAlles()">' + t('zoeken.selecteerAlles') + '</button>'
  }

  const lijst = document.getElementById('lijst')
  const naam = (item.artiest ? item.artiest + ' - ' : '') + item.titel

  const el = document.createElement('div')
  el.className = 'kapot-item'
  el.id = 'kapot-' + index
  el.innerHTML = '<div class="kapot-info">'
    + '<div class="kapot-titel">' + naam + '</div>'
    + '<div class="kapot-herkomst">' + t(item.bron === 'wall' ? 'jukebox.herkomstWall' : 'jukebox.herkomstConcert', { naam: item.herkomst }) + '</div>'
    + '</div>'
    + '<button class="kapot-verwijder" title="' + t('video.verwijderenTooltip') + '">🗑</button>'

  el.onclick = () => toggleSelectie(index)
  el.querySelector('.kapot-verwijder').onclick = (event) => {
    event.stopPropagation()
    verwijderItem(index)
  }
  lijst.appendChild(el)
}

function toggleSelectie(index) {
  const el = document.getElementById('kapot-' + index)
  if (!el) return

  if (selectie.has(index)) {
    selectie.delete(index)
    el.classList.remove('geselecteerd')
  } else {
    selectie.add(index)
    el.classList.add('geselecteerd')
  }
  updateSelectieInfo()
}

function toggleSelecteerAlles() {
  const overgebleven = kapotteItems.map((_, i) => i).filter(i => document.getElementById('kapot-' + i))
  if (overgebleven.length === 0) return

  const alleGeselecteerd = overgebleven.every(i => selectie.has(i))

  overgebleven.forEach(i => {
    const el = document.getElementById('kapot-' + i)
    if (alleGeselecteerd) {
      selectie.delete(i)
      el.classList.remove('geselecteerd')
    } else {
      selectie.add(i)
      el.classList.add('geselecteerd')
    }
  })

  updateSelectieInfo()
}

function deselecteerAlles() {
  selectie.forEach(i => {
    const el = document.getElementById('kapot-' + i)
    if (el) el.classList.remove('geselecteerd')
  })
  selectie.clear()
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

function verwijderUitCollectie(item) {
  if (item.bron === 'wall') {
    verwijderVideo(item.id)
  } else {
    verwijderMedia(item.id)
  }
}

async function verwijderItem(index) {
  const item = kapotteItems[index]

  const akkoord = await ipcRenderer.invoke('vraag-bevestiging', {
    titel: t('video.verwijderen.titel'),
    bericht: item.titel
  })
  if (!akkoord) return

  verwijderUitCollectie(item)

  const el = document.getElementById('kapot-' + index)
  if (el) el.remove()
  selectie.delete(index)
  updateSelectieInfo()
  ipcRenderer.send('herlaad-hoofdscherm')
}

async function verwijderGeselecteerde() {
  if (selectie.size === 0) return

  const namen = Array.from(selectie).map(i => kapotteItems[i].titel).join('\n')
  const akkoord = await ipcRenderer.invoke('vraag-bevestiging', {
    titel: t('video.meerdereVerwijderen.titel', { n: selectie.size }),
    bericht: namen
  })
  if (!akkoord) return

  selectie.forEach(i => {
    verwijderUitCollectie(kapotteItems[i])
    const el = document.getElementById('kapot-' + i)
    if (el) el.remove()
  })

  selectie.clear()
  updateSelectieInfo()
  ipcRenderer.send('herlaad-hoofdscherm')
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') deselecteerAlles()
})

window.toggleSelecteerAlles = toggleSelecteerAlles
window.verwijderGeselecteerde = verwijderGeselecteerde

start()
