const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getPlaylist, voegToeAanPlaylist, verwijderUitPlaylist, leegPlaylist, herschikPlaylist } = require('./db/playlist.js')
const { zoekBibliotheek } = require('./db/zoeken.js')
const { getOpgeslagenPlaylists, laadOpgeslagenPlaylist, verwijderOpgeslagenPlaylist } = require('./db/opgeslagenPlaylists.js')
const { registreerAfspeling, getMeestGespeeld } = require('./db/afspeelstatistieken.js')

let playlist = []
let huidigeIndex = -1
let stopOpruimTimer = null
let afgespeeldVertragingTimer = null

// Iets langer dan ARM_DROP_DUUR in js/turntable.js (1.3s) - genoeg marge zodat de tonearm-lift-animatie
// écht klaar is voordat de opruiming (stop()) resp. het volgende nummer (afgespeeldGaVerder()) start.
const TONEARM_LIFT_MS = 1400

const AUDIO_EXTENSIES = ['.mp3', '.m4a', '.flac', '.wav']
function isAudioBestand(pad) {
  if (!pad) return false
  const punt = pad.lastIndexOf('.')
  if (punt === -1) return false
  return AUDIO_EXTENSIES.includes(pad.slice(punt).toLowerCase())
}

let bibliotheekResultaten = []
let bibliotheekResultatenRuw = []
let bibliotheekTypeFilter = 'alle'
let bibliotheekSelectie = new Set()
let bibliotheekZoekGeneratie = 0

let ytFrameReady = false
let ytPendingVideoId = null
let ytIsPlaying = false

function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

function stuurNaarYtFrame(bericht) {
  const frame = document.getElementById('youtube-speler-frame')
  if (frame && frame.contentWindow) frame.contentWindow.postMessage(bericht, '*')
}

// Spectrum-analyzer: retro LED-balkjes die meebewegen met de muziek, geïnspireerd op de equalizer-displays
// van moderne jukeboxen. Voor lokale video's echt audio-reactief via de Web Audio API (AnalyserNode op de
// <video>). Voor YouTube-nummers is dat NIET mogelijk: het YouTube IFrame-element draait in een cross-origin
// iframe (yt-embed.html, geserveerd door de lokale jukebox-server) en de Web Audio API kan geen audiodata
// uitlezen uit een cross-origin <video>/<iframe> - de browser blokkeert dat net als bij canvas-pixels van een
// cross-origin afbeelding. Daarom krijgt YouTube-afspelen een gesimuleerde, vloeiend bewegende uitslag
// (random-walk met demping) i.p.v. een dode balk - geen "echte" data, maar wel levendig, wat dichter bij het
// oorspronkelijke jukebox-gevoel ligt dan een bevroren display.
const SPECTRUM_BALKEN = 28
const SPECTRUM_PIEK_VAL_PER_FRAME = 1.8
// ~30fps i.p.v. de volle 60fps van requestAnimationFrame - ruim genoeg voor een vloeiend ogende equalizer,
// maar halveert de hoeveelheid stijl-writes/repaints per seconde op de hoofdthread. Nodig voor lokale video's,
// die deze hoofdthread rechtstreeks delen met de videodecodering.
const SPECTRUM_INTERVAL_MS = 33
// Voor YouTube nóg lager (~15fps): in de praktijk blijkt een YouTube-nummer NIET in een eigen OS-proces te
// draaien zoals eerder aangenomen - jukebox.html draait met nodeIntegration: true, en Electron zet cross-origin
// iframes dan niet als out-of-process iframe (OOPIF) op, dus yt-embed.html deelt gewoon dezelfde renderer-
// hoofdthread. Gebruikersrapport (met VPN uit, dus geen netwerkoorzaak) bevestigde dit: YouTube-afspelen
// hapert merkbaar met de analyzer aan, en loopt vloeiend zodra hij uitstaat. Omdat de YouTube-balk toch al een
// simulatie is (geen echte audiodata), gaat een lagere update-frequentie niet ten koste van waargenomen kwaliteit.
const SPECTRUM_INTERVAL_MS_YOUTUBE = 66
let audioCtx = null
let analyser = null
let analyserData = null
let spectrumActief = false
let spectrumFrameId = null
let spectrumLaatsteUpdate = 0
let spectrumVullingen = []
let spectrumPieken = []
let ytSimWaarden = new Array(SPECTRUM_BALKEN).fill(0)
let spectrumPiekWaarden = new Array(SPECTRUM_BALKEN).fill(0)
let spectrumZichtbaar = localStorage.getItem('musicwall-spectrum-zichtbaar') !== 'nee'
// Stroboscoop-gloed aan/uit (js/turntable.js's setStroboZichtbaar()) - decoratieve toggle, zelfde
// localStorage-precedent als spectrumZichtbaar hierboven, gedeelde sleutel met album-detail.
let stroboLichtVoorkeur = localStorage.getItem('musicwall-strobo-zichtbaar') !== 'nee'
// Hovertekst beschrijft steeds de actie die een klik nu zou uitvoeren (dus het omgekeerde van de huidige
// staat), niet de statische "tonen/verbergen"-tekst van voorheen - herbruikt bij taalwissel via de
// 'taal-gewijzigd'-listener onderaan dit blok, want data-i18n-title zou anders bij elke taalwissel de
// dynamische tekst overschrijven met een vaste vertaalsleutel.
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
document.getElementById('strobo-toggle-btn').classList.toggle('actief', stroboLichtVoorkeur)
bijwerkenStroboTooltip()
if (window.Turntable) window.Turntable.setStroboZichtbaar(stroboLichtVoorkeur)

// Echte TEMPO-fader (2026-08-24): js/turntable.js weet niets van #speler, dus zet playbackRate hier
// zelf op basis van het percentage dat de fader doorgeeft. pasTempoRateToe() wordt daarnaast ook
// expliciet aangeroepen vlak ná elke speler.src=... in speelIndex() (zie aldaar), zodat het gekozen
// tempo blijft gelden bij het wisselen van nummer i.p.v. terug te vallen op 1.0.
function pasTempoRateToe() {
  const speler = document.getElementById('speler')
  if (!speler || !window.Turntable) return
  speler.playbackRate = 1 + window.Turntable.getTempoPercent() / 100
}
if (window.Turntable) window.Turntable.onTempoChange(pasTempoRateToe)

// Versterkt het contrast tussen stil en luid (exponent > 1 duwt lage waarden verder omlaag terwijl hoge
// waarden relatief hoog blijven) - zonder deze curve oogde de analyzer vlak/gedempt, met een grillige
// live-uitslag waarbij stille stukken merkbaar sneller wegzakken en pieken duidelijker uitschieten
function versterk(pct) {
  const genormaliseerd = Math.min(100, Math.max(0, pct)) / 100
  return Math.pow(genormaliseerd, 1.5) * 100
}

// Elementreferenties worden hier eenmalig bewaard (spectrumVullingen/spectrumPieken) i.p.v. elke tick
// opnieuw document.querySelectorAll() aan te roepen - die set verandert toch nooit na het opbouwen
function bouwSpectrumAnalyzer() {
  const container = document.getElementById('spectrum-analyzer')
  for (let i = 0; i < SPECTRUM_BALKEN; i++) {
    const balk = document.createElement('div')
    balk.className = 'spectrum-bar'
    const vulling = document.createElement('div')
    vulling.className = 'spectrum-fill'
    const piek = document.createElement('div')
    piek.className = 'spectrum-peak'
    balk.appendChild(vulling)
    balk.appendChild(piek)
    container.appendChild(balk)
    spectrumVullingen.push(vulling)
    spectrumPieken.push(piek)
  }
  if (!spectrumZichtbaar) container.classList.add('verborgen')
}

// Lazy + eenmalig: createMediaElementSource() gooit een InvalidStateError als je 'm twee keer op hetzelfde
// <video>-element aanroept, dus dit mag nooit opnieuw draaien voor eenzelfde pagina-sessie. AudioContext
// vereist bovendien een user-gesture om niet in 'suspended' te blijven hangen - deze functie wordt daarom pas
// aangeroepen vanuit de eerste echte 'play' op #speler, nooit al bij het laden van de pagina.
function initLokaleAnalyser() {
  if (audioCtx) return
  try {
    const speler = document.getElementById('speler')
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const bron = audioCtx.createMediaElementSource(speler)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.6
    bron.connect(analyser)
    analyser.connect(audioCtx.destination)
    analyserData = new Uint8Array(analyser.frequencyBinCount)
  } catch (e) {
    // Web Audio API-opzet mag nooit het afspelen zelf breken - spectrumTick() valt terug op een lege
    // (platte) balk zolang analyser null blijft
    console.warn('Spectrum-analyzer kon niet starten:', e.message)
  }
}

function spectrumTick(tijdstip) {
  if (!spectrumActief) return
  // Eerst de volgende frame al inplannen, ongeacht of dit tick'je zelf werk doet - anders stopt de hele
  // lus zodra er één keer geskipt wordt door de throttle hieronder
  spectrumFrameId = requestAnimationFrame(spectrumTick)

  const item = playlist[huidigeIndex]
  const interval = (item && item.type === 'youtube') ? SPECTRUM_INTERVAL_MS_YOUTUBE : SPECTRUM_INTERVAL_MS
  if (tijdstip - spectrumLaatsteUpdate < interval) return
  spectrumLaatsteUpdate = tijdstip

  let waarden

  if (item && item.type === 'youtube') {
    // Asymmetrische attack/release (snel omhoog, trager omlaag) i.p.v. een symmetrische interpolatie -
    // een echte VU-meter springt snel naar een piek en zakt daarna langzamer terug, dat "punchy" gevoel
    // ontbrak met een vaste factor in beide richtingen
    waarden = ytSimWaarden.map(v => {
      const doel = Math.random() * 100
      const factor = doel > v ? 0.5 : 0.15
      return v + (doel - v) * factor
    })
    ytSimWaarden = waarden
  } else if (analyser) {
    analyser.getByteFrequencyData(analyserData)
    const perBalk = Math.max(1, Math.floor(analyserData.length / SPECTRUM_BALKEN))
    waarden = []
    for (let i = 0; i < SPECTRUM_BALKEN; i++) {
      let som = 0
      for (let j = 0; j < perBalk; j++) som += analyserData[i * perBalk + j] || 0
      waarden.push((som / perBalk / 255) * 100)
    }
  } else {
    waarden = new Array(SPECTRUM_BALKEN).fill(0)
  }

  waarden.forEach((ruw, i) => {
    const pct = versterk(ruw)
    if (spectrumVullingen[i]) spectrumVullingen[i].style.clipPath = 'inset(' + (100 - pct) + '% 0 0 0)'

    // Peak-hold: springt meteen mee omhoog met een nieuwe piek, zakt daarna in vaste kleine stapjes per
    // update terug omlaag (losstaand van de vulling zelf, die door versterk()/smoothing al sneller daalt)
    if (pct >= spectrumPiekWaarden[i]) {
      spectrumPiekWaarden[i] = pct
    } else {
      spectrumPiekWaarden[i] = Math.max(0, spectrumPiekWaarden[i] - SPECTRUM_PIEK_VAL_PER_FRAME)
    }
    if (spectrumPieken[i]) spectrumPieken[i].style.bottom = spectrumPiekWaarden[i] + '%'
  })
}

function startSpectrum() {
  if (spectrumActief || !spectrumZichtbaar) return
  spectrumActief = true
  // spectrumLaatsteUpdate op 0 -> het verschil met de eerste (hoge) rAF-tijdstip is sowieso groter dan
  // SPECTRUM_INTERVAL_MS, dus de allereerste tick rendert altijd meteen i.p.v. eerst 33ms te wachten.
  // Bewust via requestAnimationFrame(spectrumTick) i.p.v. spectrumTick() direct aanroepen, zodat 'tijdstip'
  // altijd een echt getal is - een handmatige aanroep zonder argument zou 'tijdstip' op undefined zetten,
  // wat de throttle-vergelijking hierboven (NaN < ...) altijd false maakt en zo de throttle omzeilt
  spectrumLaatsteUpdate = 0
  spectrumFrameId = requestAnimationFrame(spectrumTick)
}

function stopSpectrum() {
  spectrumActief = false
  if (spectrumFrameId) cancelAnimationFrame(spectrumFrameId)
  ytSimWaarden = new Array(SPECTRUM_BALKEN).fill(0)
  spectrumPiekWaarden = new Array(SPECTRUM_BALKEN).fill(0)
  spectrumVullingen.forEach(vulling => {
    vulling.style.clipPath = 'inset(100% 0 0 0)'
  })
  spectrumPieken.forEach(piek => {
    piek.style.bottom = '0%'
  })
}

function bijwerkenSpectrumTooltip() {
  document.getElementById('spectrum-toggle-btn').title = t(spectrumZichtbaar ? 'jukebox.spectrumTooltipVerberg' : 'jukebox.spectrumTooltipToon')
}
function toggleSpectrumZichtbaar() {
  spectrumZichtbaar = !spectrumZichtbaar
  localStorage.setItem('musicwall-spectrum-zichtbaar', spectrumZichtbaar ? 'ja' : 'nee')

  const container = document.getElementById('spectrum-analyzer')
  container.classList.toggle('verborgen', !spectrumZichtbaar)
  document.getElementById('spectrum-toggle-btn').classList.toggle('actief', spectrumZichtbaar)
  bijwerkenSpectrumTooltip()

  if (spectrumZichtbaar) {
    // Alleen herstarten als er op dit moment ook echt iets speelt - anders zou de analyzer een lege,
    // stilstaande balk tonen totdat de volgende 'play'/'playing' toch al opnieuw startSpectrum() aanroept
    const item = playlist[huidigeIndex]
    const speler = document.getElementById('speler')
    if ((item && item.type === 'youtube' && ytIsPlaying) || (item && item.type !== 'youtube' && !speler.paused)) {
      startSpectrum()
    }
  } else {
    stopSpectrum()
  }
}

bouwSpectrumAnalyzer()
document.getElementById('spectrum-toggle-btn').classList.toggle('actief', spectrumZichtbaar)
bijwerkenSpectrumTooltip()
// Data-i18n-title is bewust niet gebruikt op strobo-/spectrum-toggle-btn (zie bijwerkenStroboTooltip()) - deze
// listener herstelt de dynamische, staat-afhankelijke hovertekst na een taalwissel zelf.
document.addEventListener('taal-gewijzigd', () => {
  bijwerkenStroboTooltip()
  bijwerkenSpectrumTooltip()
})

// Platenspeler vergroten/verkleinen (schuifje in .audio-cover-wrap): --platenspeler-schaal
// vermenigvuldigt #turntable-svg-wrap's bestaande vh-gebaseerde breedte (css/jukebox.css). Gedeelde
// localStorage-sleutel met album-detail.js (js/album-detail.js) - elk venster leest 'm alleen bij
// het laden, geen live sync tussen open vensters nodig (net als musicwall-thema e.d.).
const PLATENSPELER_SCHAAL_KEY = 'musicwall-platenspeler-schaal'
function stelPlatenspelerSchaalIn(waarde) {
  const pct = Math.min(150, Math.max(50, parseInt(waarde, 10) || 100))
  document.documentElement.style.setProperty('--platenspeler-schaal', pct / 100)
  localStorage.setItem(PLATENSPELER_SCHAAL_KEY, String(pct))
  // Vult de custom-gestylede track (css/jukebox.css) tot aan de duim - het schuifje loopt van 50 tot
  // 150, dus pct-50 valt direct samen met het gevulde percentage van die reeks.
  if (platenspelerSchaalSlider) platenspelerSchaalSlider.style.setProperty('--platenspeler-schaal-fill', (pct - 50) + '%')
}
const opgeslagenPlatenspelerSchaal = parseInt(localStorage.getItem(PLATENSPELER_SCHAAL_KEY), 10) || 100
document.documentElement.style.setProperty('--platenspeler-schaal', opgeslagenPlatenspelerSchaal / 100)
const platenspelerSchaalSlider = document.getElementById('platenspeler-schaal-slider')
if (platenspelerSchaalSlider) {
  platenspelerSchaalSlider.value = opgeslagenPlatenspelerSchaal
  platenspelerSchaalSlider.style.setProperty('--platenspeler-schaal-fill', (opgeslagenPlatenspelerSchaal - 50) + '%')
}

// Deze twee listeners regelen alleen nog de spectrum-analyzer/audiocontext - beide moeten reageren op écht
// elke afspeelstart/-pauze, ongeacht wie die veroorzaakte (speelIndex(), speelPauze(), de native <video
// controls>, of het uitspelen van het bestand zelf). Turntable.start()/stop() liepen hier vroeger ook
// doorheen, maar zijn eruit gehaald: DOM play/pause-events vuren asynchroon, dus een generieke listener kon
// een net-door-de-app-zelf-gestarte, callback-dragende needle-drop-tween ongemerkt kapen (zie git-historie/
// eerdere CLAUDE.md-versie van deze sectie voor de bugreeks die dat veroorzaakte - o.a. "vorige/volgende
// laat het nummer soms stil aan het begin staan"). Turntable.start()/stop() worden nu uitsluitend nog
// expliciet aangeroepen vanuit speelIndex(), speelPauze() en stop() zelf - telkens precies één keer per
// echte afspeel-transitie, nooit via een event-listener die met die aanroepen kan interfereren.
document.getElementById('speler').addEventListener('play', () => {
  initLokaleAnalyser()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  startSpectrum()
})
document.getElementById('speler').addEventListener('pause', () => {
  stopSpectrum()
})

function formatTijd(seconden) {
  if (!isFinite(seconden) || seconden < 0) seconden = 0
  const m = Math.floor(seconden / 60)
  const s = Math.floor(seconden % 60)
  return m + ':' + String(s).padStart(2, '0')
}

// eigen voortgangsbalk (incl. verstreken tijd/lengte) voor audio-only lokale bestanden - #speler's eigen
// native controls zijn dan onzichtbaar (zie speelIndex(), .zichtbaar staat uit ten gunste van de albumhoes),
// dus zonder dit zou er tijdens mp3-afspelen geen enkele voortgangsindicatie meer te zien zijn
document.getElementById('speler').addEventListener('timeupdate', () => {
  if (!document.getElementById('audio-cover-wrap').classList.contains('zichtbaar')) return
  const speler = document.getElementById('speler')
  const pct = speler.duration ? (speler.currentTime / speler.duration) * 100 : 0
  document.getElementById('audio-progress-vulling').style.width = pct + '%'
  document.getElementById('audio-tijd-huidig').textContent = formatTijd(speler.currentTime)
  if (window.Turntable) window.Turntable.bijwerken(speler.currentTime, speler.duration)
})

document.getElementById('speler').addEventListener('loadedmetadata', () => {
  if (!document.getElementById('audio-cover-wrap').classList.contains('zichtbaar')) return
  document.getElementById('audio-tijd-duur').textContent = formatTijd(document.getElementById('speler').duration)
})

function zoekInAudio(event) {
  const speler = document.getElementById('speler')
  if (!speler.duration) return
  const balk = document.getElementById('audio-progress-balk')
  const rect = balk.getBoundingClientRect()
  const fractie = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  speler.currentTime = fractie * speler.duration
}

ipcRenderer.invoke('get-jukebox-server-poort').then(poort => {
  document.getElementById('youtube-speler-frame').src = 'http://127.0.0.1:' + poort + '/yt-embed.html'
})

ipcRenderer.on('playlist-bijgewerkt', laadPlaylist)

ipcRenderer.on('playlist-opgeslagen', (event, { naam, overgeslagen }) => {
  toonFoutMelding(overgeslagen > 0
    ? t('jukebox.playlistOpgeslagenMetOvergeslagen', { naam, n: overgeslagen })
    : t('jukebox.playlistOpgeslagen', { naam }))

  if (document.getElementById('opgeslagen-playlists').style.display !== 'none') {
    renderOpgeslagenPlaylists()
  }
})

window.addEventListener('message', (event) => {
  const { type, code } = event.data || {}

  if (type === 'ready') {
    ytFrameReady = true
    if (ytPendingVideoId) {
      stuurNaarYtFrame({ actie: 'laad', videoId: ytPendingVideoId })
      ytPendingVideoId = null
    }
  } else if (type === 'playing') {
    ytIsPlaying = true
    document.getElementById('play-btn').textContent = '⏸'
    startSpectrum()
  } else if (type === 'paused') {
    ytIsPlaying = false
    document.getElementById('play-btn').textContent = '▶'
    stopSpectrum()
  } else if (type === 'ended') {
    stopSpectrum()
    registreerHuidigeAfspeling()
    afgespeeldGaVerder()
  } else if (type === 'error') {
    console.warn('YouTube speler kon nummer niet afspelen:', code)
    stopSpectrum()
    foutGaVerder()
  }
})

// Hardware media-toetsen (2026-08-24, systeembreed via globalShortcut in main.js, alleen actief zolang
// dit jukebox-venster open is - zie main.js's open-jukebox-handler). Gaat via IPC i.p.v. main.js
// rechtstreeks executeJavaScript() te laten aanroepen, consistent met hoe andere main->renderer-
// commando's in dit project (bv. thema-toegepast) al werken.
ipcRenderer.on('mediatoets', (event, actie) => {
  if (actie === 'afspelen-pauzeren') speelPauze()
  else if (actie === 'volgende') volgende()
  else if (actie === 'vorige') vorige()
})

async function laadPlaylist() {
  playlist = getPlaylist()
  const lijst = document.getElementById('playlist-lijst')

  if (playlist.length === 0) {
    lijst.innerHTML = '<div class="playlist-leeg">' + t('jukebox.leegLijst') + '</div>'
    return
  }

  lijst.innerHTML = ''

  for (let i = 0; i < playlist.length; i++) {
    const item = playlist[i]
    let thumb = ''
    const bronLabel = '<div class="playlist-bron ' + (item.type === 'youtube' ? 'youtube' : 'lokaal') + '">'
      + t(item.type === 'youtube' ? 'video.bron.youtube' : 'video.bron.lokaal') + '</div>'

    if (item.type === 'youtube') {
      const id = getYoutubeId(item.youtube_url)
      if (id) thumb = 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg'
    } else if (item.cover_pad) {
      // albumtrack: hoesafbeelding rechtstreeks tonen, geen ffmpeg-frame-grab proberen op een audio-only bestand
      thumb = 'file:///' + item.cover_pad.replace(/\\/g, '/')
    } else if (item.lokaal_pad) {
      const pad = await ipcRenderer.invoke('maak-thumbnail', item.lokaal_pad)
      if (pad) thumb = 'file:///' + pad.replace(/\\/g, '/')
    }

    const el = document.createElement('div')
    el.className = 'playlist-item' + (i === huidigeIndex ? ' actief' : '')
    el.innerHTML = '<div class="playlist-thumb-wrap">'
      + (thumb ? '<img src="' + thumb + '">' : '<div style="width:100%;aspect-ratio:16/9;background:#1a1a1a;border-radius:2px;flex-shrink:0"></div>')
      + bronLabel
      + '</div>'
      + '<div class="playlist-info">'
      + '<div class="playlist-artiest">' + escapeHtml(item.artiest || '') + '</div>'
      + '<div class="playlist-titel">' + escapeHtml(item.titel) + '</div>'
      + '</div>'
      + '<button class="playlist-verwijder" onclick="event.stopPropagation();verwijderItem(' + item.playlist_id + ')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>'
      + '</button>'
    el.onclick = () => speelIndex(i)
    lijst.appendChild(el)

    // zonder dit blijft het spelende nummer bij navigeren (vorige/volgende/eerste/laatste) buiten beeld
    // zodra de playlist lang genoeg is om te scrollen - zelfde scrollIntoView-patroon als album-detail.js
    if (i === huidigeIndex) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }
}

function bibliotheekSleutel(resultaat) {
  return resultaat.soort + '|' + (resultaat.lokaalPad || resultaat.youtubeUrl)
}

function zoekBibliotheekLive() {
  const term = document.getElementById('bibliotheek-zoekveld').value.trim()
  const playlistEl = document.getElementById('playlist-lijst')
  const resultatenEl = document.getElementById('bibliotheek-resultaten')
  const generatie = ++bibliotheekZoekGeneratie

  if (!term) {
    resultatenEl.style.display = 'none'
    resultatenEl.innerHTML = ''
    playlistEl.style.display = ''
    bibliotheekResultatenRuw = []
    bibliotheekResultaten = []
    bibliotheekSelectie.clear()
    updateBibliotheekSelectieInfo()
    return
  }

  bibliotheekResultatenRuw = zoekBibliotheek(term)
  pasBibliotheekTypeFilterToe()
  playlistEl.style.display = 'none'
  resultatenEl.style.display = ''
  renderBibliotheekResultaten(generatie)
}

function bibliotheekMediaSoort(resultaat) {
  if (resultaat.soort === 'youtube') return 'youtube'
  return resultaat.bron === 'album' ? 'muziek' : 'video'
}

function pasBibliotheekTypeFilterToe() {
  bibliotheekResultaten = bibliotheekTypeFilter === 'alle'
    ? bibliotheekResultatenRuw
    : bibliotheekResultatenRuw.filter(r => bibliotheekMediaSoort(r) === bibliotheekTypeFilter)
}

function stelBibliotheekTypeFilter(type) {
  bibliotheekTypeFilter = type
  pasBibliotheekTypeFilterToe()
  const generatie = ++bibliotheekZoekGeneratie
  renderBibliotheekResultaten(generatie)
}

function bouwBibliotheekTypeFilterHtml() {
  return '<div class="bibliotheek-type-filter">'
    + '<button class="bibliotheek-filter-btn' + (bibliotheekTypeFilter === 'alle' ? ' actief' : '') + '" onclick="stelBibliotheekTypeFilter(\'alle\')">' + t('zoeken.filterAlle') + '</button>'
    + '<button class="bibliotheek-filter-btn' + (bibliotheekTypeFilter === 'youtube' ? ' actief' : '') + '" onclick="stelBibliotheekTypeFilter(\'youtube\')">' + t('video.bron.youtube') + '</button>'
    + '<button class="bibliotheek-filter-btn' + (bibliotheekTypeFilter === 'video' ? ' actief' : '') + '" onclick="stelBibliotheekTypeFilter(\'video\')">' + t('zoeken.filterVideo') + '</button>'
    + '<button class="bibliotheek-filter-btn' + (bibliotheekTypeFilter === 'muziek' ? ' actief' : '') + '" onclick="stelBibliotheekTypeFilter(\'muziek\')">' + t('zoeken.filterMuziek') + '</button>'
    + '</div>'
}

async function renderBibliotheekResultaten(generatie) {
  const resultatenEl = document.getElementById('bibliotheek-resultaten')

  if (bibliotheekResultatenRuw.length === 0) {
    resultatenEl.innerHTML = '<div class="playlist-leeg">' + t('zoeken.geenResultaten') + '</div>'
    return
  }

  resultatenEl.innerHTML = '<div class="bibliotheek-resultaten-balk">'
    + '<button class="selecteer-alles-btn" onclick="toggleSelecteerAlleBibliotheekResultaten()">' + t('zoeken.selecteerAlles') + '</button>'
    + bouwBibliotheekTypeFilterHtml()
    + '</div>'

  if (bibliotheekResultaten.length === 0) {
    resultatenEl.innerHTML += '<div class="playlist-leeg">' + t('zoeken.geenResultaten') + '</div>'
    return
  }

  for (const resultaat of bibliotheekResultaten) {
    if (generatie !== bibliotheekZoekGeneratie) return
    const sleutel = bibliotheekSleutel(resultaat)
    const herkomstLabel = resultaat.bron === 'concert'
      ? t('jukebox.herkomstConcert', { naam: resultaat.herkomst })
      : resultaat.bron === 'album'
        ? t('jukebox.herkomstAlbum', { naam: resultaat.herkomst })
        : t('jukebox.herkomstWall', { naam: resultaat.herkomst })
    const bronLabel = '<div class="playlist-bron ' + resultaat.soort + '">'
      + t(resultaat.soort === 'youtube' ? 'video.bron.youtube' : 'video.bron.lokaal') + '</div>'

    let thumb = ''
    if (resultaat.soort === 'youtube') {
      const id = getYoutubeId(resultaat.youtubeUrl)
      if (id) thumb = 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg'
    } else if (resultaat.coverPad) {
      thumb = 'file:///' + resultaat.coverPad.replace(/\\/g, '/')
    } else if (resultaat.lokaalPad) {
      const pad = await ipcRenderer.invoke('maak-thumbnail', resultaat.lokaalPad)
      if (pad) thumb = 'file:///' + pad.replace(/\\/g, '/')
    }

    const el = document.createElement('div')
    el.className = 'playlist-item bibliotheek-resultaat' + (bibliotheekSelectie.has(sleutel) ? ' geselecteerd' : '')
    el.innerHTML = '<div class="playlist-thumb-wrap">'
      + (thumb ? '<img src="' + thumb + '">' : '<div style="width:100%;aspect-ratio:16/9;background:#1a1a1a;border-radius:2px;flex-shrink:0"></div>')
      + bronLabel
      + '</div>'
      + '<div class="playlist-info">'
      + '<div class="playlist-artiest">' + escapeHtml(resultaat.artiest || '') + '</div>'
      + '<div class="playlist-titel">' + escapeHtml(resultaat.titel) + '</div>'
      + '<div class="bibliotheek-herkomst">' + herkomstLabel + '</div>'
      + '</div>'
    el.onclick = () => toggleBibliotheekResultaat(sleutel, el)
    resultatenEl.appendChild(el)
  }
}

function toggleBibliotheekResultaat(sleutel, el) {
  if (bibliotheekSelectie.has(sleutel)) {
    bibliotheekSelectie.delete(sleutel)
    el.classList.remove('geselecteerd')
  } else {
    bibliotheekSelectie.add(sleutel)
    el.classList.add('geselecteerd')
  }
  updateBibliotheekSelectieInfo()
}

function toggleSelecteerAlleBibliotheekResultaten() {
  if (bibliotheekResultaten.length === 0) return

  const sleutels = bibliotheekResultaten.map(bibliotheekSleutel)
  const alleGeselecteerd = sleutels.every(s => bibliotheekSelectie.has(s))

  sleutels.forEach(s => {
    if (alleGeselecteerd) bibliotheekSelectie.delete(s)
    else bibliotheekSelectie.add(s)
  })

  document.querySelectorAll('.bibliotheek-resultaat').forEach((el, i) => {
    el.classList.toggle('geselecteerd', bibliotheekSelectie.has(sleutels[i]))
  })

  updateBibliotheekSelectieInfo()
}

function updateBibliotheekSelectieInfo() {
  const info = document.getElementById('bibliotheek-selectie-info')
  const tekst = document.getElementById('bibliotheek-selectie-tekst')

  if (bibliotheekSelectie.size === 0) {
    info.classList.remove('zichtbaar')
  } else {
    info.classList.add('zichtbaar')
    tekst.textContent = t('selectie.tekst', { n: bibliotheekSelectie.size })
  }
}

function voegBibliotheekSelectieToe() {
  if (bibliotheekSelectie.size === 0) return

  bibliotheekResultatenRuw
    .filter(r => bibliotheekSelectie.has(bibliotheekSleutel(r)))
    .forEach(r => voegToeAanPlaylist({ type: r.soort, lokaalPad: r.lokaalPad, youtubeUrl: r.youtubeUrl, artiest: r.artiest, titel: r.titel, coverPad: r.coverPad }))

  bibliotheekSelectie.clear()
  document.getElementById('bibliotheek-zoekveld').value = ''
  zoekBibliotheekLive()
  laadPlaylist()
}

function verwijderItem(playlistId) {
  const verwijderdIndex = playlist.findIndex(p => p.playlist_id === playlistId)
  verwijderUitPlaylist(playlistId)

  if (verwijderdIndex === huidigeIndex) {
    huidigeIndex = -1
    stop()
  } else if (verwijderdIndex >= 0 && verwijderdIndex < huidigeIndex) {
    huidigeIndex -= 1
  }

  laadPlaylist()
}

function leegMaken() {
  leegPlaylist()
  huidigeIndex = -1
  stop()
  laadPlaylist()
}

function openOpslaanPlaylist() {
  ipcRenderer.send('open-opslaan-playlist')
}

function toonOpgeslagenPlaylists() {
  document.getElementById('playlist-lijst').style.display = 'none'
  document.getElementById('bibliotheek-resultaten').style.display = 'none'
  document.getElementById('meest-gespeeld').style.display = 'none'
  document.getElementById('opgeslagen-playlists').style.display = ''
  renderOpgeslagenPlaylists()
}

function sluitOpgeslagenPlaylists() {
  document.getElementById('opgeslagen-playlists').style.display = 'none'
  document.getElementById('playlist-lijst').style.display = ''
}

function renderOpgeslagenPlaylists() {
  const lijst = document.getElementById('opgeslagen-playlists-lijst')
  const playlists = getOpgeslagenPlaylists()

  if (playlists.length === 0) {
    lijst.innerHTML = '<div class="playlist-leeg">' + t('jukebox.geenOpgeslagenPlaylists') + '</div>'
    return
  }

  lijst.innerHTML = ''
  playlists.forEach(p => {
    const el = document.createElement('div')
    el.className = 'opgeslagen-playlist-item'
    el.innerHTML = '<div class="opgeslagen-playlist-info">'
      + '<div class="opgeslagen-playlist-naam">' + p.naam + '</div>'
      + '<div class="opgeslagen-playlist-aantal">' + t('jukebox.aantalNummers', { n: p.aantal }) + '</div>'
      + '</div>'
      + '<button class="opgeslagen-playlist-laden" title="' + t('jukebox.playlistLadenTooltip') + '">&#9658;</button>'
      + '<button class="opgeslagen-playlist-verwijder" title="' + t('video.verwijderenTooltip') + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>'
      + '</button>'
    el.querySelector('.opgeslagen-playlist-laden').onclick = () => laadOpgeslagenPlaylistActie(p.id, p.naam)
    el.querySelector('.opgeslagen-playlist-verwijder').onclick = () => verwijderOpgeslagenPlaylistActie(p.id, p.naam)
    lijst.appendChild(el)
  })
}

async function laadOpgeslagenPlaylistActie(playlistId, naam) {
  const akkoord = await ipcRenderer.invoke('vraag-bevestiging', {
    titel: t('jukebox.playlistLadenTitel'),
    bericht: t('jukebox.playlistLadenBevestiging', { naam }),
    knopTekst: t('algemeen.okBtn')
  })
  if (!akkoord) return

  const { items, overgeslagen } = laadOpgeslagenPlaylist(playlistId)

  leegPlaylist()
  items.forEach(item => voegToeAanPlaylist({
    type: item.type, lokaalPad: item.lokaal_pad, youtubeUrl: item.youtube_url, artiest: item.artiest, titel: item.titel
  }))

  huidigeIndex = -1
  stop()
  sluitOpgeslagenPlaylists()
  laadPlaylist()

  if (overgeslagen > 0) {
    toonFoutMelding(t('jukebox.playlistItemsOvergeslagen', { n: overgeslagen }))
  }
}

async function verwijderOpgeslagenPlaylistActie(playlistId, naam) {
  const akkoord = await ipcRenderer.invoke('vraag-bevestiging', {
    titel: t('jukebox.playlistVerwijderenTitel'),
    bericht: naam
  })
  if (!akkoord) return

  verwijderOpgeslagenPlaylist(playlistId)
  renderOpgeslagenPlaylists()
}
function schudPlaylist() {
  if (playlist.length < 2) return

  const playlistIds = playlist.map(p => p.playlist_id)

  for (let i = playlistIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[playlistIds[i], playlistIds[j]] = [playlistIds[j], playlistIds[i]]
  }

  herschikPlaylist(playlistIds)
  huidigeIndex = -1
  laadPlaylist()
}

function speelIndex(i) {
  if (i < 0 || i >= playlist.length) return
  huidigeIndex = i
  const item = playlist[i]

  // Annuleert een eventueel nog lopende opruimtimer van een eerdere stop() (zie aldaar) - anders zou die
  // timer straks alsnog afgaan en de albumhoes van dít nieuwe nummer verbergen/de tonearm resetten.
  clearTimeout(stopOpruimTimer)
  // Annuleert een eventueel nog lopende auto-advance-vertraging van afgespeeldGaVerder() (zie aldaar) -
  // zonder deze guard zou handmatig navigeren tijdens die vertraging straks alsnog overschreven worden
  // door het inmiddels ingehaalde, oorspronkelijk geplande "volgende nummer".
  clearTimeout(afgespeeldVertragingTimer)

  const speler = document.getElementById('speler')
  const ytWrap = document.getElementById('youtube-speler-wrap')
  const audioCoverWrap = document.getElementById('audio-cover-wrap')
  const placeholder = document.getElementById('speel-placeholder')
  const fsBtn = document.getElementById('fullscreen-btn')

  placeholder.style.display = 'none'
  fsBtn.classList.add('zichtbaar')

  if (item.type === 'youtube') {
    speler.pause()
    speler.removeAttribute('src')
    speler.classList.remove('zichtbaar')
    audioCoverWrap.classList.remove('zichtbaar')
    // Instant (geen animatie) - #audio-cover-wrap verdwijnt hier toch al in dezelfde tick, dus een
    // weghaal-animatie zou nooit te zien zijn. Voorkomt vooral dat een latere toonVinyl() denkt dat er nog
    // een (inmiddels onzichtbare) plaat ligt.
    if (window.Turntable) window.Turntable.verbergVinylInstant()

    ytWrap.classList.add('zichtbaar')
    const videoId = getYoutubeId(item.youtube_url)

    if (ytFrameReady) {
      stuurNaarYtFrame({ actie: 'laad', videoId })
    } else {
      ytPendingVideoId = videoId
    }
  } else {
    if (ytFrameReady) {
      stuurNaarYtFrame({ actie: 'stoppen' })
    }
    ytWrap.classList.remove('zichtbaar')

    // audio-only lokale bestanden (mp3/m4a/flac/wav) tonen een lelijk zwart beeld in een <video>-element
    // (geen videoframe om te tekenen) - #speler blijft de speel-engine (spectrum-analyzer blijft eraan
    // hangen, zie initLokaleAnalyser), maar wordt visueel verborgen ten gunste van de albumhoes
    if (isAudioBestand(item.lokaal_pad)) {
      // Het huidige nummer stopt meteen, ongeacht hoe lang toonVinyl() straks nog duurt vóórdat het
      // volgende nummer daadwerkelijk start (op gebruikersverzoek gefixt - zonder deze regel bleef het
      // vórige nummer gewoon doorspelen tijdens de hele plaat-wissel-animatie bij handmatig vorige/
      // volgende, want speler.src wordt nu pas ná die animatie overschreven, zie startAfspelen() verderop).
      // De 'pause'-listener op #speler raakt Turntable niet meer aan (zie hierboven), dus deze pause() kan
      // niet meer interfereren met de needle-drop die we hieronder zelf starten.
      speler.pause()
      speler.classList.remove('zichtbaar')
      document.getElementById('audio-track-info').innerHTML =
        '<div class="audio-track-artiest">' + escapeHtml(item.artiest || '') + '</div>'
        + '<div class="audio-track-titel">' + escapeHtml(item.titel || '') + '</div>'
      document.getElementById('audio-progress-vulling').style.width = '0%'
      document.getElementById('audio-tijd-huidig').textContent = '0:00'
      document.getElementById('audio-tijd-duur').textContent = '0:00'
      if (window.Turntable) {
        window.Turntable.stop()
        window.Turntable.reset()
      }
      audioCoverWrap.classList.add('zichtbaar')

      const startAfspelen = () => {
        speler.src = 'file:///' + item.lokaal_pad.replace(/\\/g, '/')
        pasTempoRateToe()
        speler.play()
      }
      if (window.Turntable) {
        // toonVinyl() regelt zelf of de plaat blijft liggen (zelfde album) of eerst weg-en-dan-neer moet
        // (ander album, op gebruikersverzoek) - pas zodra de juiste plaat definitief ligt, laten we ook de
        // needle-drop (Turntable.start()) draaien, en pas ná díe animatie start het daadwerkelijke
        // afspelen. Zonder deze extra stap begon het geluid al te spelen zodra Turntable.start() aan de
        // 1,3s-drop begon (getriggerd door de 'play'-event hieronder), dus hoorbaar vóórdat de naald
        // zichtbaar op de plaat lag - op gebruikersverzoek gefixt.
        window.Turntable.toonVinyl(item.cover_pad || null, () => {
          window.Turntable.start(startAfspelen)
        })
      } else {
        startAfspelen()
      }
    } else {
      speler.src = 'file:///' + item.lokaal_pad.replace(/\\/g, '/')
      pasTempoRateToe()
      speler.play()
      speler.classList.add('zichtbaar')
      audioCoverWrap.classList.remove('zichtbaar')
    }
  }

  document.getElementById('play-btn').textContent = '⏸'
  laadPlaylist()
}

function schermvullend() {
  const item = playlist[huidigeIndex]

  if (item && item.type === 'youtube') {
    const ytWrap = document.getElementById('youtube-speler-wrap')
    if (ytWrap.requestFullscreen) ytWrap.requestFullscreen()
    return
  }

  if (item && isAudioBestand(item.lokaal_pad)) {
    const audioCoverWrap = document.getElementById('audio-cover-wrap')
    if (audioCoverWrap.requestFullscreen) audioCoverWrap.requestFullscreen()
    return
  }

  const speler = document.getElementById('speler')
  if (speler.requestFullscreen) speler.requestFullscreen()
}

function speelPauze() {
  if (huidigeIndex === -1 && playlist.length > 0) {
    speelIndex(0)
    return
  }

  const item = playlist[huidigeIndex]

  if (item && item.type === 'youtube') {
    if (!ytFrameReady) return
    if (ytIsPlaying) {
      stuurNaarYtFrame({ actie: 'pauzeren' })
      document.getElementById('play-btn').textContent = '▶'
    } else {
      stuurNaarYtFrame({ actie: 'afspelen' })
      document.getElementById('play-btn').textContent = '⏸'
    }
    return
  }

  const speler = document.getElementById('speler')
  // Na stop() (de Stop-knop) staat #speler zonder bron (removeAttribute('src')), terwijl huidigeIndex
  // gewoon blijft staan - speler.play() op een lege bron doet dan niets (geen 'play'-event, geen geluid,
  // geen platenspeler-animatie), waardoor de jukebox na Stop gevolgd door Play "weg" leek te blijven en
  // niet meer terugkwam. Herstart in dat geval het huidige nummer helemaal opnieuw i.p.v. enkel paused/
  // afspelend te togglen op een element zonder bron.
  if (item && !speler.src) {
    speelIndex(huidigeIndex)
    return
  }

  // Turntable.start()/stop() liepen vroeger via de generieke 'play'/'pause'-listeners op #speler - nu
  // expliciet hier, want alleen bij een audio-only bestand ligt de plaat er en heeft de arm-animatie
  // zichtbaar effect (bij een video-bestand blijft de platenspeler-UI toch verborgen).
  const isTurntableAudio = item && isAudioBestand(item.lokaal_pad)
  if (speler.paused) {
    document.getElementById('play-btn').textContent = '⏸'
    if (isTurntableAudio && window.Turntable) {
      // **Bug gevonden en gefixt (na pauzeren begon het geluid meteen bij hervatten, terwijl de arm nog
      // zichtbaar terugzakte)**: deze aanname dat er hier geen needle-drop-vertraging nodig was ("de plaat
      // ligt al, alleen de arm tilt op/zakt weer, gelijktijdig met het geluid") bleek in de praktijk niet
      // te kloppen - stop() (bij pauzeren) tilt de arm net zo goed naar de ruststand als bij een echte stop,
      // dus hervatten moet 'm ook weer laten zakken (ARM_DROP_DUUR, 1.3s), zichtbaar net als bij een vers
      // nummer starten. speler.play() liep hier synchroon, dus het geluid was allang bezig terwijl de arm
      // nog aan het zakken was. Zelfde fix als speelIndex()'s needle-drop-vóór-geluid: pas afspelen zodra
      // Turntable.start()'s onComplete (de arm geland is) vuurt.
      window.Turntable.start(() => speler.play())
    } else {
      speler.play()
    }
  } else {
    speler.pause()
    if (isTurntableAudio && window.Turntable) window.Turntable.stop()
    document.getElementById('play-btn').textContent = '▶'
  }
}

// behoudTurntable: alleen true vanuit de echte Stop-knop (zie jukebox.html) - op gebruikersverzoek blijft
// de Pioneer daarbij gewoon in beeld staan (alleen de plaat verdwijnt, zie verbergVinyl() hieronder) i.p.v.
// het hele scherm leeg te maken voor de "Kies een nummer"-placeholder. De andere aanroepers van stop()
// hieronder (item verwijderen, playlist leegmaken, andere playlist laden) wijzigen de speellijst zelf al
// fundamenteel, dus daar blijft het oude gedrag (meteen verbergen) van toepassing.
function stop(behoudTurntable) {
  clearTimeout(stopOpruimTimer)
  clearTimeout(afgespeeldVertragingTimer)

  const speler = document.getElementById('speler')
  const audioCoverWrap = document.getElementById('audio-cover-wrap')
  // audio-cover-wrap draagt .zichtbaar alleen tijdens een lokaal audio-only nummer (zie speelIndex()) - bij
  // een gestopte video/YouTube-nummer, of wanneer er nog nooit iets gespeeld is, is er dus sowieso niets
  // te behouden.
  const wasTurntableActief = behoudTurntable && audioCoverWrap.classList.contains('zichtbaar')

  speler.pause()
  speler.removeAttribute('src')
  speler.classList.remove('zichtbaar')
  document.getElementById('audio-progress-vulling').style.width = '0%'
  document.getElementById('audio-tijd-huidig').textContent = '0:00'
  document.getElementById('audio-tijd-duur').textContent = '0:00'
  if (window.Turntable) {
    window.Turntable.stop()
    // Écht stoppen (i.t.t. pauzeren, dat alleen Turntable.stop() hierboven aanroept) haalt de plaat ook
    // weg - op gebruikersverzoek: pauzeren laat de plaat gewoon liggen, alleen stoppen/einde playlist niet.
    window.Turntable.verbergVinyl()
  }

  if (wasTurntableActief) {
    // reset() (instant, geen tween) volgt pas ná de tonearm-lift-/vinyl-weghaal-animaties hierboven (1.3s
    // resp. 0.9s), zodat de arm exact op de ruststand komt te staan - audio-cover-wrap zelf blijft nu
    // gewoon zichtbaar, dus hier hoeft (i.t.t. voorheen) niets meer verborgen te worden.
    stopOpruimTimer = setTimeout(() => {
      if (window.Turntable) window.Turntable.reset()
    }, TONEARM_LIFT_MS)
  } else {
    audioCoverWrap.classList.remove('zichtbaar')
    document.getElementById('speel-placeholder').style.display = 'block'
    document.getElementById('fullscreen-btn').classList.remove('zichtbaar')
  }

  const ytWrap = document.getElementById('youtube-speler-wrap')
  ytWrap.classList.remove('zichtbaar')
  if (ytFrameReady) {
    stuurNaarYtFrame({ actie: 'stoppen' })
  }
  // player.stopVideo() in yt-embed.html levert geen 'paused'-postMessage op (YouTube's state gaat naar
  // UNSTARTED, niet afgehandeld in de message-listener hierboven) - zonder deze losse aanroep zou de
  // spectrum-analyzer na het stoppen van een YouTube-nummer stiekem door blijven simuleren
  ytIsPlaying = false
  stopSpectrum()

  document.getElementById('play-btn').textContent = '▶'
}

function vorige() {
  if (huidigeIndex > 0) speelIndex(huidigeIndex - 1)
}

function volgende() {
  if (huidigeIndex < playlist.length - 1) {
    speelIndex(huidigeIndex + 1)
  } else {
    huidigeIndex = -1
    stop()
    laadPlaylist()
    toonEindeMelding(t('jukebox.eindeLijst'))
  }
}

function toonKlaarMelding() {
  toonEindeMelding(t('jukebox.alleAfgespeeld'))
}

function toonEindeMelding(tekst) {
  const placeholder = document.getElementById('speel-placeholder')
  placeholder.innerHTML = '<div class="speel-icoon">✓</div>'
    + '<div class="speel-tekst">' + tekst + '</div>'
  placeholder.style.display = 'flex'

  setTimeout(() => {
    placeholder.innerHTML = '<div class="speel-icoon">♪</div>'
      + '<div class="speel-tekst">' + t('jukebox.kiesNummer') + '</div>'
  }, 4000)
}

function naarEerste() {
  if (playlist.length > 0) speelIndex(0)
}

function naarLaatste() {
  if (playlist.length > 0) speelIndex(playlist.length - 1)
}

// Alleen aangeroepen bij een echt 'ended' (lokaal of YouTube), niet vanuit foutGaVerder() - een nummer dat
// niet kon afspelen telt niet mee als "afgespeeld" voor de eigen luisterstatistieken.
function registreerHuidigeAfspeling() {
  const item = playlist[huidigeIndex]
  if (!item) return
  registreerAfspeling({ type: item.type, lokaalPad: item.lokaal_pad, youtubeUrl: item.youtube_url, artiest: item.artiest, titel: item.titel, coverPad: item.cover_pad })
}

function afgespeeldGaVerder() {
  const afgespeeld = playlist[huidigeIndex]
  // Alleen bij een écht uitgespeeld lokaal audiobestand stond de tonearm zichtbaar neer - bij YouTube of
  // een mislukte poging (foutGaVerder(), ook via afgespeeldGaVerder) is er niets om te tonen, dus geen
  // kunstmatige vertraging nodig.
  const wasLokaleAudio = afgespeeld && afgespeeld.type !== 'youtube' && isAudioBestand(afgespeeld.lokaal_pad)

  if (afgespeeld) {
    verwijderUitPlaylist(afgespeeld.playlist_id)
  }

  playlist = getPlaylist()

  if (playlist.length === 0) {
    huidigeIndex = -1
    stop()
    laadPlaylist()
    toonKlaarMelding()
    return
  }

  const volgendeIndex = huidigeIndex < playlist.length ? huidigeIndex : 0
  huidigeIndex = -1

  if (wasLokaleAudio && window.Turntable) {
    // Zonder deze vertraging snapt speelIndex()'s eigen reset() de arm instant terug naar rust (bedoeld
    // voor snelle handmatige navigatie via vorige/volgende), waardoor de rustige lift-terug-naar-rust bij
    // een natuurlijk einde van een nummer nooit zichtbaar was - de arm ging al terug, alleen te snel om
    // te zien. Hier laten we 'm eerst echt (zichtbaar) teruglopen voordat het volgende nummer laadt.
    window.Turntable.stop()
    afgespeeldVertragingTimer = setTimeout(() => speelIndex(volgendeIndex), TONEARM_LIFT_MS)
  } else {
    speelIndex(volgendeIndex)
  }
}

function toonFoutMelding(tekst) {
  const el = document.getElementById('foutmelding')
  el.textContent = tekst
  el.classList.add('zichtbaar')

  clearTimeout(toonFoutMelding.timer)
  toonFoutMelding.timer = setTimeout(() => el.classList.remove('zichtbaar'), 7000)
}

function foutGaVerder() {
  const mislukt = playlist[huidigeIndex]

  if (mislukt) {
    toonFoutMelding(t('jukebox.nietAfspeelbaar', { titel: mislukt.titel || mislukt.artiest || '' }))
  }

  afgespeeldGaVerder()
}

document.getElementById('speler').addEventListener('ended', () => {
  registreerHuidigeAfspeling()
  afgespeeldGaVerder()
})

function toonMeestGespeeld() {
  document.getElementById('playlist-lijst').style.display = 'none'
  document.getElementById('bibliotheek-resultaten').style.display = 'none'
  document.getElementById('opgeslagen-playlists').style.display = 'none'
  document.getElementById('meest-gespeeld').style.display = ''
  renderMeestGespeeld()
}

function sluitMeestGespeeld() {
  document.getElementById('meest-gespeeld').style.display = 'none'
  document.getElementById('playlist-lijst').style.display = ''
}

async function renderMeestGespeeld() {
  const lijst = document.getElementById('meest-gespeeld-lijst')
  const items = getMeestGespeeld(50)

  if (items.length === 0) {
    lijst.innerHTML = '<div class="playlist-leeg">' + t('jukebox.geenMeestGespeeld') + '</div>'
    return
  }

  lijst.innerHTML = ''

  // async/for i.p.v. forEach: lokale thumbnails gaan via de maak-thumbnail-IPC (await nodig), zelfde patroon
  // als laadPlaylist() hierboven
  for (const item of items) {
    let thumb = ''
    if (item.type === 'youtube') {
      const id = getYoutubeId(item.youtube_url)
      if (id) thumb = 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg'
    } else if (item.cover_pad) {
      thumb = 'file:///' + item.cover_pad.replace(/\\/g, '/')
    } else if (item.lokaal_pad) {
      const pad = await ipcRenderer.invoke('maak-thumbnail', item.lokaal_pad)
      if (pad) thumb = 'file:///' + pad.replace(/\\/g, '/')
    }

    const naam = (item.artiest ? item.artiest + ' - ' : '') + (item.titel || '')

    const el = document.createElement('div')
    el.className = 'opgeslagen-playlist-item'
    el.innerHTML = (thumb
      ? '<img class="meest-gespeeld-thumb" src="' + thumb + '">'
      : '<div class="meest-gespeeld-thumb meest-gespeeld-thumb-leeg"></div>')
      + '<div class="opgeslagen-playlist-info">'
      + '<div class="opgeslagen-playlist-naam"></div>'
      + '<div class="opgeslagen-playlist-aantal">' + t('jukebox.keerAfgespeeld', { n: item.aantal }) + '</div>'
      + '</div>'
      + '<button class="opgeslagen-playlist-laden" title="' + t('selectie.voegToeAanPlaylist') + '">+</button>'
    // naam (artiest - titel) via een echte DOM-property gezet, niet in de HTML-string zelf - naam
    // kan uit een ID3-tag/YouTube-titel komen, en title="..." als attribuutstring is een aparte
    // escape-context die de tekst-node-gerichte escapeHtml() niet dekt (die laat " ongemoeid).
    const naamEl = el.querySelector('.opgeslagen-playlist-naam')
    naamEl.textContent = naam
    naamEl.title = naam
    el.querySelector('.opgeslagen-playlist-laden').onclick = () => {
      voegToeAanPlaylist({ type: item.type, lokaalPad: item.lokaal_pad, youtubeUrl: item.youtube_url, artiest: item.artiest, titel: item.titel, coverPad: item.cover_pad })
      laadPlaylist()
    }
    lijst.appendChild(el)
  }
}

window.leegMaken = leegMaken
window.zoekInAudio = zoekInAudio
window.verwijderItem = verwijderItem
window.speelPauze = speelPauze
window.stop = stop
window.vorige = vorige
window.volgende = volgende
window.naarEerste = naarEerste
window.naarLaatste = naarLaatste
window.schermvullend = schermvullend
window.schudPlaylist = schudPlaylist
window.zoekBibliotheekLive = zoekBibliotheekLive
window.voegBibliotheekSelectieToe = voegBibliotheekSelectieToe
window.toggleSelecteerAlleBibliotheekResultaten = toggleSelecteerAlleBibliotheekResultaten
window.stelBibliotheekTypeFilter = stelBibliotheekTypeFilter
window.openOpslaanPlaylist = openOpslaanPlaylist
window.toonMeestGespeeld = toonMeestGespeeld
window.sluitMeestGespeeld = sluitMeestGespeeld
window.toonOpgeslagenPlaylists = toonOpgeslagenPlaylists
window.sluitOpgeslagenPlaylists = sluitOpgeslagenPlaylists
window.toggleSpectrumZichtbaar = toggleSpectrumZichtbaar
window.stelPlatenspelerSchaalIn = stelPlatenspelerSchaalIn


laadPlaylist()
