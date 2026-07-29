const { getAlleConcerten, verwijderConcert, getMediaVoorConcert } = require('./db/concerten.js')
const { getAlleWallGroepen, verplaatsWallNaarGroep } = require('./db/wallgroepen.js')

let huidigeSectie = 'walls'
let huidigeGroepId = null

function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

function schakelSectie(sectie, groepId) {
  huidigeSectie = sectie
  huidigeGroepId = sectie === 'groep' ? groepId : null

  if (zoekModusActief()) {
    document.getElementById('globaal-zoekveld').value = ''
    zoekResultaten = []
    zoekSelectie.clear()
    document.getElementById('globale-zoek-resultaten').style.display = 'none'
    updateSelectieInfo()
  }

  const wallsContainer = document.getElementById('walls-container')
  const albumsContainer = document.getElementById('albums-container')
  const concertenContainer = document.getElementById('concerten-container')
  const btnWalls = document.getElementById('btn-walls')
  const btnConcerten = document.getElementById('btn-concerten')
  const selectieInfo = document.getElementById('selectie-info')
  const prullenbak = document.getElementById('prullenbak')

  document.querySelectorAll('.tab-btn[data-groep-id]').forEach(el => el.classList.remove('actief'))

  const groep = sectie === 'groep' ? getAlleWallGroepen().find(g => g.id === groepId) : null
  const isAlbumGroep = !!(groep && groep.type === 'albums')

  if (sectie === 'walls' || (sectie === 'groep' && !isAlbumGroep)) {
    wallsContainer.style.display = 'flex'
    albumsContainer.style.display = 'none'
    concertenContainer.style.display = 'none'
    btnConcerten.classList.remove('actief')
    if (selectieInfo) selectieInfo.style.display = ''
    if (prullenbak) prullenbak.style.display = ''

    if (sectie === 'groep') {
      btnWalls.classList.remove('actief')
      const tabEl = document.querySelector('.tab-btn[data-groep-id="' + groepId + '"]')
      if (tabEl) tabEl.classList.add('actief')
    } else {
      btnWalls.classList.add('actief')
    }

    laadWalls()
  } else if (sectie === 'groep' && isAlbumGroep) {
    wallsContainer.style.display = 'none'
    albumsContainer.style.display = 'flex'
    concertenContainer.style.display = 'none'
    btnWalls.classList.remove('actief')
    btnConcerten.classList.remove('actief')
    if (selectieInfo) selectieInfo.style.display = 'none'
    if (prullenbak) prullenbak.style.display = 'none'
    const tabEl = document.querySelector('.tab-btn[data-groep-id="' + groepId + '"]')
    if (tabEl) tabEl.classList.add('actief')
    laadAlbums(groepId)
  } else {
    wallsContainer.style.display = 'none'
    albumsContainer.style.display = 'none'
    concertenContainer.style.display = 'flex'
    btnWalls.classList.remove('actief')
    btnConcerten.classList.add('actief')
    if (selectieInfo) selectieInfo.style.display = 'none'
    if (prullenbak) prullenbak.style.display = 'none'
    laadConcerten()
  }
}

async function laadWallGroepenTabs() {
  const tabs = document.getElementById('sectie-tabs')
  const nieuweGroepBtn = document.getElementById('btn-nieuwe-groep')

  tabs.querySelectorAll('.tab-btn[data-groep-id]').forEach(el => el.remove())

  const groepen = getAlleWallGroepen()

  groepen.forEach(groep => {
    const btn = document.createElement('button')
    btn.className = 'tab-btn' + (huidigeSectie === 'groep' && huidigeGroepId === groep.id ? ' actief' : '')
    btn.dataset.groepId = groep.id

    const verwijderKnop = document.createElement('button')
    verwijderKnop.className = 'tab-verwijder'
    verwijderKnop.title = t('wallGroep.verwijderenTooltip')
    verwijderKnop.innerHTML = '&times;'
    verwijderKnop.onclick = (event) => {
      event.stopPropagation()
      bevestigWallGroepVerwijderen(groep.id, groep.naam)
    }

    const label = document.createElement('span')
    label.className = 'tab-label'
    label.textContent = groep.naam

    btn.appendChild(label)
    btn.appendChild(verwijderKnop)

    btn.title = t('wallGroep.hernoemenTooltip')
    btn.onclick = () => schakelSectie('groep', groep.id)
    btn.ondblclick = (event) => {
      event.stopPropagation()
      hernoemWallGroepPrompt(groep.id, groep.naam)
    }

    btn.draggable = true
    btn.ondragstart = (event) => {
      event.dataTransfer.setData('groepTabId', groep.id.toString())
      btn.style.opacity = '0.4'
    }
    btn.ondragend = () => {
      document.querySelectorAll('.tab-btn[data-groep-id]').forEach(t => t.style.opacity = '1')
    }
    btn.ondragover = (event) => { event.preventDefault(); btn.classList.add('drag-over') }
    btn.ondragleave = () => btn.classList.remove('drag-over')
    btn.ondrop = (event) => {
      event.preventDefault()
      btn.classList.remove('drag-over')

      const wallId = parseInt(event.dataTransfer.getData('wallId'))
      if (wallId) {
        verplaatsWallNaarGroep(wallId, groep.id)
        laadWalls()
        return
      }

      const bronGroepId = parseInt(event.dataTransfer.getData('groepTabId'))
      if (bronGroepId && bronGroepId !== groep.id) {
        herschikGroepTabs(bronGroepId, groep.id)
      }
    }

    tabs.insertBefore(btn, nieuweGroepBtn)
  })
}

function herschikGroepTabs(bronGroepId, doelGroepId) {
  const tabs = document.getElementById('sectie-tabs')
  const bronTab = tabs.querySelector('.tab-btn[data-groep-id="' + bronGroepId + '"]')
  const doelTab = tabs.querySelector('.tab-btn[data-groep-id="' + doelGroepId + '"]')
  if (!bronTab || !doelTab) return

  const groepTabs = Array.from(tabs.querySelectorAll('.tab-btn[data-groep-id]'))
  const bronIdx = groepTabs.indexOf(bronTab)
  const doelIdx = groepTabs.indexOf(doelTab)

  if (bronIdx < doelIdx) {
    tabs.insertBefore(bronTab, doelTab.nextSibling)
  } else {
    tabs.insertBefore(bronTab, doelTab)
  }

  const nieuweVolgorde = Array.from(tabs.querySelectorAll('.tab-btn[data-groep-id]'))
    .map(t => parseInt(t.dataset.groepId))
    .filter(id => !isNaN(id))

  ipcRenderer.send('sla-wallgroep-volgorde-op', nieuweVolgorde)
}

function voegWallGroepToe() {
  ipcRenderer.send('open-nieuwe-wallgroep')
}

function bevestigWallGroepVerwijderen(groepId, groepNaam) {
  ipcRenderer.send('bevestig-wallgroep-verwijderen', { groepId, groepNaam })
}

function hernoemWallGroepPrompt(groepId, huidigeNaam) {
  ipcRenderer.send('open-hernoem-wallgroep', { groepId, huidigeNaam })
}

function hernoemTabPrompt(type, huidigeNaam) {
  ipcRenderer.send('open-hernoem-tab', { type, huidigeNaam })
}

function pasTabNamenToe() {
  const wallsNaam = localStorage.getItem('musicwall-tab-walls-naam')
  const concertenNaam = localStorage.getItem('musicwall-tab-concerten-naam')

  if (wallsNaam) {
    const label = document.querySelector('#btn-walls .tab-label')
    label.textContent = wallsNaam
    label.removeAttribute('data-i18n')
  }

  if (concertenNaam) {
    const label = document.querySelector('#btn-concerten .tab-label')
    label.textContent = concertenNaam
    label.removeAttribute('data-i18n')
  }
}

async function laadConcerten() {
  const container = document.getElementById('concerten-container')
  container.innerHTML = ''

  const concerten = getAlleConcerten()

  if (concerten.length === 0) {
    container.innerHTML = '<div class="concerten-leeg">' + t('concert.leeg') + '</div>'
  } else {
    for (const concert of concerten) {
      const media = getMediaVoorConcert(concert.id)
      const eersteMedia = media[0]

      let coverHtml = '<div class="concert-cover-placeholder">&#9835;</div>'
      if (eersteMedia) {
        if (eersteMedia.type === 'foto') {
          coverHtml = '<img src="file:///' + eersteMedia.bestand_pad.replace(/\\/g, '/') + '" alt="">'
        } else if (eersteMedia.type === 'youtube') {
          const id = getYoutubeId(eersteMedia.bestand_pad)
          if (id) {
            coverHtml = '<img src="https://img.youtube.com/vi/' + id + '/hqdefault.jpg" alt="">'
          }
        } else {
          const pad = await ipcRenderer.invoke('maak-thumbnail', eersteMedia.bestand_pad)
          if (pad) {
            coverHtml = '<img src="file:///' + pad.replace(/\\/g, '/') + '" alt="">'
          }
        }
      }

      const verwijderKnop = '<button class="concert-verwijder-btn" onclick="event.stopPropagation();bevestigConcertVerwijderen(' + concert.id + ',\'' + concert.naam.replace(/'/g, "\\'") + '\')" title="' + t('concert.verwijderenTooltip') + '">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>'
        + '</button>'

      const bewerkKnop = '<button class="concert-bewerk-btn" onclick="event.stopPropagation();bewerkConcert(' + concert.id + ')" title="' + t('concert.bewerkenTooltip') + '">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>'
        + '</button>'

      const kaart = document.createElement('div')
      kaart.className = 'concert-kaart'
      kaart.dataset.concertId = concert.id
      kaart.draggable = true
      kaart.ondragstart = (event) => concertDragStart(event, concert.id, kaart)
      kaart.ondragend = () => concertDragEnd()
      kaart.ondragover = (event) => concertDragOver(event, kaart)
      kaart.ondragleave = () => concertDragLeave(kaart)
      kaart.ondrop = (event) => concertDrop(event, concert.id)
      kaart.innerHTML = '<div class="concert-cover">'
        + coverHtml
        + (media.length > 0 ? '<div class="concert-media-aantal">' + t('concert.items', { n: media.length }) + '</div>' : '')
        + verwijderKnop
        + bewerkKnop
        + '</div>'
        + '<div class="concert-info">'
        + '<div class="concert-artiest">' + (concert.artiest || '') + '</div>'
        + '<div class="concert-naam">' + concert.naam + '</div>'
        + '<div class="concert-datum">' + (concert.datum || '') + '</div>'
        + '</div>'

      kaart.onclick = () => openConcert(concert.id)
      container.appendChild(kaart)
    }
  }

  const nieuwBtn = document.createElement('button')
  nieuwBtn.className = 'concert-nieuw-btn'
  nieuwBtn.innerHTML = '+<span class="concert-nieuw-label">' + t('concert.nieuw') + '</span>'
  nieuwBtn.onclick = () => ipcRenderer.send('open-nieuw-concert')
  container.appendChild(nieuwBtn)

  const kaarten = container.querySelectorAll('.concert-kaart')
  if (window.gsap && kaarten.length > 0) {
    gsap.fromTo(kaarten,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.06 }
    )
  }
}

function openConcert(concertId) {
  ipcRenderer.send('open-concert-detail', concertId)
}

function bevestigConcertVerwijderen(concertId, concertNaam) {
  ipcRenderer.send('bevestig-concert-verwijderen', { concertId, concertNaam })
}

function bewerkConcert(concertId) {
  const concert = getAlleConcerten().find(c => c.id === concertId)
  if (!concert) return
  ipcRenderer.send('open-bewerk-concert', concert)
}

let sleepConcertBronId = null

function concertDragStart(event, concertId, el) {
  sleepConcertBronId = concertId
  event.dataTransfer.setData('concertId', concertId.toString())
  el.style.opacity = '0.4'
}

function concertDragEnd() {
  document.querySelectorAll('.concert-kaart').forEach(k => k.style.opacity = '1')
  sleepConcertBronId = null
}

function concertDragOver(event, el) {
  if (sleepConcertBronId === null) return
  event.preventDefault()
  el.classList.add('drag-over-kaart')
}

function concertDragLeave(el) {
  el.classList.remove('drag-over-kaart')
}

function concertDrop(event, doelConcertId) {
  const bronConcertId = parseInt(event.dataTransfer.getData('concertId'))
  if (!bronConcertId) return

  event.preventDefault()
  event.currentTarget.classList.remove('drag-over-kaart')

  if (bronConcertId === doelConcertId) return

  const container = document.getElementById('concerten-container')
  const bronKaart = container.querySelector('[data-concert-id="' + bronConcertId + '"]')
  const doelKaart = container.querySelector('[data-concert-id="' + doelConcertId + '"]')
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
    .map(k => parseInt(k.dataset.concertId))
    .filter(id => !isNaN(id))

  ipcRenderer.send('sla-concert-volgorde-op', nieuweVolgorde)
}

ipcRenderer.on('herlaad-concerten', () => {
  if (huidigeSectie === 'concerten') laadConcerten()
})

ipcRenderer.on('herlaad', () => {
  laadWallGroepenTabs()

  // als de groep die net actief was verwijderd is (bv. via de wallgroep-verwijderknop), blijft anders de
  // laatst-gerenderde inhoud (walls of albums) stilzwijgend op het scherm staan, zonder dat enige tab nog
  // als actief aangemerkt is - val dan terug op de vaste "Mijn walls"-tab
  if (huidigeSectie === 'groep' && !getAlleWallGroepen().some(g => g.id === huidigeGroepId)) {
    schakelSectie('walls')
  }
})

ipcRenderer.on('tab-naam-gewijzigd', (event, { type, naam }) => {
  localStorage.setItem('musicwall-tab-' + type + '-naam', naam)
  pasTabNamenToe()
})

document.addEventListener('taal-gewijzigd', pasTabNamenToe)

window.schakelSectie = schakelSectie
window.openConcert = openConcert
window.bevestigConcertVerwijderen = bevestigConcertVerwijderen
window.bewerkConcert = bewerkConcert
window.voegWallGroepToe = voegWallGroepToe
window.bevestigWallGroepVerwijderen = bevestigWallGroepVerwijderen

document.getElementById('btn-walls').addEventListener('click', () => schakelSectie('walls'))
document.getElementById('btn-concerten').addEventListener('click', () => schakelSectie('concerten'))

document.getElementById('btn-walls').addEventListener('dblclick', (event) => {
  event.stopPropagation()
  hernoemTabPrompt('walls', document.querySelector('#btn-walls .tab-label').textContent)
})
document.getElementById('btn-concerten').addEventListener('dblclick', (event) => {
  event.stopPropagation()
  hernoemTabPrompt('concerten', document.querySelector('#btn-concerten .tab-label').textContent)
})

const btnWallsTab = document.getElementById('btn-walls')
btnWallsTab.addEventListener('dragover', (event) => { event.preventDefault(); btnWallsTab.classList.add('drag-over') })
btnWallsTab.addEventListener('dragleave', () => btnWallsTab.classList.remove('drag-over'))
btnWallsTab.addEventListener('drop', (event) => {
  event.preventDefault()
  btnWallsTab.classList.remove('drag-over')
  const wallId = parseInt(event.dataTransfer.getData('wallId'))
  if (wallId) {
    verplaatsWallNaarGroep(wallId, null)
    laadWalls()
  }
})

pasTabNamenToe()
laadWallGroepenTabs()