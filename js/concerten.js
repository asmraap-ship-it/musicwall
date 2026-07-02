const { getAlleConcerten, verwijderConcert, getMediaVoorConcert } = require('./db/concerten.js')

let huidigeSectie = 'walls'

function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

function schakelSectie(sectie) {
  huidigeSectie = sectie

  const wallsContainer = document.getElementById('walls-container')
  const concertenContainer = document.getElementById('concerten-container')
  const btnWalls = document.getElementById('btn-walls')
  const btnConcerten = document.getElementById('btn-concerten')
  const selectieInfo = document.getElementById('selectie-info')
  const prullenbak = document.getElementById('prullenbak')

  if (sectie === 'walls') {
    wallsContainer.style.display = 'flex'
    concertenContainer.style.display = 'none'
    btnWalls.classList.add('actief')
    btnConcerten.classList.remove('actief')
    if (selectieInfo) selectieInfo.style.display = ''
    if (prullenbak) prullenbak.style.display = ''
  } else {
    wallsContainer.style.display = 'none'
    concertenContainer.style.display = 'flex'
    btnWalls.classList.remove('actief')
    btnConcerten.classList.add('actief')
    if (selectieInfo) selectieInfo.style.display = 'none'
    if (prullenbak) prullenbak.style.display = 'none'
    laadConcerten()
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

ipcRenderer.on('herlaad-concerten', () => {
  if (huidigeSectie === 'concerten') laadConcerten()
})

window.schakelSectie = schakelSectie
window.openConcert = openConcert
window.bevestigConcertVerwijderen = bevestigConcertVerwijderen
window.bewerkConcert = bewerkConcert

document.getElementById('btn-walls').addEventListener('click', () => schakelSectie('walls'))
document.getElementById('btn-concerten').addEventListener('click', () => schakelSectie('concerten'))