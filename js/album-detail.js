const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getAlbum, getAlbumsVoorGroep, getTracksVoorAlbum, verwijderTrack } = require('./db/albums.js')

let huidigAlbumId = null
let huidigAlbum = null
let selectie = new Set()
let huidigeTrackLijst = []
let huidigSpeelTrackId = null
let huidigeAlbumLijst = []
const albumSpeler = document.getElementById('album-speler')
// Op gebruikersverzoek: optioneel de platenspeler-animatie tonen tijdens het afspelen van een album, met
// hetzelfde js/turntable.js-component als de jukebox - bewust een losse, onthouden voorkeur i.p.v. altijd
// aan, want dit scherm is compacter dan de jukebox en niet iedereen wil de vertraging van de needle-drop-
// animatie vóór elk nummer.
let draaitafelZichtbaar = localStorage.getItem('musicwall-album-draaitafel-zichtbaar') === 'ja'
// Stroboscoop-gloed aan/uit (js/turntable.js's setStroboZichtbaar()) - decoratieve toggle, zelfde
// localStorage-sleutel als js/jukebox.js (gedeeld, net als musicwall-platenspeler-schaal).
let stroboLichtVoorkeur = localStorage.getItem('musicwall-strobo-zichtbaar') !== 'nee'
// Hovertekst beschrijft steeds de actie die een klik nu zou uitvoeren (dus het omgekeerde van de huidige
// staat) - zelfde aanpak als js/jukebox.js, geen data-i18n-title meer op dit element (zie de
// 'taal-gewijzigd'-listener verderop in dit bestand).
function bijwerkenStroboTooltip() {
  document.getElementById('strobo-toggle-btn').title = t(stroboLichtVoorkeur ? 'jukebox.stroboTooltipVerberg' : 'jukebox.stroboTooltipToon')
}
function toggleStroboZichtbaar() {
  stroboLichtVoorkeur = !stroboLichtVoorkeur
  localStorage.setItem('musicwall-strobo-zichtbaar', stroboLichtVoorkeur ? 'ja' : 'nee')
  document.getElementById('strobo-toggle-btn').classList.toggle('actief', stroboLichtVoorkeur)
  bijwerkenStroboTooltip()
  if (window.Turntable) window.Turntable.setStroboZichtbaar(stroboLichtVoorkeur)
}
window.toggleStroboZichtbaar = toggleStroboZichtbaar

// Echte TEMPO-fader (2026-08-24): js/turntable.js weet niets van #album-speler, dus zet playbackRate
// hier zelf op basis van het percentage dat de fader doorgeeft. Eigen, losstaande tempo-staat t.o.v.
// een eventueel tegelijk open jukebox-venster - elk venster heeft toch al zijn eigen Turntable-
// module-instantie (zie CLAUDE.md). pasTempoRateToe() wordt ook expliciet aangeroepen vlak ná
// albumSpeler.src=... in laadTrack() (zie aldaar), zodat het gekozen tempo blijft gelden bij het
// wisselen van track i.p.v. terug te vallen op 1.0.
function pasTempoRateToe() {
  if (!window.Turntable) return
  albumSpeler.playbackRate = 1 + window.Turntable.getTempoPercent() / 100
}
if (window.Turntable) window.Turntable.onTempoChange(pasTempoRateToe)

async function laadAlbum(albumId) {
  huidigAlbumId = albumId
  const album = getAlbum(albumId)
  if (!album) return
  huidigAlbum = album

  document.title = album.naam

  const coverEl = document.getElementById('album-cover')
  coverEl.innerHTML = album.cover_pad
    ? '<img src="file:///' + album.cover_pad.replace(/\\/g, '/') + '" alt="">'
    : '<div class="media-placeholder">&#9835;</div>'

  document.getElementById('detail-artiest').textContent = album.artiest || ''
  document.getElementById('detail-naam').textContent = album.naam

  // dezelfde volgorde als het albums-grid (getAlbumsVoorGroep sorteert al op volgorde) - zo bladert
  // vorig/volgend album in dezelfde volgorde als de gebruiker de albumkaarten ziet, inclusief een
  // eventuele handmatig versleepte volgorde
  huidigeAlbumLijst = getAlbumsVoorGroep(album.groep_id)
  const meerdereAlbums = huidigeAlbumLijst.length > 1
  document.getElementById('album-vorig-album-btn').classList.toggle('onzichtbaar', !meerdereAlbums)
  document.getElementById('album-volgend-album-btn').classList.toggle('onzichtbaar', !meerdereAlbums)

  laadTrackLijst()
}

// Bladert tussen albums binnen dezelfde groep, met wrap-around (zelfde patroon als de ‹ ›-knoppen van de
// concert-detail-lightbox). laadAlbum() zelf regelt via laadTrackLijst()'s bestaande "track niet meer in
// de nieuwe lijst"-check al dat een eventueel spelend nummer van het oude album stopt, dus geen aparte
// albumStop()-aanroep hier nodig.
function vorigAlbum() {
  if (huidigeAlbumLijst.length < 2) return
  const i = huidigeAlbumLijst.findIndex(a => a.id === huidigAlbumId)
  const vorige = huidigeAlbumLijst[(i - 1 + huidigeAlbumLijst.length) % huidigeAlbumLijst.length]
  laadAlbum(vorige.id)
}

function volgendAlbum() {
  if (huidigeAlbumLijst.length < 2) return
  const i = huidigeAlbumLijst.findIndex(a => a.id === huidigAlbumId)
  const volgende = huidigeAlbumLijst[(i + 1) % huidigeAlbumLijst.length]
  laadAlbum(volgende.id)
}

function bewerkHuidigAlbum() {
  if (!huidigAlbum) return
  ipcRenderer.send('open-bewerk-album', huidigAlbum)
}

function laadTrackLijst() {
  const lijst = document.getElementById('track-lijst')
  lijst.innerHTML = ''

  const tracks = getTracksVoorAlbum(huidigAlbumId)
  huidigeTrackLijst = tracks

  // een track die net verwijderd is (los, of via bulkverwijderen vanuit de selectiebalk) kan de track zijn
  // die op dit moment in #album-speler staat - zonder deze check zou de navigatiebalk een niet meer
  // bestaande track blijven tonen
  if (huidigSpeelTrackId !== null && !tracks.some(t => t.id === huidigSpeelTrackId)) {
    albumStop()
  }

  document.getElementById('detail-aantal').textContent = t('albums.trackAantal', { n: tracks.length })

  if (tracks.length === 0) {
    lijst.innerHTML = '<div class="media-leeg">' + t('albumDetail.geenTracks') + '</div>'
    const selecteerBtn = document.getElementById('selecteer-alles-btn')
    if (selecteerBtn) selecteerBtn.style.display = 'none'
    bijwerkenSpeelUI()
    return
  }

  tracks.forEach((track, i) => {
    const rij = document.createElement('div')
    rij.className = 'track-rij'
    rij.dataset.trackId = track.id
    if (selectie.has(track.id)) rij.classList.add('geselecteerd')

    rij.innerHTML = '<span class="track-nummer">' + (i + 1) + '</span>'
      + '<button class="track-play" title="' + t('albumDetail.afspelenTooltip') + '" onclick="event.stopPropagation();trackKnopKlik(' + track.id + ')">' + trackPlayIconHtml(false) + '</button>'
      + '<div class="track-info"><div class="track-titel">' + escapeHtml(track.titel) + '</div><div class="track-artiest">' + escapeHtml(track.artiest || huidigAlbum.artiest || '') + '</div></div>'
      + '<button class="track-verwijder" title="' + t('albumDetail.trackVerwijderenTooltip') + '" onclick="event.stopPropagation();verwijderTrackItem(' + track.id + ')">&times;</button>'

    rij.onclick = (event) => {
      if (event.ctrlKey) toggleSelectie(track.id, rij)
    }

    lijst.appendChild(rij)
  })

  const selecteerBtn = document.getElementById('selecteer-alles-btn')
  if (selecteerBtn) selecteerBtn.style.display = ''

  const rijen = lijst.querySelectorAll('.track-rij')
  if (window.gsap && rijen.length > 0) {
    gsap.fromTo(rijen,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', stagger: 0.02 }
    )
  }

  bijwerkenSpeelUI()
}

// ▶-driehoek (niet spelend) vs. ⏸-blokjes (deze track speelt op dit moment) - bijwerkenTrackKnoppen()
// zet dit apart van de rest van bijwerkenSpeelUI() zodat een simpele pauze/hervat-toggle niet ook meteen
// de rij opnieuw laat scrollen (zie albumSpeelPauze())
function trackPlayIconHtml(spelend) {
  return spelend
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="5" height="18"/><rect x="14" y="3" width="5" height="18"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>'
}

function trackKnopKlik(trackId) {
  if (huidigSpeelTrackId === trackId) {
    albumSpeelPauze()
  } else {
    speelTrackAf(trackId)
  }
}

function bijwerkenTrackKnoppen() {
  document.querySelectorAll('.track-play').forEach(btn => { btn.innerHTML = trackPlayIconHtml(false) })
  if (huidigSpeelTrackId === null) return
  const rij = document.querySelector('.track-rij[data-track-id="' + huidigSpeelTrackId + '"]')
  const knop = rij && rij.querySelector('.track-play')
  if (knop) knop.innerHTML = trackPlayIconHtml(!albumSpeler.paused)
}

function bijwerkenSpeelUI() {
  document.querySelectorAll('.track-rij.speelt').forEach(el => el.classList.remove('speelt'))

  const label = document.getElementById('album-navigatie-track')
  const draaitafelInfo = document.getElementById('album-draaitafel-track-info')
  const track = huidigSpeelTrackId !== null ? huidigeTrackLijst.find(t => t.id === huidigSpeelTrackId) : null

  if (!track) {
    if (label) label.textContent = ''
    if (draaitafelInfo) draaitafelInfo.innerHTML = ''
    bijwerkenTrackKnoppen()
    return
  }

  const rij = document.querySelector('.track-rij[data-track-id="' + track.id + '"]')
  if (rij) {
    rij.classList.add('speelt')
    // Alleen scrollen als de tracklijst ook daadwerkelijk zichtbaar is (niet in speler-modus, zie
    // bijwerkenWeergave() - de tracklijst is dan verborgen) - anders scrolde de hele pagina, inclusief het
    // draaitafel-paneel zelf, mee omhoog bij elke navigatie. block:'nearest' (i.p.v. 'center') scrollt
    // daarnaast alleen als de rij niet al zichtbaar is, zelfde patroon als de jukebox' eigen playlist-scroll.
    if (!spelerModusActief()) rij.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const artiest = track.artiest || (huidigAlbum && huidigAlbum.artiest) || ''
  // Trackinfo staat óf in de navigatiebalk, óf (op gebruikersverzoek, net als bij de jukebox) prominent
  // onder de draaitafel zelf als die actief is - niet allebei tegelijk, dat is dubbelop.
  if (label) label.textContent = draaitafelZichtbaar ? '' : artiest + ' - ' + track.titel
  if (draaitafelInfo) {
    draaitafelInfo.innerHTML = draaitafelZichtbaar
      ? '<div class="album-draaitafel-track-artiest">' + escapeHtml(artiest) + '</div><div class="album-draaitafel-track-titel">' + escapeHtml(track.titel) + '</div>'
      : ''
  }
  bijwerkenTrackKnoppen()
}

function huidigSpeelIndex() {
  return huidigeTrackLijst.findIndex(t => t.id === huidigSpeelTrackId)
}

function spelerModusActief() {
  return draaitafelZichtbaar && huidigSpeelTrackId !== null
}

// Op gebruikersverzoek: óf de draaitafel, óf de tracklijst - nooit allebei tegelijk. De draaitafel is
// alleen zichtbaar zolang er ook echt een track geladen is (spelend of gepauzeerd), anders zou het paneel
// een leeg/stilstaand plaatje tonen zonder track. Toen beide nog tegelijk zichtbaar konden zijn, scrolde
// bijwerkenSpeelUI()'s scrollIntoView (zie aldaar) de hele pagina - dus ook de draaitafel zelf - mee omhoog
// bij elke navigatie, wat de speler zelf uit beeld liet lopen. Door de tracklijst nu volledig te verbergen
// zolang de speler actief is, is er niets meer om naartoe te scrollen.
function bijwerkenWeergave() {
  const actief = spelerModusActief()
  const wrap = document.getElementById('album-draaitafel-wrap')
  if (wrap) wrap.classList.toggle('zichtbaar', actief)
  document.getElementById('track-lijst').classList.toggle('verborgen', actief)
  document.querySelector('.track-acties-balk').classList.toggle('verborgen', actief)
}

function bijwerkenDraaitafelTooltip() {
  document.getElementById('draaitafel-toggle-btn').title = t(draaitafelZichtbaar ? 'albumDetail.draaitafelTooltipVerberg' : 'albumDetail.draaitafelTooltipToon')
}
function toggleDraaitafelZichtbaar() {
  draaitafelZichtbaar = !draaitafelZichtbaar
  localStorage.setItem('musicwall-album-draaitafel-zichtbaar', draaitafelZichtbaar ? 'ja' : 'nee')
  document.getElementById('draaitafel-toggle-btn').classList.toggle('actief', draaitafelZichtbaar)
  bijwerkenDraaitafelTooltip()
  bijwerkenWeergave()
  // Verplaatst de trackinfo meteen tussen navigatiebalk en onder-de-draaitafel (zie bijwerkenSpeelUI())
  bijwerkenSpeelUI()

  if (!window.Turntable) return

  if (draaitafelZichtbaar && huidigSpeelTrackId !== null) {
    // Middenin een nummer aangezet - het paneel zichtbaar maken simuleert geen "plaat opleggen"/"naald
    // laten zakken" (dat hoort alleen bij een echte start, zie laadTrack()), dus instant naar de huidige
    // afspeelstand i.p.v. de aankomst-/needle-drop-animaties opnieuw af te spelen.
    const progressie = albumSpeler.duration ? albumSpeler.currentTime / albumSpeler.duration : 0
    window.Turntable.toonHuidigeStandInstant(huidigAlbum.cover_pad || null, progressie, !albumSpeler.paused)
  } else if (!draaitafelZichtbaar) {
    // Uitgezet - opruimen zodat een latere heraanzet niet denkt dat er nog een (inmiddels onzichtbare)
    // plaat ligt.
    window.Turntable.verbergVinylInstant()
  }
}

// Gedeeld door laadTrack() en albumStop() - allebei zetten de voortgangsweergave terug naar 0, of omdat er
// een nieuw nummer begint of omdat er niets meer speelt.
function resetVoortgangsUI() {
  document.getElementById('album-progress-vulling').style.width = '0%'
  document.getElementById('album-tijd-huidig').textContent = '0:00'
  document.getElementById('album-tijd-duur').textContent = '0:00'
}

function laadTrack(track) {
  // Het vorige nummer stopt meteen, ongeacht hoe lang toonVinyl()/start() straks nog duurt vóórdat het
  // nieuwe geluid daadwerkelijk start (zelfde bug/fix als speelIndex() in js/jukebox.js) - zonder deze
  // regel bleef het vorige nummer gewoon doorspelen tijdens de hele needle-drop/plaatwissel-animatie, want
  // albumSpeler.src wordt nu pas ná die animatie overschreven (zie startAfspelen() hieronder).
  albumSpeler.pause()

  huidigSpeelTrackId = track.id
  resetVoortgangsUI()
  bijwerkenSpeelUI()
  bijwerkenWeergave()

  // #album-play-btn's icoon/actief-status wordt niet hier gezet, maar door de native 'play'/'pause'-
  // listeners op albumSpeler hieronder - dat gebeurt dan vanzelf pas zodra het geluid écht start (na de
  // needle-drop-animatie bij "draaitafel aan"), i.p.v. optimistisch al bij het laden. bijwerkenTrackKnoppen()
  // (het ▶/⏸-icoontje ván de trackrij zelf) volgt dezelfde route via de 'play'-listener.
  const startAfspelen = () => {
    albumSpeler.src = 'file:///' + track.lokaal_pad.replace(/\\/g, '/')
    pasTempoRateToe()
    albumSpeler.play()
  }

  if (draaitafelZichtbaar && window.Turntable) {
    // Zelfde patroon als de jukebox (speelIndex() in js/jukebox.js): arm eerst instant naar rust, dan de
    // plaat wisselen (of laten liggen bij hetzelfde album - toonVinyl() herkent dat zelf via cover_pad) en
    // pas ná de needle-drop het geluid starten, zodat je nooit geluid hoort vóórdat de naald zichtbaar
    // landt.
    window.Turntable.stop()
    window.Turntable.reset()
    window.Turntable.toonVinyl(huidigAlbum.cover_pad || null, () => {
      window.Turntable.start(startAfspelen)
    })
  } else {
    startAfspelen()
  }
}

function formatTijd(seconden) {
  if (!isFinite(seconden) || seconden < 0) seconden = 0
  const m = Math.floor(seconden / 60)
  const s = Math.floor(seconden % 60)
  return m + ':' + String(s).padStart(2, '0')
}

albumSpeler.addEventListener('timeupdate', () => {
  const pct = albumSpeler.duration ? (albumSpeler.currentTime / albumSpeler.duration) * 100 : 0
  document.getElementById('album-progress-vulling').style.width = pct + '%'
  document.getElementById('album-tijd-huidig').textContent = formatTijd(albumSpeler.currentTime)
  if (draaitafelZichtbaar && window.Turntable) window.Turntable.bijwerken(albumSpeler.currentTime, albumSpeler.duration)
})

albumSpeler.addEventListener('loadedmetadata', () => {
  document.getElementById('album-tijd-duur').textContent = formatTijd(albumSpeler.duration)
})

// Eén plek voor alles wat van de daadwerkelijke afspeel/pauze-status van albumSpeler afhangt (icoon, groene
// "actief"-indicator, rij-icoontje) - native 'play'/'pause'-events i.p.v. dit los per functie te zetten
// (laadTrack()/albumSpeelPauze()/albumStop()/de 'ended'-handler riepen dit vroeger allemaal zelf aan, wat
// zowel dubbel werk was als een keer daadwerkelijk uit de pas liep, zie bijwerkenTrackKnoppen()). Deze
// events vuren betrouwbaar ongeacht via welk pad het geluid start/stopt (inclusief de door de draaitafel
// vertraagde start), dus blijft alles hier altijd synchroon met de werkelijke afspeelstatus.
albumSpeler.addEventListener('play', () => {
  document.getElementById('album-play-btn').textContent = '⏸'
  document.getElementById('album-play-btn').classList.add('speelt-actief')
  bijwerkenTrackKnoppen()
})
albumSpeler.addEventListener('pause', () => {
  document.getElementById('album-play-btn').textContent = '▶'
  document.getElementById('album-play-btn').classList.remove('speelt-actief')
  bijwerkenTrackKnoppen()
})

function zoekInAlbumSpeler(event) {
  if (!albumSpeler.duration) return
  const balk = document.getElementById('album-progress-balk')
  const rect = balk.getBoundingClientRect()
  const fractie = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  albumSpeler.currentTime = fractie * albumSpeler.duration
}

function albumSpeelPauze() {
  if (huidigSpeelTrackId === null) {
    if (huidigeTrackLijst.length > 0) laadTrack(huidigeTrackLijst[0])
    return
  }

  // #album-play-btn's icoon/actief-status en het rij-icoontje volgen hier niet handmatig, maar via de
  // native 'play'/'pause'-listeners op albumSpeler (zie aldaar).
  if (albumSpeler.paused) {
    if (draaitafelZichtbaar && window.Turntable) {
      window.Turntable.start(() => albumSpeler.play())
    } else {
      albumSpeler.play()
    }
  } else {
    albumSpeler.pause()
    // Pauzeren tilt alleen de arm - de plaat blijft liggen (zelfde gedrag als de jukebox, zie
    // js/turntable.js's stop()/verbergVinyl()-onderscheid)
    if (draaitafelZichtbaar && window.Turntable) window.Turntable.stop()
  }
}

function albumStop() {
  albumSpeler.pause()
  albumSpeler.removeAttribute('src')
  if (draaitafelZichtbaar && window.Turntable) {
    window.Turntable.stop()
    window.Turntable.verbergVinyl()
  }
  huidigSpeelTrackId = null
  resetVoortgangsUI()
  bijwerkenSpeelUI()
  bijwerkenWeergave()
}

function albumVorige() {
  const i = huidigSpeelIndex()
  if (i <= 0) return
  laadTrack(huidigeTrackLijst[i - 1])
}

function albumVolgende() {
  const i = huidigSpeelIndex()
  if (i === -1 || i >= huidigeTrackLijst.length - 1) return
  laadTrack(huidigeTrackLijst[i + 1])
}

function albumEerste() {
  if (huidigeTrackLijst.length === 0) return
  laadTrack(huidigeTrackLijst[0])
}

function albumLaatste() {
  if (huidigeTrackLijst.length === 0) return
  laadTrack(huidigeTrackLijst[huidigeTrackLijst.length - 1])
}

albumSpeler.addEventListener('ended', () => {
  const i = huidigSpeelIndex()
  if (i !== -1 && i < huidigeTrackLijst.length - 1) {
    albumVolgende()
  } else {
    // Laatste track van het album afgespeeld: albumStop() tilt de toonarm terug naar rust en haalt de
    // plaat weg - zonder deze aanroep bleef de naald op de bij het einde horende hoek hangen, want er komt
    // na 'ended' geen timeupdate meer die bijwerken() opnieuw zou aanroepen.
    albumStop()
  }
})

function toggleSelecteerAlleInAlbum() {
  if (huidigeTrackLijst.length === 0) return

  const alleGeselecteerd = huidigeTrackLijst.every(t => selectie.has(t.id))

  huidigeTrackLijst.forEach(t => {
    if (alleGeselecteerd) selectie.delete(t.id)
    else selectie.add(t.id)
  })

  document.querySelectorAll('.track-rij[data-track-id]').forEach(rij => {
    const id = parseInt(rij.dataset.trackId)
    rij.classList.toggle('geselecteerd', selectie.has(id))
  })

  updateSelectieInfo()
}

function speelTrackAf(trackId) {
  const track = huidigeTrackLijst.find(t => t.id === trackId)
  if (!track) return
  laadTrack(track)
}

function verwijderTrackItem(trackId) {
  verwijderTrack(trackId)
  selectie.delete(trackId)
  updateSelectieInfo()
  laadTrackLijst()
}

function toggleSelectie(trackId, rijEl) {
  if (selectie.has(trackId)) {
    selectie.delete(trackId)
    rijEl.classList.remove('geselecteerd')
  } else {
    selectie.add(trackId)
    rijEl.classList.add('geselecteerd')
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
  document.querySelectorAll('.track-rij.geselecteerd').forEach(el => el.classList.remove('geselecteerd'))
  selectie.clear()
  updateSelectieInfo()
}

function stuurNaarJukebox() {
  if (selectie.size === 0) return

  const items = Array.from(selectie)
    .map(id => huidigeTrackLijst.find(t => t.id === id))
    .filter(Boolean)
    .map(track => ({
      type: 'lokaal',
      lokaalPad: track.lokaal_pad,
      artiest: track.artiest || huidigAlbum.artiest,
      titel: track.titel,
      coverPad: huidigAlbum.cover_pad
    }))

  if (items.length > 0) {
    ipcRenderer.send('album-tracks-naar-playlist', items)
  }

  deselecteerAlles()
}

function verwijderSelectie() {
  if (selectie.size === 0) return

  const idArray = Array.from(selectie)
  const namen = idArray.map(id => {
    const track = huidigeTrackLijst.find(t => t.id === id)
    return track ? track.titel : ''
  }).join('\n')

  ipcRenderer.send('bevestig-album-tracks-verwijderen-meerdere', { ids: idArray, namen })
  deselecteerAlles()
}

ipcRenderer.on('album-tracks-verwijderd', () => {
  laadTrackLijst()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') deselecteerAlles()
})

ipcRenderer.on('laad-album', (event, albumId) => laadAlbum(albumId))

ipcRenderer.on('herlaad-albums', () => {
  if (huidigAlbumId) laadAlbum(huidigAlbumId)
})

document.addEventListener('taal-gewijzigd', () => {
  if (huidigAlbumId) laadTrackLijst()
})

window.speelTrackAf = speelTrackAf
window.trackKnopKlik = trackKnopKlik
window.verwijderTrackItem = verwijderTrackItem
window.bewerkHuidigAlbum = bewerkHuidigAlbum
window.stuurNaarJukebox = stuurNaarJukebox
window.vorigAlbum = vorigAlbum
window.volgendAlbum = volgendAlbum
window.verwijderSelectie = verwijderSelectie
window.toggleSelecteerAlleInAlbum = toggleSelecteerAlleInAlbum
window.albumSpeelPauze = albumSpeelPauze
window.albumStop = albumStop
window.albumVorige = albumVorige
window.albumVolgende = albumVolgende
window.albumEerste = albumEerste
window.albumLaatste = albumLaatste
window.zoekInAlbumSpeler = zoekInAlbumSpeler
window.toggleDraaitafelZichtbaar = toggleDraaitafelZichtbaar

document.getElementById('draaitafel-toggle-btn').classList.toggle('actief', draaitafelZichtbaar)
bijwerkenDraaitafelTooltip()
document.getElementById('strobo-toggle-btn').classList.toggle('actief', stroboLichtVoorkeur)
bijwerkenStroboTooltip()
if (window.Turntable) window.Turntable.setStroboZichtbaar(stroboLichtVoorkeur)
// Data-i18n-title is bewust niet gebruikt op deze twee knoppen (zie bijwerkenStroboTooltip()/
// bijwerkenDraaitafelTooltip() hierboven) - deze listener herstelt de dynamische, staat-afhankelijke
// hovertekst na een taalwissel zelf.
document.addEventListener('taal-gewijzigd', () => {
  bijwerkenStroboTooltip()
  bijwerkenDraaitafelTooltip()
})

// Platenspeler vergroten/verkleinen - zelfde --platenspeler-schaal-mechanisme en gedeelde localStorage-
// sleutel als js/jukebox.js, zie de toelichting daar.
const PLATENSPELER_SCHAAL_KEY = 'musicwall-platenspeler-schaal'
function stelPlatenspelerSchaalIn(waarde) {
  const pct = Math.min(150, Math.max(50, parseInt(waarde, 10) || 100))
  document.documentElement.style.setProperty('--platenspeler-schaal', pct / 100)
  localStorage.setItem(PLATENSPELER_SCHAAL_KEY, String(pct))
  // Vult de custom-gestylede track (css/album-detail.css) tot aan de duim - zie de toelichting in
  // js/jukebox.js.
  if (platenspelerSchaalSlider) platenspelerSchaalSlider.style.setProperty('--platenspeler-schaal-fill', (pct - 50) + '%')
}
const opgeslagenPlatenspelerSchaal = parseInt(localStorage.getItem(PLATENSPELER_SCHAAL_KEY), 10) || 100
document.documentElement.style.setProperty('--platenspeler-schaal', opgeslagenPlatenspelerSchaal / 100)
const platenspelerSchaalSlider = document.getElementById('platenspeler-schaal-slider')
if (platenspelerSchaalSlider) {
  platenspelerSchaalSlider.value = opgeslagenPlatenspelerSchaal
  platenspelerSchaalSlider.style.setProperty('--platenspeler-schaal-fill', (opgeslagenPlatenspelerSchaal - 50) + '%')
}
window.stelPlatenspelerSchaalIn = stelPlatenspelerSchaalIn
