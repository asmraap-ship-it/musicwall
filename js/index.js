const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getAlleWalls, verwijderWall, hernoemWall } = require('./db/walls.js')
const { getVideosVoorWall, verplaatsVideo, slaVolgordeOp } = require('./db/videos.js')

const geluiden = {
  click: new Audio('./sounds/click.mp3'),
  whoosh: new Audio('./sounds/whoosh.wav'),
  open: new Audio('./sounds/open.wav')
}

function speelGeluid(type) {
  const geluid = geluiden[type]
  if (!geluid) return
  geluid.currentTime = 0
  geluid.volume = 0.4
  geluid.play()
}

let active = {}
let videoData = []
let selectie = new Set()

function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(/[?&]v=([^&]+)/)
  return match ? match[1] : null
}

async function getThumbnail(video, idx) {
  const playIcon = '<div class="card-thumb-play">'
    + '<svg viewBox="0 0 24 24" fill="#c8a87a"><polygon points="5,3 19,12 5,21"/></svg>'
    + '</div>'

  const deleteKnop = '<button class="card-delete" title="' + t('video.verwijderenTooltip') + '" onclick="event.stopPropagation();bevestigVerwijderen(' + video.id + ')">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>'
    + '</button>'

  const bewerkKnop = '<button class="card-bewerk" title="' + t('video.bewerkenTooltip') + '" onclick="event.stopPropagation();bewerkVideo(' + idx + ')">✎</button>'

  const bronLabel = video.type === 'youtube'
    ? '<div class="card-bron youtube">' + t('video.bron.youtube') + '</div>'
    : '<div class="card-bron lokaal">' + t('video.bron.lokaal') + '</div>'

  if (video.type === 'youtube') {
    const id = getYoutubeId(video.youtube_url)
    if (id) {
      return '<div class="card-thumb-wrap" onclick="if(!event.ctrlKey)speelAfIdx(' + idx + ')">'
        + '<img class="card-thumbnail" src="https://img.youtube.com/vi/' + id + '/hqdefault.jpg">'
        + playIcon + deleteKnop + bewerkKnop + bronLabel
        + '</div>'
    }
  }

  if (video.type === 'lokaal' && video.lokaal_pad) {
    const pad = await ipcRenderer.invoke('maak-thumbnail', video.lokaal_pad)
    if (pad) {
      return '<div class="card-thumb-wrap" onclick="if(!event.ctrlKey)speelAfIdx(' + idx + ')">'
        + '<img class="card-thumbnail" src="file:///' + pad.replace(/\\/g, '/') + '">'
        + playIcon + deleteKnop + bewerkKnop + bronLabel
        + '</div>'
    }
  }

  return '<div class="card-thumb-wrap" onclick="if(!event.ctrlKey)speelAfIdx(' + idx + ')">'
    + '<div class="card-thumbnail-placeholder">\u25b6</div>'
    + deleteKnop + bronLabel
    + '</div>'
}

function openToevoegen(wallId) {
  ipcRenderer.send('open-toevoegen', wallId)
}

function openImporteren() {
  ipcRenderer.send('open-importeren')
}

function openZoeken() {
  ipcRenderer.send('open-zoeken')
}

function openHelp() {
  ipcRenderer.send('open-help')
}

function openJukebox() {
  ipcRenderer.send('open-jukebox')
}

function stuurNaarJukebox() {
  if (selectie.size === 0) {
    alert(t('jukebox.geenSelectie'))
    return
  }

  const idsArray = Array.from(selectie)
  const lokaleIds = idsArray.filter(id => {
    const v = videoData.find(v => v.id === id)
    return v && v.type === 'lokaal'
  })

  const aantalYoutube = idsArray.length - lokaleIds.length

  if (lokaleIds.length === 0) {
    alert(t('jukebox.alleenLokaal'))
    return
  }

  if (aantalYoutube > 0) {
    alert(t('jukebox.youtubeOvergeslagen', { n: aantalYoutube }))
  }

  ipcRenderer.send('toevoegen-aan-playlist', lokaleIds)
  deselecteerAlles()
}

function wisselThema(thema) {
  if (thema) {
    document.documentElement.setAttribute('data-thema', thema)
  } else {
    document.documentElement.removeAttribute('data-thema')
  }
  localStorage.setItem('musicwall-thema', thema)
  ipcRenderer.send('thema-gewijzigd', thema)
}

const themaLabelSleutels = { '': 'thema.standaard', metaal: 'thema.metaal', jukebox: 'thema.jukebox', nacht: 'thema.nacht', jr: 'thema.raw', natuur: 'thema.natuur', licht: 'thema.licht' }

function kiesThema(thema) {
  wisselThema(thema)
  document.getElementById('thema-label').textContent = t(themaLabelSleutels[thema] || 'thema.standaard')
  document.getElementById('thema-dropdown').classList.remove('open')
  document.getElementById('thema-menu').style.display = 'none'
}

function toggleThemaMenu(event) {
  if (event) event.stopPropagation()

  const dropdown = document.getElementById('thema-dropdown')
  const menu = document.getElementById('thema-menu')
  const knop = dropdown.querySelector('.thema-knop')

  const isOpen = menu.style.display === 'block'

  if (isOpen) {
    menu.style.display = 'none'
    dropdown.classList.remove('open')
  } else {
    const rect = knop.getBoundingClientRect()
    menu.style.display = 'block'
    menu.style.top = (rect.bottom + 6) + 'px'
    menu.style.left = (rect.right - menu.offsetWidth) + 'px'
    dropdown.classList.add('open')
  }
}

function kiesTaal(taal) {
  wisselTaal(taal)
  document.getElementById('taal-label').textContent = taal.toUpperCase()
  document.getElementById('taal-dropdown').classList.remove('open')
  document.getElementById('taal-menu').style.display = 'none'
}

function toggleTaalMenu(event) {
  if (event) event.stopPropagation()

  const dropdown = document.getElementById('taal-dropdown')
  const menu = document.getElementById('taal-menu')
  const knop = dropdown.querySelector('.thema-knop')

  const isOpen = menu.style.display === 'block'

  if (isOpen) {
    menu.style.display = 'none'
    dropdown.classList.remove('open')
  } else {
    const rect = knop.getBoundingClientRect()
    menu.style.display = 'block'
    menu.style.top = (rect.bottom + 6) + 'px'
    menu.style.left = (rect.right - menu.offsetWidth) + 'px'
    dropdown.classList.add('open')
  }
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('thema-dropdown')
  const menu = document.getElementById('thema-menu')
  if (dropdown && !dropdown.contains(e.target)) {
    dropdown.classList.remove('open')
    if (menu) menu.style.display = 'none'
  }

  const taalDropdown = document.getElementById('taal-dropdown')
  const taalMenu = document.getElementById('taal-menu')
  if (taalDropdown && !taalDropdown.contains(e.target)) {
    taalDropdown.classList.remove('open')
    if (taalMenu) taalMenu.style.display = 'none'
  }
})

function laadOpgeslagenThema() {
  let thema = localStorage.getItem('musicwall-thema')
  if (thema === null) {
    thema = ''
    localStorage.setItem('musicwall-thema', thema)
  }
  if (thema) {
    document.documentElement.setAttribute('data-thema', thema)
  }
  const label = document.getElementById('thema-label')
  if (label) label.textContent = t(themaLabelSleutels[thema || ''] || 'thema.standaard')
  ipcRenderer.send('thema-gewijzigd', thema || '')

  const taalLabel = document.getElementById('taal-label')
  if (taalLabel) taalLabel.textContent = huidigeTaalCode().toUpperCase()
}

function speelAfIdx(idx) {
  const video = videoData[idx]
  speelGeluid('whoosh')
  if (video.type === 'youtube') {
    ipcRenderer.send('open-video', video.youtube_url)
  } else {
    ipcRenderer.send('open-lokaal', video.lokaal_pad)
  }
}

ipcRenderer.on('herlaad', () => {
  laadWalls()
})

function voegWallToe() {
  const groepId = typeof huidigeGroepId !== 'undefined' ? huidigeGroepId : null
  ipcRenderer.send('open-nieuwe-wall', groepId)
}

function bevestigWallVerwijderen(wallId, wallNaam) {
  ipcRenderer.send('bevestig-wall-verwijderen', { wallId, wallNaam })
}

function hernoemWallPrompt(wallId, huidigeNaam) {
  ipcRenderer.send('open-hernoem-wall', { wallId, huidigeNaam })
}

function bevestigVerwijderen(videoId) {
  const video = videoData.find(v => v.id === videoId)
  if (!video) return
  const naam = (video.artiest ? video.artiest + ' — ' : '') + video.titel
  ipcRenderer.send('bevestig-verwijderen', { videoId, naam })
}

function bewerkVideo(idx) {
  const video = videoData[idx]
  if (!video) return
  ipcRenderer.send('open-bewerken', video)
}

function toggleSelectie(event, cardEl, videoId) {
  if (!event.ctrlKey) return

  event.stopPropagation()
  event.preventDefault()

  if (selectie.has(videoId)) {
    selectie.delete(videoId)
    cardEl.classList.remove('geselecteerd')
  } else {
    selectie.add(videoId)
    cardEl.classList.add('geselecteerd')
  }

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

function deselecteerAlles() {
  document.querySelectorAll('.card.geselecteerd').forEach(c => c.classList.remove('geselecteerd'))
  selectie.clear()
  updateSelectieInfo()
}

function toggleSelecteerAlleLokaal(wallId) {
  const wallEl = document.getElementById('wall-' + wallId)
  if (!wallEl) return

  const lokaleCards = Array.from(wallEl.querySelectorAll('.card')).filter(c => {
    const v = videoData.find(v => v.id === parseInt(c.dataset.videoId))
    return v && v.type === 'lokaal'
  })
  if (lokaleCards.length === 0) return

  const alleGeselecteerd = lokaleCards.every(c => selectie.has(parseInt(c.dataset.videoId)))

  lokaleCards.forEach(c => {
    const id = parseInt(c.dataset.videoId)
    if (alleGeselecteerd) {
      selectie.delete(id)
      c.classList.remove('geselecteerd')
    } else {
      selectie.add(id)
      c.classList.add('geselecteerd')
    }
  })

  updateSelectieInfo()
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') deselecteerAlles()
})

function prullenbakOver(event) {
  event.preventDefault()
  document.getElementById('prullenbak').classList.add('hover')
}

function prullenbakLeave(event) {
  document.getElementById('prullenbak').classList.remove('hover')
}

function prullenbakDrop(event) {
  event.preventDefault()
  document.getElementById('prullenbak').classList.remove('hover')

  const ids = event.dataTransfer.getData('selectieIds')
  if (ids) {
    const idArray = ids.split(',').map(id => parseInt(id))
    const namen = idArray.map(id => {
      const v = videoData.find(v => v.id === id)
      return v ? (v.artiest ? v.artiest + ' — ' : '') + v.titel : ''
    }).join('\n')
    ipcRenderer.send('bevestig-verwijderen-meerdere', { ids: idArray, namen })
  }
}

function dragStart(event, videoId) {
  if (selectie.size > 0 && selectie.has(videoId)) {
    const ids = Array.from(selectie).join(',')
    event.dataTransfer.setData('videoId', videoId.toString())
    event.dataTransfer.setData('selectieIds', ids)
    document.querySelectorAll('.card.geselecteerd').forEach(c => c.style.opacity = '0.4')
  } else {
    deselecteerAlles()
    event.dataTransfer.setData('videoId', videoId.toString())
    event.dataTransfer.setData('selectieIds', videoId.toString())
    event.currentTarget.style.opacity = '0.4'
  }
  document.getElementById('prullenbak').classList.add('actief')
}

function dragEnd(event) {
  document.querySelectorAll('.card').forEach(c => c.style.opacity = '1')
  document.getElementById('prullenbak').classList.remove('actief')
}

function dragOver(event) {
  event.preventDefault()
  event.currentTarget.classList.add('drag-over')
}

function dragLeave(event) {
  event.currentTarget.classList.remove('drag-over')
}

let sleepBronId = null
let sleepBronWallId = null
let sleepWallBronId = null

function wallDragStart(event, wallId) {
  sleepWallBronId = wallId
  event.dataTransfer.setData('wallId', wallId.toString())
  event.currentTarget.closest('.wall').style.opacity = '0.4'
}

function wallDragEnd(event) {
  document.querySelectorAll('.wall').forEach(w => w.style.opacity = '1')
  sleepWallBronId = null
}

function wallDragOver(event, el) {
  if (sleepWallBronId === null) return
  event.preventDefault()
  el.classList.add('drag-over-kaart')
}

function wallDragLeave(el) {
  el.classList.remove('drag-over-kaart')
}

function wallDrop(event, doelWallId) {
  const bronWallId = parseInt(event.dataTransfer.getData('wallId'))
  if (!bronWallId) return

  event.preventDefault()
  event.currentTarget.classList.remove('drag-over-kaart')

  if (bronWallId === doelWallId) return

  const container = document.getElementById('walls-container')
  const bronWall = document.getElementById('wall-' + bronWallId)
  const doelWall = document.getElementById('wall-' + doelWallId)
  if (!bronWall || !doelWall) return

  const walls = Array.from(container.querySelectorAll('.wall'))
  const bronIdx = walls.indexOf(bronWall)
  const doelIdx = walls.indexOf(doelWall)

  if (bronIdx < doelIdx) {
    container.insertBefore(bronWall, doelWall.nextSibling)
  } else {
    container.insertBefore(bronWall, doelWall)
  }

  const nieuweVolgorde = Array.from(container.querySelectorAll('.wall'))
    .map(w => parseInt(w.id.replace('wall-', '')))
    .filter(id => !isNaN(id))

  ipcRenderer.send('sla-wall-volgorde-op', nieuweVolgorde)
}

function kaartDragStart(event, videoId, wallId) {
  sleepBronId = videoId
  sleepBronWallId = wallId

  if (selectie.size > 0 && selectie.has(videoId)) {
    const ids = Array.from(selectie).join(',')
    event.dataTransfer.setData('videoId', videoId.toString())
    event.dataTransfer.setData('selectieIds', ids)
    document.querySelectorAll('.card.geselecteerd').forEach(c => c.style.opacity = '0.4')
  } else {
    deselecteerAlles()
    event.dataTransfer.setData('videoId', videoId.toString())
    event.dataTransfer.setData('selectieIds', videoId.toString())
    event.currentTarget.style.opacity = '0.4'
  }
  document.getElementById('prullenbak').classList.add('actief')
}

function kaartDragOver(event, el) {
  event.preventDefault()
  el.classList.add('drag-over-kaart')
}

function kaartDragLeave(el) {
  el.classList.remove('drag-over-kaart')
}

function kaartDrop(event, doelVideoId, wallId) {
  event.preventDefault()

  const bronId = parseInt(event.dataTransfer.getData('videoId'))
  if (!bronId) return

  const bronCard = document.querySelector('[data-video-id="' + bronId + '"]')
  const doelCard = document.querySelector('[data-video-id="' + doelVideoId + '"]')
  if (!bronCard || !doelCard) return

  const bronWall = bronCard.closest('.wall-videos')
  const doelWall = doelCard.closest('.wall-videos')

  doelCard.classList.remove('drag-over-kaart')
  bronCard.style.opacity = '1'
  document.getElementById('prullenbak').classList.remove('actief')

  if (bronWall.isSameNode(doelWall) && bronId !== doelVideoId) {
    event.stopPropagation()

    const cards = Array.from(doelWall.querySelectorAll('.card'))
    const bronIdx = cards.indexOf(bronCard)
    const doelIdx = cards.indexOf(doelCard)

    if (bronIdx < doelIdx) {
      doelWall.insertBefore(bronCard, doelCard.nextSibling)
    } else {
      doelWall.insertBefore(bronCard, doelCard)
    }

    const nieuweVolgorde = Array.from(doelWall.querySelectorAll('.card'))
      .map(c => parseInt(c.dataset.videoId))
      .filter(id => !isNaN(id))

    ipcRenderer.send('sla-volgorde-op', nieuweVolgorde)
  }

  sleepBronId = null
  sleepBronWallId = null
}

function drop(event, wallId) {
  event.preventDefault()
  event.currentTarget.classList.remove('drag-over')

  const ids = event.dataTransfer.getData('selectieIds')
  if (ids) {
    ids.split(',').forEach(id => {
      verplaatsVideo(parseInt(id), wallId)
    })
    deselecteerAlles()
    laadWalls()
  }
}

function toggle(wallId, n) {
  const body = document.getElementById('b' + wallId + '-' + n)
  const ch = document.getElementById('ch' + wallId + '-' + n)
  const isOpen = body.classList.contains('open')
  speelGeluid(isOpen ? 'click' : 'open')

  if (active[wallId] && active[wallId] !== n) {
    const vorigeBody = document.getElementById('b' + wallId + '-' + active[wallId])
    const vorigeCh = document.getElementById('ch' + wallId + '-' + active[wallId])
    if (window.gsap) {
      gsap.to(vorigeBody, {
        height: 0, opacity: 0, duration: 0.25, ease: 'power2.in',
        onComplete: () => {
          vorigeBody.classList.remove('open')
          vorigeBody.style.height = ''
          vorigeBody.style.opacity = ''
        }
      })
    } else {
      vorigeBody.classList.remove('open')
    }
    vorigeCh.classList.remove('open')
  }

  if (isOpen) {
    if (window.gsap) {
      gsap.to(body, {
        height: 0, opacity: 0, duration: 0.25, ease: 'power2.in',
        onComplete: () => {
          body.classList.remove('open')
          body.style.height = ''
          body.style.opacity = ''
        }
      })
    } else {
      body.classList.remove('open')
    }
    ch.classList.remove('open')
    active[wallId] = null
  } else {
    body.classList.add('open')
    ch.classList.add('open')
    active[wallId] = n
    if (window.gsap) {
      const hoogte = body.scrollHeight
      gsap.fromTo(body,
        { height: 0, opacity: 0 },
        { height: hoogte, opacity: 1, duration: 0.3, ease: 'power2.out',
          onComplete: () => { body.style.height = 'auto' }
        }
      )
    }
  }
}

function kaartHoverIn(el) {
  if (window.gsap) gsap.to(el, { scale: 1.02, duration: 0.2, ease: 'power2.out' })
}

function kaartHoverUit(el) {
  if (window.gsap) gsap.to(el, { scale: 1, duration: 0.2, ease: 'power2.out' })
}

window.addEventListener('mousemove', (e) => {
  const container = document.getElementById('walls-container')
  if (!container) return

  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  const dx = (e.clientX - cx) / cx
  const dy = (e.clientY - cy) / cy

  const walls = container.querySelectorAll('.wall')
  walls.forEach((wall, i) => {
    const diepte = (i % 3 + 1) * 1
    wall.style.transform = 'translate(' + (dx * diepte * -1) + 'px, ' + (dy * diepte * 0.5 * -1) + 'px)'
    wall.style.transition = 'transform 0.3s ease-out'
  })
})

async function laadWalls() {
  const container = document.getElementById('walls-container')
  container.innerHTML = ''

  const alleWalls = getAlleWalls()
  const walls = typeof huidigeGroepId !== 'undefined' && huidigeGroepId
    ? alleWalls.filter(w => w.groep_id === huidigeGroepId)
    : alleWalls.filter(w => !w.groep_id)
  videoData = []

  for (const wall of walls) {
    const videos = getVideosVoorWall(wall.id)
    const heeftLokaal = videos.some(v => v.type === 'lokaal')
    let kaarten = ''

    for (let index = 0; index < videos.length; index++) {
      const video = videos[index]
      const n = index + 1
      const idx = videoData.length
      videoData.push(video)

      const thumbnail = await getThumbnail(video, idx)

      kaarten += '<div class="card" id="c' + wall.id + '-' + n + '" data-video-id="' + video.id + '"'
        + ' draggable="true"'
        + ' ondragstart="kaartDragStart(event,' + video.id + ',' + wall.id + ')"'
        + ' ondragend="dragEnd(event)"'
        + ' ondragover="kaartDragOver(event, this)"'
        + ' ondragleave="kaartDragLeave(this)"'
        + ' ondrop="kaartDrop(event,' + video.id + ',' + wall.id + ')"'
        + ' onclick="toggleSelectie(event, this,' + video.id + ')"'
        + ' onmouseenter="kaartHoverIn(this)"'
        + ' onmouseleave="kaartHoverUit(this)">'
        + thumbnail
        + '<div class="card-header" onclick="toggle(' + wall.id + ',' + n + ')">'
        + '<div class="card-number">0' + n + '</div>'
        + '<div class="card-meta">'
        + '<div class="card-artist">' + (video.artiest || '') + '</div>'
        + '<div class="card-title">' + video.titel + '</div>'
        + '<div class="card-tag">\u25cf ' + (video.tag || '') + '</div>'
        + '</div>'
        + '<div class="chevron" id="ch' + wall.id + '-' + n + '">&#8964;</div>'
        + '</div>'
        + '<div class="card-body" id="b' + wall.id + '-' + n + '">'
        + '<div class="card-story"><p>' + (video.verhaal || '') + '</p></div>'
        + '</div>'
        + '</div>'
    }

    const wallHtml = '<div class="wall" id="wall-' + wall.id + '">'
      + '<div class="wall-header"'
      + ' draggable="true"'
      + ' ondragstart="wallDragStart(event,' + wall.id + ')"'
      + ' ondragend="wallDragEnd(event)"'
      + ' ondragover="wallDragOver(event, this)"'
      + ' ondragleave="wallDragLeave(this)"'
      + ' ondrop="wallDrop(event,' + wall.id + ')">'
      + '<span class="wall-naam" onclick="hernoemWallPrompt(' + wall.id + ',\'' + wall.naam.replace(/'/g, "\\'") + '\')" title="' + t('wall.hernoemenTooltip') + '" style="cursor:pointer">' + wall.naam + '</span>'
      + '<div style="display:flex;align-items:center;gap:0.5rem">'
      + '<span class="wall-aantal">' + videos.length + '</span>'
      + (heeftLokaal
        ? '<button class="wall-selecteer-btn" onclick="toggleSelecteerAlleLokaal(' + wall.id + ')" title="' + t('wall.selecteerLokaleTooltip') + '">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7,12 10.5,15.5 17,8.5"/></svg>'
          + '</button>'
        : '')
      + '<button class="wall-verwijder-btn" onclick="bevestigWallVerwijderen(' + wall.id + ',\'' + wall.naam.replace(/'/g, "\\'") + '\')" title="' + t('wall.verwijderenTooltip') + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>'
      + '</button>'
      + '</div>'
      + '</div>'
      + '<div class="wall-videos"'
      + ' ondragover="dragOver(event)"'
      + ' ondragleave="dragLeave(event)"'
      + ' ondrop="drop(event,' + wall.id + ')">'
      + kaarten + '</div>'
      + '<div class="wall-footer">'
      + '<button class="wall-toevoegen-btn" onclick="openToevoegen(' + wall.id + ')">' + t('wall.nummerToevoegen') + '</button>'
      + '</div>'
      + '</div>'

    container.innerHTML += wallHtml
  }

  container.innerHTML += '<button class="nieuwe-wall-btn" onclick="voegWallToe()" title="' + t('wall.nieuweWall') + '">+</button>'

  if (window.gsap) {
    gsap.fromTo(document.querySelectorAll('.wall'),
      { opacity: 0, y: 24, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', stagger: 0.08 }
    )
    gsap.fromTo(document.querySelectorAll('.card'),
      { opacity: 0, x: -12 },
      { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out', stagger: 0.03, delay: 0.2 }
    )
  } else {
    document.querySelectorAll('.wall, .card').forEach(el => { el.style.opacity = '1' })
  }
}

laadWalls()
laadOpgeslagenThema()

document.addEventListener('taal-gewijzigd', () => {
  laadWalls()
  if (huidigeSectie === 'concerten' && typeof laadConcerten === 'function') laadConcerten()
})

window.kiesTaal = kiesTaal
window.toggleTaalMenu = toggleTaalMenu
window.wisselThema = wisselThema
window.toggle = toggle
window.speelAfIdx = speelAfIdx
window.openToevoegen = openToevoegen
window.openImporteren = openImporteren
window.voegWallToe = voegWallToe
window.bevestigVerwijderen = bevestigVerwijderen
window.bewerkVideo = bewerkVideo
window.dragStart = dragStart
window.dragEnd = dragEnd
window.dragOver = dragOver
window.dragLeave = dragLeave
window.drop = drop
window.prullenbakOver = prullenbakOver
window.prullenbakLeave = prullenbakLeave
window.prullenbakDrop = prullenbakDrop
window.toggleSelectie = toggleSelectie
window.toggleSelecteerAlleLokaal = toggleSelecteerAlleLokaal
window.kaartHoverIn = kaartHoverIn
window.kaartHoverUit = kaartHoverUit
window.openJukebox = openJukebox
window.stuurNaarJukebox = stuurNaarJukebox
window.openHelp = openHelp
window.bevestigWallVerwijderen = bevestigWallVerwijderen
window.hernoemWallPrompt = hernoemWallPrompt
window.kiesThema = kiesThema
window.toggleThemaMenu = toggleThemaMenu
window.openZoeken = openZoeken
window.kaartDragStart = kaartDragStart
window.kaartDragOver = kaartDragOver
window.kaartDragLeave = kaartDragLeave
window.kaartDrop = kaartDrop
window.wallDragStart = wallDragStart
window.wallDragEnd = wallDragEnd
window.wallDragOver = wallDragOver
window.wallDragLeave = wallDragLeave
window.wallDrop = wallDrop

if (window.gsap) {
  const introTl = gsap.timeline({ delay: 0.2 })

  if (document.querySelector('.logo')) {
    introTl.fromTo('.logo',
      { opacity: 0, letterSpacing: '0.8em' },
      { opacity: 1, letterSpacing: '0.4em', duration: 1.2, ease: 'power3.out' }
    )
  }

  if (document.querySelector('h1')) {
    introTl.fromTo('h1',
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' },
      '-=0.7'
    )
  }

  if (document.querySelectorAll('.toevoegen-btn').length > 0) {
    introTl.fromTo('.toevoegen-btn',
      { opacity: 0, x: -15 },
      { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out', stagger: 0.08 },
      '-=0.3'
    )
  }

  if (document.querySelector('.thema-dropdown')) {
    introTl.fromTo('.thema-dropdown',
      { opacity: 0, x: 15 },
      { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' },
      '-=0.4'
    )
  }
} else {
  document.querySelectorAll('.toevoegen-btn, .thema-dropdown, .logo, h1').forEach(el => {
    el.style.opacity = '1'
  })
}