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
// START/STOP-knop op de platenspeler-tekening (2026-08-24) - géén simpele pauze-toggle: bij "speelt"
// een echte albumStop() (track + toonarm terug naar het begin, zelfde als de bestaande ⏹-knop), bij
// "staat stil" (gepauzeerd óf gestopt) albumSpeelPauze() (hervat, of herstart vanaf de eerste track
// als er geen huidige track meer is - dat onderscheid maakt albumSpeelPauze() zelf al, zie aldaar).
function albumStartStopKlik() {
  if (albumSpeler.paused) albumSpeelPauze()
  else albumStop()
}
if (window.Turntable) window.Turntable.onStartStopClick(albumStartStopKlik)

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

    // .title als DOM-property gezet (niet in de innerHTML-string) - de veilige weg voor een
    // tooltip-attribuut, zelfde patroon als js/jukebox.js's opgeslagen-playlist-namen. escapeHtml() is
    // bedoeld voor tekst-node-context (innerHTML hierboven) en escaped geen aanhalingstekens, dus zou
    // hier onveilig zijn als het rechtstreeks in een title="..."-string geplakt werd. Toont de volledige,
    // niet-afgekapte naam bij hover als de track-titel/artiest-tekst met ellipsis is afgekapt.
    rij.querySelector('.track-titel').title = track.titel
    rij.querySelector('.track-artiest').title = track.artiest || huidigAlbum.artiest || ''

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

// Ticker voor een te lange tracktitel/artiest (op gebruikersverzoek) - alleen toegepast op de daadwerkelijk
// spelende rij, en alleen als de tekst echt overloopt (anders blijft de normale ellipsis-weergave staan).
// marqueeElementen onthoudt welke .track-titel/.track-artiest-elementen momenteel gemarqueed zijn, zodat
// ruimMarqueeOp() ze terug kan zetten naar platte tekst zodra een andere track gaat spelen - bijwerkenSpeelUI()
// roept dit altijd als eerste aan, ook in het "niets speelt meer"-pad.
let marqueeElementen = []
const MARQUEE_SNELHEID_PX_PER_SEC = 40

function ruimMarqueeOp() {
  marqueeElementen.forEach(el => {
    el.textContent = el.dataset.marqueeOrigineel || ''
    el.classList.remove('marquee-actief')
    delete el.dataset.marqueeOrigineel
  })
  marqueeElementen = []
}

// Bouwt de ticker-structuur met DOM-methodes op (createElement/textContent), niet via een innerHTML-string
// - track-titels/artiesten komen uit ID3-tags (door de gebruiker geïmporteerde bestanden, dus niet volledig
// vertrouwd) en textContent-toekenning kan nooit HTML injecteren, in tegenstelling tot innerHTML-string-
// concatenatie (zie CLAUDE.md/de HTML-escaping-memory).
function pasMarqueeToeIndienNodig(el) {
  if (!el || el.scrollWidth <= el.clientWidth) return

  const tekst = el.textContent
  el.dataset.marqueeOrigineel = tekst
  el.textContent = ''

  const track = document.createElement('span')
  track.className = 'marquee-track'
  for (let i = 0; i < 2; i++) {
    const eenheid = document.createElement('span')
    eenheid.className = 'marquee-unit'
    if (i === 1) eenheid.setAttribute('aria-hidden', 'true')
    const tekstSpan = document.createElement('span')
    tekstSpan.textContent = tekst
    const gap = document.createElement('span')
    gap.className = 'marquee-gap'
    eenheid.appendChild(tekstSpan)
    eenheid.appendChild(gap)
    track.appendChild(eenheid)
  }
  el.appendChild(track)
  el.classList.add('marquee-actief')

  // Duur op basis van de gemeten breedte van één eenheid, voor een ongeveer constante scrolsnelheid
  // ongeacht hoe lang de tekst is (i.p.v. één vaste duur die bij een korte overloop te traag en bij een
  // lange titel te snel zou aanvoelen).
  const eenheidBreedte = track.scrollWidth / 2
  const duur = Math.max(4, eenheidBreedte / MARQUEE_SNELHEID_PX_PER_SEC)
  track.style.setProperty('--marquee-duur', duur + 's')
  if (albumSpeler.paused) track.style.animationPlayState = 'paused'

  marqueeElementen.push(el)
}

function bijwerkenSpeelUI() {
  document.querySelectorAll('.track-rij.speelt').forEach(el => el.classList.remove('speelt'))
  ruimMarqueeOp()

  const track = huidigSpeelTrackId !== null ? huidigeTrackLijst.find(t => t.id === huidigSpeelTrackId) : null

  if (!track) {
    bijwerkenTrackKnoppen()
    return
  }

  const rij = document.querySelector('.track-rij[data-track-id="' + track.id + '"]')
  // block:'nearest' (i.p.v. 'center') scrollt alleen als de rij niet al zichtbaar is - zelfde patroon als
  // de jukebox' eigen playlist-scroll. De tracklijst staat nu altijd naast de platenspeler (geen exclusief
  // óf-óf-gedrag meer), dus dit hoeft niet langer gescopeerd te worden tot een "tracklijst is zichtbaar"-check.
  if (rij) {
    rij.classList.add('speelt')
    rij.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    pasMarqueeToeIndienNodig(rij.querySelector('.track-titel'))
    pasMarqueeToeIndienNodig(rij.querySelector('.track-artiest'))
  }

  bijwerkenTrackKnoppen()
}

function huidigSpeelIndex() {
  return huidigeTrackLijst.findIndex(t => t.id === huidigSpeelTrackId)
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

  // #album-play-btn's icoon/actief-status wordt niet hier gezet, maar door de native 'play'/'pause'-
  // listeners op albumSpeler hieronder - dat gebeurt dan vanzelf pas zodra het geluid écht start (na de
  // needle-drop-animatie), i.p.v. optimistisch al bij het laden. bijwerkenTrackKnoppen() (het ▶/⏸-icoontje
  // ván de trackrij zelf) volgt dezelfde route via de 'play'-listener.
  const startAfspelen = () => {
    albumSpeler.src = 'file:///' + track.lokaal_pad.replace(/\\/g, '/')
    pasTempoRateToe()
    albumSpeler.play()
  }

  if (window.Turntable) {
    // Zelfde patroon als de jukebox (speelIndex() in js/jukebox.js): arm eerst instant naar rust, dan de
    // plaat wisselen (of laten liggen bij hetzelfde album - toonVinyl() herkent dat zelf via cover_pad) en
    // pas ná de needle-drop het geluid starten, zodat je nooit geluid hoort vóórdat de naald zichtbaar
    // landt. De platenspeler staat altijd naast de tracklijst (geen aan/uit-toggle meer), dus dit pad is
    // niet langer voorwaardelijk aan een gebruikersvoorkeur.
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

// Race-guard: zowel albumStop() (albumwissel tijdens het afspelen) als laadTrack() (track-navigatie
// bínnen een album, bv. via de vorige/volgende-knoppen of een andere track aanklikken) roepen
// resetVoortgangsUI() aan - maar een 'timeupdate'-event dat al vóór die aanroep in de event-wachtrij stond
// (het medium-element se eigen interne klok, niet synchroon met onze pause()/src-wijziging) kan daarna
// alsnog vuren met de oude currentTime/duration en de zojuist geresette voortgangsbalk terugzetten naar
// een niet-nul percentage - gemeld door de gebruiker, zowel bij bladeren tussen albums als tussen tracks
// binnen hetzelfde album. Bij track-navigatie is huidigSpeelTrackId op het moment van zo'n stale event
// echter al de NIEUWE track (niet null, zoals bij albumStop()) - een check daarop alleen dekt dat geval
// dus niet. albumSpeler.paused is de robuustere check: laadTrack() roept als allereerste stap
// albumSpeler.pause() aan (synchroon, vóór resetVoortgangsUI()), dus een event dat ná die pause() nog
// vuurt (stale of niet) ziet paused altijd als true totdat de needle-drop-animatie het echte afspelen
// weer start - in beide scenario's (albumwissel én tracknavigatie) is dat exact het venster waarin een
// stale event de reset zou kunnen overschrijven.
albumSpeler.addEventListener('timeupdate', () => {
  if (albumSpeler.paused || huidigSpeelTrackId === null) return
  const pct = albumSpeler.duration ? (albumSpeler.currentTime / albumSpeler.duration) * 100 : 0
  document.getElementById('album-progress-vulling').style.width = pct + '%'
  document.getElementById('album-tijd-huidig').textContent = formatTijd(albumSpeler.currentTime)
  if (window.Turntable) window.Turntable.bijwerken(albumSpeler.currentTime, albumSpeler.duration)
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
  marqueeElementen.forEach(el => {
    const t = el.querySelector('.marquee-track')
    if (t) t.style.animationPlayState = 'running'
  })
})
albumSpeler.addEventListener('pause', () => {
  document.getElementById('album-play-btn').textContent = '▶'
  document.getElementById('album-play-btn').classList.remove('speelt-actief')
  bijwerkenTrackKnoppen()
  marqueeElementen.forEach(el => {
    const t = el.querySelector('.marquee-track')
    if (t) t.style.animationPlayState = 'paused'
  })
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
    if (window.Turntable) {
      window.Turntable.start(() => albumSpeler.play())
    } else {
      albumSpeler.play()
    }
  } else {
    albumSpeler.pause()
    // Pauzeren tilt alleen de arm - de plaat blijft liggen (zelfde gedrag als de jukebox, zie
    // js/turntable.js's stop()/verbergVinyl()-onderscheid)
    if (window.Turntable) window.Turntable.stop()
  }
}

function albumStop() {
  albumSpeler.pause()
  albumSpeler.removeAttribute('src')
  if (window.Turntable) {
    window.Turntable.stop()
    window.Turntable.verbergVinyl()
  }
  huidigSpeelTrackId = null
  resetVoortgangsUI()
  bijwerkenSpeelUI()
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

// Ruim langer dan ARM_DROP_DUUR in js/turntable.js (1.6s) - zelfde constante/redenering als
// TONEARM_LIFT_MS in js/jukebox.js (zie aldaar): marge zodat de til-naar-rust-animatie écht klaar is,
// plus een bewuste extra rustpauze bovenop (2026-08-30, "kan daar nog een pauze tussen" - zonder pauze
// ging het na het bereiken van rust meteen door naar de needle-drop van het volgende nummer, wat te
// gehaast aanvoelde).
const ARM_LIFT_PAUZE_MS = 2100

// Zelfde patroon als js/jukebox.js's afgespeeldGaVerder(): vóór het volgende nummer laadt (of, bij de
// laatste track, vóór albumStop() de arm optilt) glijdt de naald eerst nog zichtbaar van de laatste groef
// naar de uitloop (naarUitloop(), zie js/turntable.js) - net als een echte plaat die uitspeelt. Daarna
// tilt de arm zichtbaar terug naar rust en wacht ARM_LIFT_PAUZE_MS vóórdat het volgende nummer laadt -
// zonder die twee tussenstappen zou laadTrack()'s eigen stop()+reset()-combo (instant, geen tween) de arm
// meteen terugzetten en direct doorschieten naar de volgende needle-drop, zonder dat er iets van de
// uitloop/til-beweging te zien was.
albumSpeler.addEventListener('ended', () => {
  const i = huidigSpeelIndex()
  const doorgaan = () => {
    if (i !== -1 && i < huidigeTrackLijst.length - 1) {
      albumVolgende()
    } else {
      // Laatste track van het album afgespeeld: albumStop() tilt de toonarm terug naar rust en haalt de
      // plaat weg - zonder deze aanroep bleef de naald op de bij het einde horende hoek hangen, want er
      // komt na 'ended' geen timeupdate meer die bijwerken() opnieuw zou aanroepen.
      albumStop()
    }
  }
  if (window.Turntable) {
    window.Turntable.naarUitloop(() => {
      window.Turntable.stop()
      setTimeout(doorgaan, ARM_LIFT_PAUZE_MS)
    })
  } else {
    doorgaan()
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

document.getElementById('strobo-toggle-btn').classList.toggle('actief', stroboLichtVoorkeur)
bijwerkenStroboTooltip()
if (window.Turntable) window.Turntable.setStroboZichtbaar(stroboLichtVoorkeur)
// Data-i18n-title is bewust niet gebruikt op deze knop (zie bijwerkenStroboTooltip() hierboven) - deze
// listener herstelt de dynamische, staat-afhankelijke hovertekst na een taalwissel zelf.
document.addEventListener('taal-gewijzigd', () => {
  bijwerkenStroboTooltip()
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
