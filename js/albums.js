const { getAlbumsVoorGroep, getAlbum, getTracksVoorAlbum } = require('./db/albums.js')

async function laadAlbums(groepId) {
  const container = document.getElementById('albums-container')
  container.innerHTML = ''

  const albums = getAlbumsVoorGroep(groepId)

  if (albums.length === 0) {
    container.innerHTML = '<div class="concerten-leeg">' + t('albums.leeg') + '</div>'
  } else {
    albums.forEach(album => {
      const tracks = getTracksVoorAlbum(album.id)

      const coverHtml = album.cover_pad
        ? '<img src="file:///' + album.cover_pad.replace(/\\/g, '/') + '" alt="">'
        : '<div class="concert-cover-placeholder">&#9835;</div>'

      const verwijderKnop = '<button class="concert-verwijder-btn" onclick="event.stopPropagation();bevestigAlbumVerwijderen(' + album.id + ',\'' + album.naam.replace(/'/g, "\\'") + '\')" title="' + t('albums.verwijderenTooltip') + '">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>'
        + '</button>'

      const bewerkKnop = '<button class="concert-bewerk-btn" onclick="event.stopPropagation();bewerkAlbum(' + album.id + ')" title="' + t('albums.bewerkenTooltip') + '">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>'
        + '</button>'

      const kaart = document.createElement('div')
      kaart.className = 'concert-kaart'
      kaart.dataset.albumId = album.id
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
        + '<div class="concert-artiest">' + (album.artiest || '') + '</div>'
        + '<div class="concert-naam">' + album.naam + '</div>'
        + '</div>'

      kaart.onclick = () => openAlbum(album.id)
      container.appendChild(kaart)
    })
  }

  const nieuwBtn = document.createElement('button')
  nieuwBtn.className = 'concert-nieuw-btn'
  nieuwBtn.innerHTML = '+<span class="concert-nieuw-label">' + t('albums.nieuw') + '</span>'
  nieuwBtn.onclick = () => ipcRenderer.send('open-album-import', groepId)
  container.appendChild(nieuwBtn)

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
