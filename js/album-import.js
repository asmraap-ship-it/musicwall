const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { maakAlbum, voegTrackToe, getAlleGenres, vindAlbumVoorMap } = require('./db/albums.js')
const path = require('path')

let groepId = null
let mapPad = null
let tracks = []
let coverPad = null
let bezig = false

let bulkOuderMapPad = null
let bulkAlbums = []
let bulkSelectie = new Set()

ipcRenderer.on('stel-groep-in', (event, id) => { groepId = id })

document.getElementById('genre-lijst').innerHTML = getAlleGenres()
  .map(g => '<option value="' + g.replace(/"/g, '&quot;') + '">').join('')

function stelModusIn(modus) {
  document.getElementById('btn-modus-een').classList.toggle('actief', modus === 'een')
  document.getElementById('btn-modus-bulk').classList.toggle('actief', modus === 'bulk')
  document.getElementById('sectie-een').classList.toggle('zichtbaar', modus === 'een')
  document.getElementById('sectie-bulk').classList.toggle('zichtbaar', modus === 'bulk')
  document.getElementById('melding').textContent = ''
}

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
  // ID3-albumtitel (TALB) als voorstel wanneer alle tracks 'm delen - betrouwbaarder dan de mapnaam voor
  // een correct getagde verzameling, maar de mapnaam blijft de terugval (leeg/inconsistent getagd is heel
  // gewoon). Artiest komt op dezelfde manier van een gemeenschappelijke ID3-artiest-tag, was voorheen
  // altijd leeg (moest volledig met de hand ingevuld worden) - zelfde detectie die bulk-import al gebruikte
  document.getElementById('album-naam').value = gegevens.albumTitel || path.basename(mapPad)
  document.getElementById('album-artiest').value = gegevens.artiest || ''
  document.getElementById('album-genre').value = gegevens.genre || ''

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
  const genre = document.getElementById('album-genre').value.trim()

  if (!naam || !artiest) {
    document.getElementById('melding').textContent = t('validatie.vulNaamIn')
    return
  }

  const bestaand = vindAlbumVoorMap(groepId, mapPad)
  if (bestaand) {
    const akkoord = await ipcRenderer.invoke('vraag-bevestiging', {
      titel: t('albumImport.dubbeleMapTitel'),
      bericht: t('albumImport.dubbeleMapBericht', { naam: bestaand.naam }),
      knopTekst: t('algemeen.tochImporterenBtn')
    })
    if (!akkoord) return
  }

  bezig = true
  document.getElementById('importeer-btn').disabled = true

  const albumResult = maakAlbum({ naam, artiest, coverPad, groepId, genre, bronMap: mapPad })
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

function kiesBulkMap() {
  ipcRenderer.send('kies-meerdere-albums-map')
}

function updateBulkLabel() {
  document.getElementById('bulk-label').textContent = t('albumImport.gevondenAlbums', {
    n: bulkAlbums.length,
    geselecteerd: bulkSelectie.size
  })
}

function toggleBulkSelectie(i) {
  const item = document.getElementById('bulk-album-' + i)
  if (bulkSelectie.has(i)) {
    bulkSelectie.delete(i)
    if (item) item.classList.remove('geselecteerd')
  } else {
    bulkSelectie.add(i)
    if (item) item.classList.add('geselecteerd')
  }
  updateBulkLabel()
}

function toggleSelecteerAlleBulk() {
  if (bulkAlbums.length === 0) return

  if (bulkSelectie.size === bulkAlbums.length) {
    bulkSelectie.clear()
  } else {
    bulkSelectie = new Set(bulkAlbums.map((_, i) => i))
  }

  bulkAlbums.forEach((_, i) => {
    const item = document.getElementById('bulk-album-' + i)
    const vinkje = document.getElementById('bulk-check-' + i)
    if (item) item.classList.toggle('geselecteerd', bulkSelectie.has(i))
    if (vinkje) vinkje.checked = bulkSelectie.has(i)
  })

  updateBulkLabel()
}

ipcRenderer.on('meerdere-albums-gekozen', (event, gegevens) => {
  bulkOuderMapPad = gegevens.ouderMapPad
  bulkAlbums = gegevens.albums

  // mappen die al eerder als album in déze groep zijn geïmporteerd, staan default uitgevinkt (niet
  // helemaal uit de lijst gelaten - de gebruiker kan 'm alsnog bewust weer aanvinken om toch opnieuw te
  // importeren) i.p.v. een pop-up per rij, wat bij tientallen gevonden mappen al snel onwerkbaar zou zijn
  bulkSelectie = new Set(
    bulkAlbums.map((_, i) => i).filter(i => !vindAlbumVoorMap(groepId, bulkAlbums[i].bronMap))
  )

  document.getElementById('bulk-na-map').style.display = 'block'
  document.getElementById('bulk-voortgang-tekst').textContent = ''
  document.getElementById('bulk-voortgang-vulling').style.width = '0%'

  const lijst = document.getElementById('bulk-lijst')
  lijst.innerHTML = ''

  bulkAlbums.forEach((album, i) => {
    const isDubbel = !bulkSelectie.has(i)

    const item = document.createElement('div')
    item.className = 'bulk-album-item' + (isDubbel ? '' : ' geselecteerd')
    item.id = 'bulk-album-' + i

    const check = document.createElement('input')
    check.type = 'checkbox'
    check.id = 'bulk-check-' + i
    check.checked = !isDubbel
    check.onchange = () => toggleBulkSelectie(i)

    const cover = document.createElement(album.coverPad ? 'img' : 'div')
    if (album.coverPad) {
      cover.className = 'bulk-album-cover'
      cover.src = 'file:///' + album.coverPad.replace(/\\/g, '/')
    } else {
      cover.className = 'bulk-album-cover-leeg'
      cover.innerHTML = '&#9835;'
    }

    const velden = document.createElement('div')
    velden.className = 'bulk-album-velden'

    const naamInput = document.createElement('input')
    naamInput.type = 'text'
    naamInput.className = 'bulk-album-naam'
    naamInput.value = album.naam
    naamInput.id = 'bulk-naam-' + i

    const artiestInput = document.createElement('input')
    artiestInput.type = 'text'
    artiestInput.className = 'bulk-album-artiest'
    artiestInput.placeholder = t('albumImport.artiestLabel')
    artiestInput.value = album.artiest || ''
    artiestInput.id = 'bulk-artiest-' + i

    velden.appendChild(naamInput)
    velden.appendChild(artiestInput)

    const aantal = document.createElement('span')
    aantal.className = 'bulk-album-aantal'
    aantal.id = 'bulk-status-' + i
    aantal.textContent = isDubbel
      ? t('albumImport.bulkAlGeimporteerd')
      : t('albumImport.bulkAantalNummers', { n: album.tracks.length })
    if (isDubbel) aantal.title = t('albumImport.bulkAlGeimporteerdTooltip')

    item.appendChild(check)
    item.appendChild(cover)
    item.appendChild(velden)
    item.appendChild(aantal)
    lijst.appendChild(item)
  })

  updateBulkLabel()
  document.getElementById('melding').textContent = gegevens.afgebroken ? t('albumImport.bulkAfgebroken') : ''
})

async function importeerBulk() {
  if (bezig || bulkAlbums.length === 0) return

  const teImporteren = bulkAlbums.map((_, i) => i).filter(i => bulkSelectie.has(i))
  if (teImporteren.length === 0) {
    document.getElementById('melding').textContent = t('validatie.geenBestandenGeselecteerd')
    return
  }

  bezig = true
  document.getElementById('bulk-importeer-btn').disabled = true

  for (let n = 0; n < teImporteren.length; n++) {
    const i = teImporteren[n]
    const album = bulkAlbums[i]
    const naam = document.getElementById('bulk-naam-' + i).value.trim() || album.naam
    const artiest = document.getElementById('bulk-artiest-' + i).value.trim()

    const item = document.getElementById('bulk-album-' + i)
    const status = document.getElementById('bulk-status-' + i)
    if (item) item.className = 'bulk-album-item actief'

    const pct = Math.round((n / teImporteren.length) * 100)
    document.getElementById('bulk-voortgang-vulling').style.width = pct + '%'
    document.getElementById('bulk-voortgang-tekst').textContent = t('albumImport.bulkVoortgang', { i: n + 1, n: teImporteren.length, naam })

    const albumResult = maakAlbum({ naam, artiest, coverPad: album.coverPad, groepId, genre: album.genre, bronMap: album.bronMap })
    const albumId = albumResult.lastInsertRowid
    album.tracks.forEach(track => {
      voegTrackToe({ albumId, artiest: track.artiest, titel: track.titel, lokaalPad: track.lokaalPad })
    })

    if (item) item.className = 'bulk-album-item klaar'
    if (status) status.textContent = '✓'
    await new Promise(r => setTimeout(r, 20))
  }

  document.getElementById('bulk-voortgang-vulling').style.width = '100%'
  document.getElementById('bulk-voortgang-tekst').textContent = t('albumImport.bulkKlaar', { n: teImporteren.length })
  document.getElementById('melding').textContent = t('albumImport.voltooid')

  bezig = false

  setTimeout(() => {
    ipcRenderer.send('album-toegevoegd')
  }, 1200)
}

window.stelModusIn = stelModusIn
window.kiesMap = kiesMap
window.importeer = importeer
window.kiesBulkMap = kiesBulkMap
window.toggleSelecteerAlleBulk = toggleSelecteerAlleBulk
window.importeerBulk = importeerBulk
