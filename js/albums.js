const { getAlbumsVoorGroep, getAlbum, getTracksVoorAlbum, sorteerAlbums } = require('./db/albums.js')

let albumSelectie = new Set()

async function laadAlbums(groepId) {
  const container = document.getElementById('albums-container')
  container.innerHTML = ''

  // elke herbouw van het grid start met een schone selectie - voorkomt dat een selectie uit een vorige
  // groep/weergave onzichtbaar blijft "hangen" en de selectiebalk laat kloppen met wat er niet meer op
  // het scherm staat
  albumSelectie.clear()
  if (typeof updateSelectieInfo === 'function') updateSelectieInfo()

  const albums = getAlbumsVoorGroep(groepId)

  // filter- en sorteerbalk bovenaan het grid - alleen zinvol met meer dan 1 album. flex-basis:100% dwingt 'm
  // op zijn eigen regel af, want #albums-container is zelf een flex-wrap-container (kaarten + deze rij delen
  // dezelfde flow)
  if (albums.length > 1) {
    const header = document.createElement('div')
    header.className = 'albums-grid-header'

    // filter vóór sorteren (op verzoek van de gebruiker) - live, substring, op artiest óf albumnaam. De
    // datalist-suggesties komen uit de al opgehaalde albums van déze groep (geen extra DB-call nodig) -
    // zelfde native input+datalist-aanpak als het genre-veld bij importeren/bewerken
    const filterInput = document.createElement('input')
    filterInput.type = 'text'
    filterInput.id = 'albums-filter'
    filterInput.className = 'albums-filter-input'
    filterInput.placeholder = t('albums.filterPlaceholder')
    filterInput.setAttribute('list', 'albums-filter-lijst')
    filterInput.oninput = filterAlbums

    const datalist = document.createElement('datalist')
    datalist.id = 'albums-filter-lijst'
    const suggesties = new Set()
    albums.forEach(a => {
      if (a.artiest) suggesties.add(a.artiest)
      if (a.naam) suggesties.add(a.naam)
    })
    datalist.innerHTML = Array.from(suggesties)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }))
      .map(s => '<option value="' + s.replace(/"/g, '&quot;') + '">').join('')

    const sorteerBtn = document.createElement('button')
    sorteerBtn.className = 'albums-sorteer-btn'
    sorteerBtn.title = t('albums.sorteerTooltip')
    sorteerBtn.textContent = t('albums.sorteerBtn')
    sorteerBtn.onclick = () => sorteerAlbumsGroep(groepId)

    header.appendChild(filterInput)
    header.appendChild(datalist)
    header.appendChild(sorteerBtn)
    container.appendChild(header)
  }

  if (albums.length === 0) {
    container.innerHTML = '<div class="concerten-leeg">' + t('albums.leeg') + '</div>'
  } else {
    albums.forEach(album => {
      const tracks = getTracksVoorAlbum(album.id)

      const coverHtml = album.cover_pad
        ? '<img src="file:///' + album.cover_pad.replace(/\\/g, '/') + '" alt="">'
        : '<div class="concert-cover-placeholder">&#9835;</div>'

      // Geen embedded album-data meer in een inline onclick-attribuutstring - album.naam kan uit een
      // ID3-tag komen (zie beveiligingsreview 2026-08-24). De handlers worden hieronder via een echte
      // closure aan de knop gehangen, zelfde patroon als kaart.onclick/filterInput.oninput in dit bestand.
      const verwijderKnop = '<button class="concert-verwijder-btn" title="' + t('albums.verwijderenTooltip') + '">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>'
        + '</button>'

      const bewerkKnop = '<button class="concert-bewerk-btn" title="' + t('albums.bewerkenTooltip') + '">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>'
        + '</button>'

      const kaart = document.createElement('div')
      kaart.className = 'concert-kaart'
      kaart.dataset.albumId = album.id
      kaart.dataset.naam = album.naam || ''
      kaart.dataset.artiest = album.artiest || ''
      kaart.draggable = true
      kaart.ondragstart = (event) => albumDragStart(event, album.id, kaart)
      kaart.ondragend = () => albumDragEnd()
      kaart.ondragover = (event) => albumDragOver(event, kaart)
      kaart.ondragleave = () => albumDragLeave(kaart)
      kaart.ondrop = (event) => albumDrop(event, album.id)
      kaart.innerHTML = '<div class="concert-cover">'
        + coverHtml
        + '<div class="concert-media-aantal">' + t('albums.trackAantal', { n: tracks.length }) + '</div>'
        + verwijderKnop
        + bewerkKnop
        + '</div>'
        + '<div class="concert-info">'
        + '<div class="concert-artiest">' + escapeHtml(album.artiest || '') + '</div>'
        + '<div class="concert-naam">' + escapeHtml(album.naam) + '</div>'
        + '</div>'

      const verwijderBtn = kaart.querySelector('.concert-verwijder-btn')
      if (verwijderBtn) {
        verwijderBtn.onclick = (event) => {
          event.stopPropagation()
          bevestigAlbumVerwijderen(album.id, album.naam)
        }
      }

      const bewerkBtn = kaart.querySelector('.concert-bewerk-btn')
      if (bewerkBtn) {
        bewerkBtn.onclick = (event) => {
          event.stopPropagation()
          bewerkAlbum(album.id)
        }
      }

      kaart.onclick = (event) => {
        if (event.ctrlKey) {
          toggleAlbumSelectie(event, album.id, kaart)
        } else {
          openAlbum(album.id)
        }
      }
      if (albumSelectie.has(album.id)) kaart.classList.add('geselecteerd')
      container.appendChild(kaart)
    })
  }

  const nieuwBtn = document.createElement('button')
  nieuwBtn.className = 'concert-nieuw-btn'
  nieuwBtn.innerHTML = '+<span class="concert-nieuw-label">' + t('albums.nieuw') + '</span>'
  nieuwBtn.onclick = () => ipcRenderer.send('open-album-import', groepId)
  container.appendChild(nieuwBtn)

  if (albums.length > 1) {
    const geenResultaten = document.createElement('div')
    geenResultaten.id = 'albums-geen-filterresultaten'
    geenResultaten.className = 'concerten-leeg verborgen'
    geenResultaten.textContent = t('albums.geenFilterResultaten')
    container.appendChild(geenResultaten)
  }

  const kaarten = container.querySelectorAll('.concert-kaart')
  if (window.gsap && kaarten.length > 0) {
    gsap.fromTo(kaarten,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.06 }
    )
  }
}

function openAlbum(albumId) {
  ipcRenderer.send('open-album-detail', albumId)
}

function bevestigAlbumVerwijderen(albumId, albumNaam) {
  ipcRenderer.send('bevestig-album-verwijderen', { albumId, albumNaam })
}

function bewerkAlbum(albumId) {
  const album = getAlbum(albumId)
  if (!album) return
  ipcRenderer.send('open-bewerk-album', album)
}

function sorteerAlbumsGroep(groepId) {
  sorteerAlbums(groepId)
  laadAlbums(groepId)
}

// Live, substring-filter op artiest óf albumnaam - zelfde "geen debounce, direct bij elke input"-aanpak als
// het globale zoekveld en het bestandsfilter bij map-import. Puur zichtbaarheid (kaarten blijven in de DOM,
// geen herbouw van het grid) zodat drag-and-drop-herordenen en de selectie ongemoeid blijven tijdens filteren.
function filterAlbums() {
  const term = document.getElementById('albums-filter').value.trim().toLowerCase()
  let zichtbaarAantal = 0

  document.querySelectorAll('#albums-container .concert-kaart[data-album-id]').forEach(kaart => {
    const matcht = !term
      || kaart.dataset.naam.toLowerCase().includes(term)
      || kaart.dataset.artiest.toLowerCase().includes(term)
    kaart.style.display = matcht ? '' : 'none'
    if (matcht) zichtbaarAantal++
  })

  const geenResultaten = document.getElementById('albums-geen-filterresultaten')
  if (geenResultaten) geenResultaten.classList.toggle('verborgen', zichtbaarAantal > 0 || !term)

  const nieuwBtn = document.querySelector('#albums-container .concert-nieuw-btn')
  if (nieuwBtn) nieuwBtn.style.display = term ? 'none' : ''
}

function toggleAlbumSelectie(event, albumId, kaartEl) {
  event.stopPropagation()
  event.preventDefault()

  if (albumSelectie.has(albumId)) {
    albumSelectie.delete(albumId)
    kaartEl.classList.remove('geselecteerd')
  } else {
    albumSelectie.add(albumId)
    kaartEl.classList.add('geselecteerd')
  }

  if (typeof updateSelectieInfo === 'function') updateSelectieInfo()
}

function deselecteerAlbums() {
  document.querySelectorAll('#albums-container .concert-kaart.geselecteerd').forEach(k => k.classList.remove('geselecteerd'))
  albumSelectie.clear()
  if (typeof updateSelectieInfo === 'function') updateSelectieInfo()
}

// Bewust géén "Selecteer alles"-knop voor albums (in tegenstelling tot walls/concert-detail) - op verzoek
// van de gebruiker: bulk verwijderen/toevoegen aan de playlist is hier bedoeld voor het gericht kiezen van
// een paar specifieke albums, niet voor "alles in deze groep in één keer"
function stuurAlbumsNaarJukebox() {
  if (albumSelectie.size === 0) {
    alert(t('jukebox.geenSelectie'))
    return
  }

  const items = []
  albumSelectie.forEach(albumId => {
    const album = getAlbum(albumId)
    if (!album) return
    getTracksVoorAlbum(albumId).forEach(track => {
      items.push({
        type: 'lokaal',
        lokaalPad: track.lokaal_pad,
        artiest: track.artiest || album.artiest,
        titel: track.titel,
        coverPad: album.cover_pad
      })
    })
  })

  if (items.length > 0) {
    ipcRenderer.send('album-tracks-naar-playlist', items)
  }

  deselecteerAlbums()
}

function verwijderAlbumSelectie() {
  if (albumSelectie.size === 0) return

  const idArray = Array.from(albumSelectie)
  const namen = idArray.map(id => {
    const album = getAlbum(id)
    return album ? (album.artiest ? album.artiest + ' — ' : '') + album.naam : ''
  }).join('\n')

  ipcRenderer.send('bevestig-albums-verwijderen-meerdere', { ids: idArray, namen })
  deselecteerAlbums()
}

let sleepAlbumBronId = null

function albumDragStart(event, albumId, el) {
  sleepAlbumBronId = albumId
  event.dataTransfer.setData('albumId', albumId.toString())
  el.style.opacity = '0.4'
}

function albumDragEnd() {
  document.querySelectorAll('#albums-container .concert-kaart').forEach(k => k.style.opacity = '1')
  sleepAlbumBronId = null
}

function albumDragOver(event, el) {
  if (sleepAlbumBronId === null) return
  event.preventDefault()
  el.classList.add('drag-over-kaart')
}

function albumDragLeave(el) {
  el.classList.remove('drag-over-kaart')
}

function albumDrop(event, doelAlbumId) {
  const bronAlbumId = parseInt(event.dataTransfer.getData('albumId'))
  if (!bronAlbumId) return

  event.preventDefault()
  event.currentTarget.classList.remove('drag-over-kaart')

  if (bronAlbumId === doelAlbumId) return

  const container = document.getElementById('albums-container')
  const bronKaart = container.querySelector('[data-album-id="' + bronAlbumId + '"]')
  const doelKaart = container.querySelector('[data-album-id="' + doelAlbumId + '"]')
  if (!bronKaart || !doelKaart) return

  const kaarten = Array.from(container.querySelectorAll('.concert-kaart'))
  const bronIdx = kaarten.indexOf(bronKaart)
  const doelIdx = kaarten.indexOf(doelKaart)

  if (bronIdx < doelIdx) {
    container.insertBefore(bronKaart, doelKaart.nextSibling)
  } else {
    container.insertBefore(bronKaart, doelKaart)
  }

  const nieuweVolgorde = Array.from(container.querySelectorAll('.concert-kaart'))
    .map(k => parseInt(k.dataset.albumId))
    .filter(id => !isNaN(id))

  ipcRenderer.send('sla-album-volgorde-op', nieuweVolgorde)
}

ipcRenderer.on('herlaad-albums', () => {
  if (huidigeSectie === 'groep' && huidigeGroepId) laadAlbums(huidigeGroepId)
})

window.openAlbum = openAlbum
window.bevestigAlbumVerwijderen = bevestigAlbumVerwijderen
window.bewerkAlbum = bewerkAlbum

// Hier (en niet aan het eind van js/concerten.js) aangeroepen omdat dit het laatst geladen script is - een
// onthouden 'albums'-soortfilter kan bij opstart meteen naar een albumgroep willen schakelen (laadAlbums()
// hierboven), en dat moet pas gebeuren nadat alle scripts, inclusief dit bestand, geladen zijn
pasSoortFilterToe()
navigeerNaarSoort(soortFilter, false)
