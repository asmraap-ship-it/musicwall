const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron')
const ffmpegPath = require('ffmpeg-static')
const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const { pathToFileURL } = require('url')

const userDataPath = app.getPath('userData')
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true })
}

const AUDIO_EXTENSIES = ['.mp3', '.m4a', '.flac', '.wav']

const thumbnailsPath = path.join(userDataPath, 'thumbnails')
if (!fs.existsSync(thumbnailsPath)) {
  fs.mkdirSync(thumbnailsPath, { recursive: true })
}

const albumCoversPath = path.join(userDataPath, 'album-covers')
if (!fs.existsSync(albumCoversPath)) {
  fs.mkdirSync(albumCoversPath, { recursive: true })
}

let mainWindow
let videoWindow = null
let jukeboxWin = null
let importWin = null
let albumImportWin = null
let whatsNewWin = null
let huidigThema = ''
let huidigeTaal = 'nl'

const VERTALINGEN = require('./js/vertalingen.js')

function t(sleutel, vervang) {
  let tekst = (VERTALINGEN[huidigeTaal] && VERTALINGEN[huidigeTaal][sleutel]) || VERTALINGEN.nl[sleutel] || sleutel
  if (vervang) {
    Object.keys(vervang).forEach(k => {
      tekst = tekst.split('{' + k + '}').join(vervang[k])
    })
  }
  return tekst
}

ipcMain.on('taal-gewijzigd', (event, taal) => {
  huidigeTaal = taal || 'nl'
})

const titelbalkKleuren = {
  '': { color: '#0e0c09', symbolColor: '#c8a87a' },
  licht: { color: '#ffffff', symbolColor: '#8a5a1f' },
  metaal: { color: '#12141c', symbolColor: '#8eb4d4' },
  jukebox: { color: '#1c0d0d', symbolColor: '#e8b94a' },
  nacht: { color: '#0e0c1c', symbolColor: '#9d7ce8' },
  jr: { color: '#0a0a0a', symbolColor: '#f5f5f5' },
  natuur: { color: '#0e140e', symbolColor: '#8fae6a' }
}

function titelbalkOptiesVoorThema(thema) {
  const kleuren = titelbalkKleuren[thema] || titelbalkKleuren['']
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...kleuren, height: 32 }
  }
}

// Bewust een functie i.p.v. een vaste constante: elk venster moet bij het AANMAKEN al de juiste kleur voor
// het op dat moment actieve thema krijgen. De oude aanpak (altijd ...titelbalkOpties spreaden - een module-
// constante berekend met thema '' bij opstart) liet elk venster eerst met de verkeerde (standaard-thema)
// min/max/sluiten-knopkleur aanmaken, gecorrigeerd via de browser-window-created listener hieronder - maar
// die correctie ná het aanmaken bleek in de praktijk niet altijd betrouwbaar te refreshen (bekende
// Electron/Windows-eigenaardigheid met titleBarOverlay), gemeld door de gebruiker bij de jukebox in het
// Licht-thema. Door meteen bij aanmaken de juiste kleur mee te geven is er niets meer te corrigeren.
function huidigeTitelbalkOpties() {
  return titelbalkOptiesVoorThema(huidigThema)
}

app.on('browser-window-created', (event, win) => {
  try { win.setTitleBarOverlay(titelbalkOptiesVoorThema(huidigThema).titleBarOverlay) } catch (e) {}
})

ipcMain.on('thema-gewijzigd', (event, thema) => {
  huidigThema = thema || ''
  BrowserWindow.getAllWindows().forEach(win => {
    try { win.setTitleBarOverlay(titelbalkOptiesVoorThema(huidigThema).titleBarOverlay) } catch (e) {}
    if (win.webContents !== event.sender) win.webContents.send('thema-toegepast', huidigThema)
  })
})

const JUKEBOX_MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
}

let jukeboxServerPort = null

function startJukeboxServer() {
  const server = http.createServer((req, res) => {
    const urlPad = decodeURIComponent(req.url.split('?')[0])
    const bestandsPad = path.normalize(path.join(__dirname, urlPad))

    if (!bestandsPad.startsWith(__dirname)) {
      res.writeHead(403)
      res.end('Verboden')
      return
    }

    fs.readFile(bestandsPad, (err, data) => {
      if (err) {
        res.writeHead(404)
        res.end('Niet gevonden')
        return
      }
      const ext = path.extname(bestandsPad).toLowerCase()
      res.writeHead(200, { 'Content-Type': JUKEBOX_MIME_TYPES[ext] || 'application/octet-stream' })
      res.end(data)
    })
  })

  server.listen(0, '127.0.0.1', () => {
    jukeboxServerPort = server.address().port
  })
}

let hoofdschermSluitenBevestigd = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  mainWindow.loadFile('index.html')
  mainWindow.maximize()
  hoofdschermSluitenBevestigd = false

  // Sluiten van het hoofdscherm sluit (via 'closed' hieronder) altijd ook alle nog open subvensters - een
  // gebruiker die per ongeluk op het kruisje klikt terwijl bijv. de jukebox nog speelt of een importvenster
  // nog open staat, verliest dat dan zonder waarschuwing. 'close' (i.t.t. 'closed') is nog annuleerbaar via
  // preventDefault(), dus alleen als er daadwerkelijk andere vensters open zijn wordt het sluiten hier één
  // keer onderbroken voor een bevestiging; bij akkoord zet de guard-vlag zich vast zodat de daaropvolgende
  // mainWindow.close() dit keer niet opnieuw onderbroken wordt (voorkomt een oneindige preventDefault-lus).
  mainWindow.on('close', (event) => {
    if (hoofdschermSluitenBevestigd) return

    const andereVensters = BrowserWindow.getAllWindows().filter(win => win !== mainWindow && !win.isDestroyed())
    if (andereVensters.length === 0) return

    event.preventDefault()
    vraagBevestiging(
      t('hoofdscherm.sluitenTitel'),
      t('hoofdscherm.sluitenBericht', { n: andereVensters.length }),
      t('hoofdscherm.sluitenKnop')
    ).then(akkoord => {
      if (akkoord) {
        hoofdschermSluitenBevestigd = true
        mainWindow.close()
      }
    })
  })

  // Zonder dit bleven losse vensters (jukebox, help, importeren, formuliervensters, ...) gewoon openstaan
  // nadat het hoofdscherm gesloten was - onlogisch (het hoofdscherm is de enige plek vanwaaruit je bij die
  // vensters kunt komen) en zonder een window-all-closed-handler (zie onderaan dit bestand) bleef het hele
  // app-proces zelfs na het sluiten van álle vensters op de achtergrond hangen.
  mainWindow.on('closed', () => {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) win.close()
    })
    mainWindow = null
  })
}

ipcMain.on('open-video', (event, url) => {
  if (videoWindow && !videoWindow.isDestroyed()) {
    videoWindow.close()
  }

  const videoId = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url.split('/').pop()

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'Musicwall',
    frame: false,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  videoWindow = win

  win.loadURL('https://www.youtube.com/watch?v=' + videoId + '&autoplay=1')
  win.setMenuBarVisibility(false)

  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS(`
      #masthead-container, #header, ytd-masthead, #guide-button, #chips-wrapper,
      ytd-watch-next-secondary-results-renderer, #secondary, #comments, #related,
      ytd-comments, .ytp-chrome-top, .ytp-show-cards-title, #info-contents, #meta,
      #above-the-fold, ytd-watch-metadata, tp-yt-paper-dialog,
      ytd-engagement-panel-section-list-renderer { display: none !important; }
      body, html { background: #000 !important; overflow: hidden !important; }
      #player, #player-container, ytd-player, #movie_player {
        width: 100vw !important; height: 100vh !important;
        position: fixed !important; top: 0 !important; left: 0 !important;
      }
      ytd-app { background: #000 !important; }
      .ytp-ad-overlay-container, .ytp-ad-overlay-slot, .ytp-ad-overlay-image,
      .ytp-ad-text-overlay, .ytp-ad-overlay-close-container,
      ytd-action-companion-ad-renderer, ytd-display-ad-renderer,
      ytd-promoted-sparkles-web-renderer, ytd-companion-slot-renderer
      { display: none !important; }
    `)
  })

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') win.close()
  })

  win.on('closed', () => {
    BrowserWindow.getAllWindows().forEach(w => {
      w.webContents.send('video-gesloten')
    })
    if (videoWindow === win) videoWindow = null
  })
})

ipcMain.on('open-lokaal', (event, pad, coverPad, artiest, titel) => {
  if (videoWindow && !videoWindow.isDestroyed()) {
    videoWindow.close()
  }

  const isAudio = AUDIO_EXTENSIES.includes(path.extname(pad).toLowerCase())

  // audio-only bestanden (mp3/m4a/flac/wav) in een <video>-tag tonen gaf een lelijk zwart beeld (geen
  // videoframe om te tekenen) - toont in plaats daarvan de albumhoes (indien bekend) met een <audio>-
  // element. lokaal-speler.html is een "echte", thema-bewuste pagina (net als alle andere vensters) i.p.v.
  // een dynamisch gegenereerd, altijd-zwart HTML-bestand zoals voorheen - anders bleef dit ene scherm
  // hardcoded zwart en dus niet passend bij bv. het Licht-thema, terwijl de rest van de app dat inmiddels
  // wel volgt (zie de gelijksoortige fix bij de jukebox-platenspeler hierboven). Bij video blijft de
  // achtergrond bewust wel altijd zwart (normale letterboxing, zie css/lokaal-speler.css).
  const win = new BrowserWindow({
    width: isAudio ? 480 : 1280,
    height: isAudio ? 480 : 720,
    title: 'Musicwall',
    frame: false,
    backgroundColor: (titelbalkKleuren[huidigThema] || titelbalkKleuren['']).color,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  videoWindow = win

  win.loadFile('lokaal-speler.html')
  win.setMenuBarVisibility(false)

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('stel-media-in', {
      pad: pathToFileURL(pad).href,
      coverPad: coverPad ? pathToFileURL(coverPad).href : null,
      isAudio,
      artiest: artiest || '',
      titel: titel || ''
    })
  })

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') win.close()
  })

  win.on('closed', () => {
    BrowserWindow.getAllWindows().forEach(w => {
      w.webContents.send('video-gesloten')
    })
    if (videoWindow === win) videoWindow = null
  })
})

ipcMain.on('open-toevoegen', (event, wallId) => {
  const addWin = new BrowserWindow({
    width: 600,
    height: 700,
    title: t('toevoegen.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  addWin.loadFile('toevoegen.html')
  addWin.setMenuBarVisibility(false)

  addWin.webContents.on('did-finish-load', () => {
    addWin.webContents.send('stel-wall-in', wallId)
  })
})

ipcMain.on('nummer-toegevoegd', (event) => {
  if (mainWindow) mainWindow.webContents.send('herlaad')
  BrowserWindow.getFocusedWindow().close()
})

ipcMain.on('wall-toegevoegd', () => {
  if (mainWindow) mainWindow.webContents.send('herlaad')
  BrowserWindow.getFocusedWindow().close()
})

ipcMain.on('open-nieuwe-wall', (event, groepId) => {
  const wallWin = new BrowserWindow({
    width: 400,
    height: 320,
    title: t('nieuweWall.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  wallWin.loadFile('nieuwe-wall.html')
  wallWin.setMenuBarVisibility(false)

  if (groepId) {
    wallWin.webContents.on('did-finish-load', () => {
      wallWin.webContents.send('stel-groep-in', groepId)
    })
  }
})

ipcMain.on('wallgroep-toegevoegd', () => {
  if (mainWindow) mainWindow.webContents.send('herlaad')
  BrowserWindow.getFocusedWindow().close()
})

ipcMain.on('open-nieuwe-wallgroep', () => {
  const groepWin = new BrowserWindow({
    width: 400,
    height: 390,
    title: t('nieuweWallGroep.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  groepWin.loadFile('nieuwe-wallgroep.html')
  groepWin.setMenuBarVisibility(false)
})

ipcMain.on('open-hernoem-wallgroep', (event, { groepId, huidigeNaam }) => {
  const groepWin = new BrowserWindow({
    width: 400,
    height: 320,
    title: t('nieuweWallGroep.hernoemenTitel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  groepWin.loadFile('nieuwe-wallgroep.html')
  groepWin.setMenuBarVisibility(false)

  groepWin.webContents.on('did-finish-load', () => {
    groepWin.webContents.send('stel-hernoem-in', { groepId, huidigeNaam })
  })
})

ipcMain.on('open-hernoem-tab', (event, { type, huidigeNaam }) => {
  const tabWin = new BrowserWindow({
    width: 400,
    height: 320,
    title: t('hernoemTab.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  tabWin.loadFile('hernoem-tab.html')
  tabWin.setMenuBarVisibility(false)

  tabWin.webContents.on('did-finish-load', () => {
    tabWin.webContents.send('stel-tab-in', { type, huidigeNaam })
  })
})

ipcMain.on('tab-hernoemd', (event, { type, naam }) => {
  if (mainWindow) mainWindow.webContents.send('tab-naam-gewijzigd', { type, naam })
  BrowserWindow.getFocusedWindow().close()
})

ipcMain.on('bevestig-wallgroep-verwijderen', async (event, { groepId, groepNaam }) => {
  const { getAlleWallGroepen, verwijderWallGroep } = require('./db/wallgroepen.js')
  const groep = getAlleWallGroepen().find(g => g.id === groepId)

  // een albums-groep verwijderen verwijdert (i.t.t. een walls-groep) ook echt de albums erin - geen
  // "Mijn albums"-vangnet zoals "Mijn walls" heeft voor ongegroepeerde walls, dus de bevestiging moet dat
  // hier expliciet en anders formuleren dan de standaard walls-boodschap
  let bericht
  if (groep && groep.type === 'albums') {
    const { getAlbumsVoorGroep } = require('./db/albums.js')
    const aantal = getAlbumsVoorGroep(groepId).length
    bericht = t('wallGroep.verwijderen.bevestigingAlbums', { naam: groepNaam }) + '\n'
      + (aantal > 0 ? t('wallGroep.verwijderen.metAlbums', { n: aantal }) : t('wallGroep.verwijderen.geenAlbums'))
  } else {
    bericht = t('wallGroep.verwijderen.bevestiging', { naam: groepNaam })
  }

  const akkoord = await vraagBevestiging(t('wallGroep.verwijderen.titel'), bericht)
  if (akkoord) {
    verwijderWallGroep(groepId)
    if (mainWindow) mainWindow.webContents.send('herlaad')
  }
})

ipcMain.on('kies-bestand', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: t('zoeken.videoFilterNaam'), extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm'] }]
  })
  if (!result.canceled && result.filePaths.length > 0) {
    event.sender.send('bestand-gekozen', result.filePaths[0])
  }
})

ipcMain.handle('maak-thumbnail', async (event, videoPad) => {
  const naam = path.basename(videoPad, path.extname(videoPad))
  const uitvoer = path.join(thumbnailsPath, naam + '.jpg')

  if (fs.existsSync(uitvoer)) return uitvoer

  return new Promise((resolve) => {
    execFile(
      ffmpegPath,
      ['-i', videoPad, '-ss', '00:00:03', '-vframes', '1', '-q:v', '2', uitvoer],
      (error, stdout, stderr) => {
        if (error) {
          console.error('ffmpeg fout:', error.message)
          resolve(null)
        } else {
          resolve(uitvoer)
        }
      }
    )
  })
})

ipcMain.on('bevestig-verwijderen', async (event, { videoId, naam }) => {
  const akkoord = await vraagBevestiging(t('video.verwijderen.titel'), naam)
  if (akkoord) {
    const { verwijderVideo } = require('./db/videos.js')
    verwijderVideo(videoId)
    if (mainWindow) mainWindow.webContents.send('herlaad')
  }
})

ipcMain.on('open-bewerken', (event, video) => {
  const bewerkWin = new BrowserWindow({
    width: 600,
    height: 580,
    title: t('bewerken.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  bewerkWin.loadFile('bewerken.html')
  bewerkWin.setMenuBarVisibility(false)

  bewerkWin.webContents.on('did-finish-load', () => {
    bewerkWin.webContents.send('stel-video-in', video)
  })
})

ipcMain.on('bewerken-klaar', () => {
  if (mainWindow) mainWindow.webContents.send('herlaad')
  BrowserWindow.getFocusedWindow().close()
})

ipcMain.on('open-import', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: t('importeren.mapKiezenTitel')
  })

  if (result.canceled || result.filePaths.length === 0) return

  const mapPad = result.filePaths[0]
  const extensies = ['.mp4', '.mkv', '.avi', '.mov', '.webm']

  const bestanden = fs.readdirSync(mapPad)
    .filter(f => extensies.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(mapPad, f))

  if (bestanden.length === 0) {
    dialog.showMessageBoxSync({
      type: 'info',
      title: t('importeren.geenVideosTitel'),
      message: t('importeren.geenVideosBericht')
    })
    return
  }

  event.sender.send('import-bestanden', bestanden)
})

ipcMain.on('open-importeren', () => {
  if (importWin && !importWin.isDestroyed()) {
    importWin.focus()
    return
  }

  importWin = new BrowserWindow({
    width: 550,
    height: 760,
    title: t('importeren.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  importWin.loadFile('importeren.html')
  importWin.setMenuBarVisibility(false)

  importWin.on('closed', () => {
    importWin = null
  })
})

ipcMain.on('import-klaar', () => {
  if (mainWindow) mainWindow.webContents.send('herlaad')
  BrowserWindow.getFocusedWindow().close()
})

ipcMain.on('open-album-import', (event, groepId) => {
  if (albumImportWin && !albumImportWin.isDestroyed()) {
    albumImportWin.focus()
    return
  }

  albumImportWin = new BrowserWindow({
    width: 550,
    height: 880,
    title: t('albumImport.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  albumImportWin.loadFile('album-import.html')
  albumImportWin.setMenuBarVisibility(false)

  albumImportWin.webContents.on('did-finish-load', () => {
    albumImportWin.webContents.send('stel-groep-in', groepId)
  })

  albumImportWin.on('closed', () => {
    albumImportWin = null
  })
})

// Scant één map als één album: audiobestanden, hoesdetectie, ID3-tags (artiest/titel/genre per track,
// plus een album-brede genre-suggestie en - alleen relevant voor de bulk-import hieronder - een
// gemeenschappelijke-artiest-suggestie als alle tracks toevallig dezelfde artiest-tag delen).
// Losgetrokken uit de oorspronkelijke kies-album-map-handler zodat kies-meerdere-albums-map 'm per
// submap kan hergebruiken zonder de scanlogica te dupliceren.
async function scanAlbumMap(mapPad) {
  const afbeeldingExtensies = ['.jpg', '.jpeg', '.png']

  const alleBestanden = fs.readdirSync(mapPad)
  // fs.readdirSync geeft geen gegarandeerde (laat staan alfabetische) volgorde terug - op NTFS bijvoorbeeld
  // vaak de volgorde waarin bestanden ooit zijn aangemaakt, wat bij een torrent-download geregeld niets met
  // de tracklijst-volgorde te maken heeft. Natuurlijke sortering (numeriek-bewust: "2" vóór "10", niet
  // "10" vóór "2" zoals een kale lexicografische sort zou doen) op bestandsnaam is de eerste, altijd
  // toepasbare aanname - de meeste tracks heten toch al "01 - Titel.mp3"/"1. Titel.mp3". Wordt hieronder,
  // ná het uitlezen van ID3-tags, nog verfijnd met het echte tracknummer als dat overal aanwezig blijkt.
  const audioBestanden = alleBestanden
    .filter(f => AUDIO_EXTENSIES.includes(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(f => path.join(mapPad, f))

  if (audioBestanden.length === 0) return null

  // Hoesbestand-detectie: prioriteitenlijst folder.* -> cover.* -> albumart.* -> eerste afbeelding in de map
  // (bestandsnaam wisselt per map bij deze gebruiker, dus geen vaste naam aannemen)
  const prioriteiten = ['folder', 'cover', 'albumart']
  let coverPad = null
  for (const naam of prioriteiten) {
    const match = alleBestanden.find(f => {
      const ext = path.extname(f).toLowerCase()
      return afbeeldingExtensies.includes(ext) && path.basename(f, ext).toLowerCase() === naam
    })
    if (match) { coverPad = path.join(mapPad, match); break }
  }
  if (!coverPad) {
    const eersteAfbeelding = alleBestanden.find(f => afbeeldingExtensies.includes(path.extname(f).toLowerCase()))
    if (eersteAfbeelding) coverPad = path.join(mapPad, eersteAfbeelding)
  }

  // ID3-tags per bestand uitlezen gebeurt hier in het main-process (een echte Node.js-omgeving) en niet in
  // de renderer: music-metadata is vanaf v8 ESM-only (geen require() mogelijk), en dynamic import() van een
  // bare package-specifier bleek vanuit een via <script src> geladen renderer-bestand onbetrouwbaar/stil
  // te falen (geen foutmelding, importeer-knop bleef uitgeschakeld) - in het main-process, waar Electron
  // gewoon kale Node.js draait, is dezelfde import() wél het standaard, betrouwbare interoppatroon.
  let mm
  try {
    mm = await import('music-metadata')
  } catch (e) {
    console.error('music-metadata kon niet geladen worden:', e.message)
    return {
      coverPad,
      genre: null,
      artiest: null,
      albumTitel: null,
      tracks: audioBestanden.map(pad => ({ lokaalPad: pad, artiest: '', titel: path.basename(pad, path.extname(pad)) }))
    }
  }

  const tracks = []
  // eerste gevonden TCON-genre in de map geldt als voorstel voor het hele album - ID3-genre-tags zijn
  // vaak per-track gezet (kan intern tegenstrijdig zijn), maar één representatieve suggestie is beter
  // dan niets; blijft altijd handmatig aan te passen/leeg te maken in het formulier
  let genre = null
  const artiesten = new Set()
  const albumTitels = new Set()
  for (const pad of audioBestanden) {
    const bestandsnaam = path.basename(pad, path.extname(pad))
    let artiest = ''
    let titel = bestandsnaam
    let trackNummer = null

    try {
      const metadata = await mm.parseFile(pad)
      if (metadata.common.artist) artiest = metadata.common.artist
      if (metadata.common.title) titel = metadata.common.title
      if (!genre && metadata.common.genre && metadata.common.genre.length > 0) genre = metadata.common.genre[0]
      if (metadata.common.album) albumTitels.add(metadata.common.album)
      if (metadata.common.track && Number.isInteger(metadata.common.track.no) && metadata.common.track.no > 0) {
        trackNummer = metadata.common.track.no
      }

      // geen los hoesbestand in de map gevonden -> terugval op de embedded ID3-hoes van het eerste
      // bestand dat er een heeft (eenmalig, alleen zolang coverPad nog leeg is)
      if (!coverPad && metadata.common.picture && metadata.common.picture.length > 0) {
        const plaatje = mm.selectCover(metadata.common.picture)
        if (plaatje) {
          const ext = (plaatje.format || '').includes('png') ? '.png' : '.jpg'
          const bestandspad = path.join(albumCoversPath, 'album-' + Date.now() + ext)
          fs.writeFileSync(bestandspad, plaatje.data)
          coverPad = bestandspad
        }
      }
    } catch (e) {
      // ontbrekende/beschadigde tags: gewoon terugvallen op de bestandsnaam
    }

    if (artiest) artiesten.add(artiest)
    tracks.push({ lokaalPad: pad, artiest, titel, trackNummer })
  }

  // het ID3-tracknummer (TRCK) is, wanneer aanwezig, betrouwbaarder dan de bestandsnaam-sortering hierboven
  // (immuun voor rare/ontbrekende naamgevingsconventies) - maar alleen bruikbaar als ECHT elk bestand er een
  // heeft; anders zou een missend tracknummer (sorteert als "geen positie") de volgorde alsnog verstoren, en
  // is de eerdere naam-sortering de veiligere keuze
  if (tracks.length > 0 && tracks.every(t => t.trackNummer !== null)) {
    tracks.sort((a, b) => a.trackNummer - b.trackNummer)
  }
  tracks.forEach(t => delete t.trackNummer)

  return {
    coverPad,
    genre,
    artiest: artiesten.size === 1 ? [...artiesten][0] : null,
    // alleen als bron voor het losse-album-formulier (zie kies-album-map hieronder) - bulk-import blijft
    // bewust de submapnaam/relatieve-pad-naam gebruiken (zie vindAlbumMappen hierboven), want een ID3-
    // albumtitel die voor meerdere submappen identiek is (bv. hetzelfde jaar in meerdere "Volume N"-mappen)
    // zou daar precies de naamgevings-botsing terugbrengen die de relatieve-padnaam juist moest oplossen
    albumTitel: albumTitels.size === 1 ? [...albumTitels][0] : null,
    tracks
  }
}

ipcMain.on('kies-album-map', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: t('albumImport.mapKiezenTitel')
  })

  if (result.canceled || result.filePaths.length === 0) return

  const mapPad = result.filePaths[0]
  const scan = await scanAlbumMap(mapPad)

  if (!scan) {
    dialog.showMessageBoxSync({
      type: 'info',
      title: t('albumImport.geenBestandenTitel'),
      message: t('albumImport.geenBestandenBericht')
    })
    return
  }

  event.sender.send('album-map-gekozen', {
    mapPad,
    coverPad: scan.coverPad,
    genre: scan.genre,
    artiest: scan.artiest,
    albumTitel: scan.albumTitel,
    tracks: scan.tracks
  })
})

// Zoekt album-kandidaat-mappen onder mapPad: niet zomaar "elke directe submap", want verzamelingen blijken
// in de praktijk ongelijk diep genest te zijn (bv. Jaar/Album direct naast Jaar/Volume-N/Album in dezelfde
// verzameling - hetzelfde jukebox-thema, andere bron). Een map die zelf al audiobestanden bevat is een album
// (en wordt niet verder afgedaald - een album heeft geen albums in zich); een map zonder audio maar mét
// submappen wordt beschouwd als een tussenliggende ordeningslaag (jaar/artiest/...) en één niveau verder
// verkend, tot MAX_DIEPTE. MAX_BEZOCHTE_MAPPEN is een harde noodrem tegen het per ongeluk kiezen van een
// veel te grote map (bv. een hele schijf) - de bulk-import is bedoeld voor "een map met meerdere albums",
// geen recursieve hele-schijf-scan.
const BULK_MAX_DIEPTE = 4
const BULK_MAX_BEZOCHTE_MAPPEN = 3000

async function vindAlbumMappen(ouderMapPad) {
  const gevonden = []
  let bezocht = 0
  let afgebroken = false

  async function verken(mapPad, diepte) {
    if (afgebroken) return
    bezocht++
    if (bezocht > BULK_MAX_BEZOCHTE_MAPPEN) { afgebroken = true; return }

    let entries
    try {
      entries = fs.readdirSync(mapPad, { withFileTypes: true })
    } catch (e) {
      return
    }

    const heeftAudio = entries.some(e => e.isFile() && AUDIO_EXTENSIES.includes(path.extname(e.name).toLowerCase()))
    if (heeftAudio) {
      gevonden.push(mapPad)
      return
    }

    if (diepte >= BULK_MAX_DIEPTE) return

    const subMappen = entries.filter(e => e.isDirectory()).map(e => path.join(mapPad, e.name)).sort()
    for (const sub of subMappen) {
      await verken(sub, diepte + 1)
    }
  }

  const topSubMappen = fs.readdirSync(ouderMapPad, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(ouderMapPad, d.name))
    .sort()

  for (const sub of topSubMappen) {
    await verken(sub, 1)
  }

  return { mappen: gevonden, afgebroken }
}

ipcMain.on('kies-meerdere-albums-map', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: t('albumImport.bovenliggendeMapKiezenTitel')
  })

  if (result.canceled || result.filePaths.length === 0) return

  const ouderMapPad = result.filePaths[0]
  const { mappen: albumMappen, afgebroken } = await vindAlbumMappen(ouderMapPad)

  // seriële scan (niet Promise.all): scanAlbumMap doet zware, niet-parallelliseerbare I/O (ID3 per bestand),
  // en tientallen mappen tegelijk laten scannen zou het main-process alsnog met evenveel werk belasten,
  // alleen dan zonder de voortgang die een seriële aanpak later eventueel zichtbaar kan maken
  const albums = []
  for (const albumMapPad of albumMappen) {
    let scan
    try {
      scan = await scanAlbumMap(albumMapPad)
    } catch (e) {
      scan = null
    }
    if (!scan) continue // onleesbare map: stil overgeslagen, geen album om te tonen

    // padnaam t.o.v. de gekozen map, segmenten aan elkaar geplakt - een kale basename zou bij een geneste
    // structuur (bv. "Volume 1" onder meerdere jaarmappen) tot identieke, onderling niet te onderscheiden
    // albumnamen leiden
    const naam = path.relative(ouderMapPad, albumMapPad).split(path.sep).join(' - ')

    albums.push({
      naam,
      artiest: scan.artiest,
      coverPad: scan.coverPad,
      genre: scan.genre,
      bronMap: albumMapPad,
      tracks: scan.tracks
    })
  }

  if (albums.length === 0) {
    dialog.showMessageBoxSync({
      type: 'info',
      title: t('albumImport.geenAlbumsGevondenTitel'),
      message: t('albumImport.geenAlbumsGevondenBericht')
    })
    return
  }

  event.sender.send('meerdere-albums-gekozen', { ouderMapPad, albums, afgebroken })
})

ipcMain.on('album-toegevoegd', () => {
  // naar alle vensters (niet alleen mainWindow) - een open album-detail.html moet zichzelf ook verversen
  // als het zojuist bewerkte album daar getoond wordt
  BrowserWindow.getAllWindows().forEach(win => win.webContents.send('herlaad-albums'))
  BrowserWindow.getFocusedWindow().close()
})

ipcMain.on('open-bewerk-album', (event, album) => {
  const bewerkWin = new BrowserWindow({
    width: 400,
    height: 520,
    title: t('albumBewerken.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  bewerkWin.loadFile('bewerk-album.html')
  bewerkWin.setMenuBarVisibility(false)

  bewerkWin.webContents.on('did-finish-load', () => {
    bewerkWin.webContents.send('stel-album-in', album)
  })
})

ipcMain.on('open-album-detail', (event, albumId) => {
  const detailWin = new BrowserWindow({
    width: 900,
    height: 750,
    title: 'Album',
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  detailWin.loadFile('album-detail.html')
  detailWin.setMenuBarVisibility(false)

  detailWin.webContents.on('did-finish-load', () => {
    detailWin.webContents.send('laad-album', albumId)
  })
})

ipcMain.on('sla-album-volgorde-op', (event, volgordeArray) => {
  const { herschikAlbums } = require('./db/albums.js')
  herschikAlbums(volgordeArray)
})

ipcMain.on('bevestig-album-verwijderen', async (event, { albumId, albumNaam }) => {
  const { getTracksVoorAlbum, verwijderAlbum } = require('./db/albums.js')
  const aantal = getTracksVoorAlbum(albumId).length
  const bericht = t('albums.verwijderen.bevestiging', { naam: albumNaam }) + '\n'
    + (aantal > 0 ? t('albums.verwijderen.metTracks', { n: aantal }) : t('albums.verwijderen.geenTracks'))

  const akkoord = await vraagBevestiging(t('albums.verwijderen.titel'), bericht)
  if (akkoord) {
    verwijderAlbum(albumId)
    BrowserWindow.getAllWindows().forEach(win => win.webContents.send('herlaad-albums'))
  }
})

ipcMain.on('bevestig-albums-verwijderen-meerdere', async (event, { ids, namen }) => {
  const akkoord = await vraagBevestiging(t('albums.meerdereVerwijderen.titel', { n: ids.length }), namen)
  if (akkoord) {
    const { verwijderAlbum } = require('./db/albums.js')
    ids.forEach(id => verwijderAlbum(id))
    BrowserWindow.getAllWindows().forEach(win => win.webContents.send('herlaad-albums'))
  }
})

ipcMain.on('bevestig-album-tracks-verwijderen-meerdere', async (event, { ids, namen }) => {
  const akkoord = await vraagBevestiging(t('albumDetail.meerdereVerwijderen.titel', { n: ids.length }), namen)
  if (akkoord) {
    const { verwijderTrack } = require('./db/albums.js')
    ids.forEach(id => verwijderTrack(id))
    event.sender.send('album-tracks-verwijderd')
  }
})

ipcMain.on('album-tracks-naar-playlist', (event, items) => {
  const { voegToeAanPlaylist } = require('./db/playlist.js')
  items.forEach(item => {
    if (item && item.lokaalPad) voegToeAanPlaylist(item)
  })
  if (jukeboxWin && !jukeboxWin.isDestroyed()) jukeboxWin.webContents.send('playlist-bijgewerkt')
})

ipcMain.on('bevestig-verwijderen-meerdere', async (event, { ids, namen }) => {
  const akkoord = await vraagBevestiging(t('video.meerdereVerwijderen.titel', { n: ids.length }), namen)
  if (akkoord) {
    const { verwijderVideo } = require('./db/videos.js')
    ids.forEach(id => verwijderVideo(id))
    if (mainWindow) mainWindow.webContents.send('herlaad')
  }
})

ipcMain.on('open-zoeken', () => {
  const zoekWin = new BrowserWindow({
    width: 600,
    height: 750,
    title: t('zoeken.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  zoekWin.loadFile('zoeken.html')
  zoekWin.setMenuBarVisibility(false)

  zoekWin.on('closed', () => {
    if (mainWindow) mainWindow.webContents.send('herlaad')
  })
})

ipcMain.on('open-kapotte-links', () => {
  const kapotteLinksWin = new BrowserWindow({
    width: 550,
    height: 700,
    title: t('kapotteLinks.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  kapotteLinksWin.loadFile('kapotte-links.html')
  kapotteLinksWin.setMenuBarVisibility(false)

  kapotteLinksWin.on('closed', () => {
    if (mainWindow) mainWindow.webContents.send('herlaad')
  })
})

ipcMain.handle('get-jukebox-server-poort', () => jukeboxServerPort)

ipcMain.on('open-jukebox', () => {
  if (jukeboxWin && !jukeboxWin.isDestroyed()) {
    jukeboxWin.focus()
    return
  }

  jukeboxWin = new BrowserWindow({
    width: 1100,
    height: 700,
    title: 'Musicwall Jukebox',
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  jukeboxWin.loadFile('jukebox.html')
  jukeboxWin.setMenuBarVisibility(false)

  jukeboxWin.on('closed', () => {
    jukeboxWin = null
  })
})

ipcMain.on('open-opslaan-playlist', () => {
  const opslaanWin = new BrowserWindow({
    width: 400,
    height: 320,
    title: t('playlistOpslaan.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  opslaanWin.loadFile('opslaan-playlist.html')
  opslaanWin.setMenuBarVisibility(false)
})

ipcMain.on('playlist-opgeslagen', (event, { naam, overgeslagen }) => {
  if (jukeboxWin && !jukeboxWin.isDestroyed()) jukeboxWin.webContents.send('playlist-opgeslagen', { naam, overgeslagen })
  BrowserWindow.getFocusedWindow().close()
})

ipcMain.handle('vraag-bevestiging', (event, { titel, bericht, knopTekst }) => vraagBevestiging(titel, bericht, knopTekst))

ipcMain.on('toevoegen-aan-playlist', (event, videoIds) => {
  const { voegToeAanPlaylist } = require('./db/playlist.js')
  const { getVideo } = require('./db/videos.js')
  videoIds.forEach(id => {
    const video = getVideo(id)
    if (!video) return

    if (video.type === 'youtube' && video.youtube_url) {
      voegToeAanPlaylist({ type: 'youtube', youtubeUrl: video.youtube_url, artiest: video.artiest, titel: video.titel })
    } else if (video.lokaal_pad) {
      voegToeAanPlaylist({ type: 'lokaal', lokaalPad: video.lokaal_pad, artiest: video.artiest, titel: video.titel })
    }
  })
  if (jukeboxWin && !jukeboxWin.isDestroyed()) jukeboxWin.webContents.send('playlist-bijgewerkt')
})

ipcMain.on('concert-media-naar-playlist', (event, items) => {
  const { voegToeAanPlaylist } = require('./db/playlist.js')
  items.forEach(item => {
    if (item && (item.lokaalPad || item.youtubeUrl)) voegToeAanPlaylist(item)
  })
  if (jukeboxWin && !jukeboxWin.isDestroyed()) jukeboxWin.webContents.send('playlist-bijgewerkt')
})

ipcMain.on('globaal-zoeken-naar-playlist', (event, items) => {
  const { voegToeAanPlaylist } = require('./db/playlist.js')
  items.forEach(item => {
    if (item && (item.lokaalPad || item.youtubeUrl)) voegToeAanPlaylist(item)
  })
  if (jukeboxWin && !jukeboxWin.isDestroyed()) jukeboxWin.webContents.send('playlist-bijgewerkt')
})

ipcMain.on('open-help', () => {
  const helpWin = new BrowserWindow({
    width: 650,
    height: 750,
    title: 'Musicwall — ' + t('help.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  helpWin.loadFile('help.html')
  helpWin.setMenuBarVisibility(false)
})

// Leest het eerste ## [x.y.z]-blok van CHANGELOG.md (of CHANGELOG.en.md bij taal 'en') en splitst het
// in secties (Added/Changed/Fixed, telkens een array met bullet-regels) - puur regex-based, want het
// Keep a Changelog-formaat van deze bestanden is altijd strak dezelfde vorm (## [versie], dan
// ### Sectie, dan "- " bullets). CHANGELOG.en.md bestaat pas vanaf de versie waarin dit scherm is
// geintroduceerd (oudere versies zijn niet vertaald) - val terug op de Nederlandse versie als het
// Engelse bestand om wat voor reden dan ook ontbreekt, in plaats van niets te tonen.
ipcMain.handle('haal-whats-new-op', (event, taal) => {
  try {
    const bestandsnaam = taal === 'en' && fs.existsSync(path.join(__dirname, 'CHANGELOG.en.md'))
      ? 'CHANGELOG.en.md'
      : 'CHANGELOG.md'
    const inhoud = fs.readFileSync(path.join(__dirname, bestandsnaam), 'utf8')
    const versieMatch = inhoud.match(/##\s*\[([^\]]+)\]/)
    if (!versieMatch) return { versie: null, secties: {} }

    const vanaf = inhoud.indexOf(versieMatch[0]) + versieMatch[0].length
    const volgendeKopIdx = inhoud.indexOf('\n## [', vanaf)
    const blok = volgendeKopIdx === -1 ? inhoud.slice(vanaf) : inhoud.slice(vanaf, volgendeKopIdx)

    const secties = {}
    const sectieRegex = /###\s*(\w+)\n([\s\S]*?)(?=\n###\s*\w+|$)/g
    let m
    while ((m = sectieRegex.exec(blok))) {
      const naam = m[1]
      const regels = m[2].split('\n')
        .map(r => r.trim())
        .filter(r => r.startsWith('- '))
        .map(r => r.slice(2).trim())
      if (regels.length) secties[naam] = regels
    }
    return { versie: versieMatch[1], secties }
  } catch (e) {
    return { versie: null, secties: {} }
  }
})

ipcMain.on('open-whats-new', () => {
  if (whatsNewWin && !whatsNewWin.isDestroyed()) {
    whatsNewWin.focus()
    return
  }
  whatsNewWin = new BrowserWindow({
    width: 560,
    height: 620,
    title: 'Musicwall — ' + t('whatsNew.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  whatsNewWin.loadFile('whats-new.html')
  whatsNewWin.setMenuBarVisibility(false)
  whatsNewWin.on('closed', () => { whatsNewWin = null })
})

ipcMain.on('bevestig-wall-verwijderen', async (event, { wallId, wallNaam }) => {
  const { getVideosVoorWall } = require('./db/videos.js')
  const aantal = getVideosVoorWall(wallId).length
  const bericht = t('wall.verwijderen.bevestiging', { naam: wallNaam }) + '\n'
    + (aantal > 0 ? t('wall.verwijderen.metVideos', { n: aantal }) : t('wall.verwijderen.leeg'))

  const akkoord = await vraagBevestiging(t('wall.verwijderen.titel'), bericht)
  if (akkoord) {
    const { verwijderWall } = require('./db/walls.js')
    verwijderWall(wallId)
    if (mainWindow) mainWindow.webContents.send('herlaad')
  }
})

function vraagBevestiging(titel, bericht, knopTekst) {
  return new Promise((resolve) => {
    const bevestigWin = new BrowserWindow({
      width: 420,
      height: 380,
      title: titel,
      frame: false,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    })
    bevestigWin.loadFile('bevestigen.html')
    bevestigWin.setMenuBarVisibility(false)

    bevestigWin.webContents.on('did-finish-load', () => {
      bevestigWin.webContents.send('stel-bevestiging-in', { titel, bericht, knopTekst })
    })

    ipcMain.once('bevestiging-resultaat', (event, resultaat) => {
      bevestigWin.close()
      resolve(resultaat)
    })

    bevestigWin.on('closed', () => {
      resolve(false)
    })
  })
}

ipcMain.on('open-hernoem-wall', (event, { wallId, huidigeNaam }) => {
  const wallWin = new BrowserWindow({
    width: 400,
    height: 320,
    title: t('nieuweWall.hernoemenTitel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  wallWin.loadFile('nieuwe-wall.html')
  wallWin.setMenuBarVisibility(false)

  wallWin.webContents.on('did-finish-load', () => {
    wallWin.webContents.send('stel-hernoem-in', { wallId, huidigeNaam })
  })
})

ipcMain.on('herlaad-hoofdscherm', () => {
  if (mainWindow) mainWindow.webContents.send('herlaad')
})

ipcMain.on('api-sleutel-venster-sluiten', () => {
  BrowserWindow.getFocusedWindow().close()
})

ipcMain.handle('haal-api-sleutel-op', () => {
  const sleutelPad = path.join(userDataPath, 'api-sleutel.enc')
  if (!fs.existsSync(sleutelPad)) return null
  try {
    const versleuteld = Buffer.from(fs.readFileSync(sleutelPad, 'utf8'), 'base64')
    return safeStorage.decryptString(versleuteld)
  } catch (e) {
    return null
  }
})

ipcMain.handle('sla-api-sleutel-op', (event, sleutel) => {
  if (!safeStorage.isEncryptionAvailable()) return { ok: false }
  const sleutelPad = path.join(userDataPath, 'api-sleutel.enc')
  fs.writeFileSync(sleutelPad, safeStorage.encryptString(sleutel).toString('base64'))
  return { ok: true }
})

function tijdstempel() {
  const nu = new Date()
  const pad = n => String(n).padStart(2, '0')
  return nu.getFullYear() + '-' + pad(nu.getMonth() + 1) + '-' + pad(nu.getDate())
    + '_' + pad(nu.getHours()) + '-' + pad(nu.getMinutes()) + '-' + pad(nu.getSeconds())
}

ipcMain.handle('maak-backup', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: t('backup.mapKiezenTitel')
  })
  if (result.canceled || result.filePaths.length === 0) return { ok: false, geannuleerd: true }

  try {
    const database = require('./database.js')
    const backupMap = path.join(result.filePaths[0], 'musicwall-backup-' + tijdstempel())
    fs.mkdirSync(backupMap, { recursive: true })

    await database.backup(path.join(backupMap, 'musicwall.db'))

    if (fs.existsSync(thumbnailsPath)) {
      fs.cpSync(thumbnailsPath, path.join(backupMap, 'thumbnails'), { recursive: true })
    }

    if (fs.existsSync(albumCoversPath)) {
      fs.cpSync(albumCoversPath, path.join(backupMap, 'album-covers'), { recursive: true })
    }

    return { ok: true, pad: backupMap }
  } catch (e) {
    return { ok: false, foutmelding: e.message }
  }
})

ipcMain.handle('herstel-backup', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: t('backup.herstelMapKiezenTitel')
  })
  if (result.canceled || result.filePaths.length === 0) return { ok: false, geannuleerd: true }

  const backupMap = result.filePaths[0]
  const backupDbPad = path.join(backupMap, 'musicwall.db')
  if (!fs.existsSync(backupDbPad)) return { ok: false, foutSleutel: 'backup.geenGeldigeMap' }

  const akkoord = await vraagBevestiging(
    t('backup.herstelBevestigingTitel'),
    t('backup.herstelBevestigingBericht')
  )
  if (!akkoord) return { ok: false, geannuleerd: true }

  try {
    const database = require('./database.js')
    database.close()

    fs.copyFileSync(backupDbPad, path.join(userDataPath, 'musicwall.db'))

    const backupThumbsPad = path.join(backupMap, 'thumbnails')
    if (fs.existsSync(backupThumbsPad)) {
      fs.rmSync(thumbnailsPath, { recursive: true, force: true })
      fs.cpSync(backupThumbsPad, thumbnailsPath, { recursive: true })
    }

    const backupAlbumCoversPad = path.join(backupMap, 'album-covers')
    if (fs.existsSync(backupAlbumCoversPad)) {
      fs.rmSync(albumCoversPath, { recursive: true, force: true })
      fs.cpSync(backupAlbumCoversPad, albumCoversPath, { recursive: true })
    }

    setTimeout(() => {
      app.relaunch()
      app.exit()
    }, 1000)

    return { ok: true }
  } catch (e) {
    return { ok: false, foutmelding: e.message }
  }
})

function openApiSleutelWindow(modus) {
  const apiWin = new BrowserWindow({
    width: 480,
    height: 680,
    title: t(modus === 'wijzig' ? 'apiSleutelDialoog.titelWijzigen' : 'apiSleutelDialoog.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  apiWin.loadFile('api-sleutel-wizard.html', modus ? { query: { modus } } : undefined)
  apiWin.setMenuBarVisibility(false)
}

ipcMain.on('open-api-sleutel-instellen', () => {
  openApiSleutelWindow('wijzig')
})

function controleerApiSleutel() {
  const instellingenPad = path.join(userDataPath, 'instellingen.json')
  const voorbeeldPad = path.join(__dirname, 'instellingen.voorbeeld.json')
  const sleutelPad = path.join(userDataPath, 'api-sleutel.enc')

  if (!fs.existsSync(instellingenPad) && fs.existsSync(voorbeeldPad)) {
    fs.copyFileSync(voorbeeldPad, instellingenPad)
  }

  // Migratie: bestaande installaties met een platte-tekst sleutel in instellingen.json
  // krijgen die eenmalig versleuteld overgezet naar api-sleutel.enc, en de platte kopie verwijderd.
  if (!fs.existsSync(sleutelPad) && fs.existsSync(instellingenPad)) {
    try {
      const instellingen = JSON.parse(fs.readFileSync(instellingenPad, 'utf8'))
      if (instellingen.youtubeApiKey && !instellingen.youtubeApiKey.includes('VUL_HIER') && safeStorage.isEncryptionAvailable()) {
        fs.writeFileSync(sleutelPad, safeStorage.encryptString(instellingen.youtubeApiKey).toString('base64'))
        delete instellingen.youtubeApiKey
        fs.writeFileSync(instellingenPad, JSON.stringify(instellingen, null, 2))
      }
    } catch (e) {}
  }

  if (!fs.existsSync(sleutelPad)) {
    openApiSleutelWindow()
  }
}

ipcMain.on('sla-volgorde-op', (event, volgordeArray) => {
  const { slaVolgordeOp } = require('./db/videos.js')
  slaVolgordeOp(volgordeArray)
})

ipcMain.on('sla-wall-volgorde-op', (event, volgordeArray) => {
  const { herschikWalls } = require('./db/walls.js')
  herschikWalls(volgordeArray)
})

ipcMain.on('sla-wallgroep-volgorde-op', (event, volgordeArray) => {
  const { herschikWallGroepen } = require('./db/wallgroepen.js')
  herschikWallGroepen(volgordeArray)
})

ipcMain.on('sla-concert-volgorde-op', (event, volgordeArray) => {
  const { herschikConcerten } = require('./db/concerten.js')
  herschikConcerten(volgordeArray)
})

ipcMain.on('open-nieuw-concert', () => {
  const concertWin = new BrowserWindow({
    width: 550,
    height: 520,
    title: t('nieuwConcert.titel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  concertWin.loadFile('nieuw-concert.html')
  concertWin.setMenuBarVisibility(false)
})

ipcMain.on('concert-toegevoegd', () => {
  if (mainWindow) mainWindow.webContents.send('herlaad-concerten')
  BrowserWindow.getFocusedWindow().close()
})

ipcMain.on('open-bewerk-concert', (event, concert) => {
  const concertWin = new BrowserWindow({
    width: 550,
    height: 520,
    title: t('nieuwConcert.bewerkenTitel'),
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  concertWin.loadFile('nieuw-concert.html')
  concertWin.setMenuBarVisibility(false)

  concertWin.webContents.on('did-finish-load', () => {
    concertWin.webContents.send('stel-bewerk-in', concert)
  })
})

ipcMain.on('open-concert-detail', (event, concertId) => {
  const detailWin = new BrowserWindow({
    width: 1100,
    height: 750,
    title: 'Concert',
    ...huidigeTitelbalkOpties(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  detailWin.loadFile('concert-detail.html')
  detailWin.setMenuBarVisibility(false)

  detailWin.webContents.on('did-finish-load', () => {
    detailWin.webContents.send('laad-concert', concertId)
  })
})

ipcMain.on('kies-concert-media', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: t('concertDetail.mediaFilterNaam'), extensions: ['jpg', 'jpeg', 'png', 'heic', 'mp4', 'mov', 'mkv', 'avi', 'webm'] }
    ]
  })
  if (!result.canceled && result.filePaths.length > 0) {
    event.sender.send('concert-media-gekozen', result.filePaths)
  }
})

ipcMain.on('concert-media-toegevoegd', () => {
  if (mainWindow) mainWindow.webContents.send('herlaad-concerten')
})

ipcMain.on('bevestig-concert-verwijderen', async (event, { concertId, concertNaam }) => {
  const { getMediaVoorConcert, verwijderConcert } = require('./db/concerten.js')
  const aantal = getMediaVoorConcert(concertId).length
  const bericht = t('concert.verwijderen.bevestiging', { naam: concertNaam }) + '\n'
    + (aantal > 0 ? t('concert.verwijderen.metMedia', { n: aantal }) : t('concert.verwijderen.geenMedia'))

  const akkoord = await vraagBevestiging(t('concert.verwijderen.titel'), bericht)
  if (akkoord) {
    verwijderConcert(concertId)
    if (mainWindow) mainWindow.webContents.send('herlaad-concerten')
  }
})

ipcMain.on('bevestig-concert-media-verwijderen-meerdere', async (event, { ids, namen }) => {
  const akkoord = await vraagBevestiging(t('concertDetail.meerdereVerwijderen.titel', { n: ids.length }), namen)
  if (akkoord) {
    const { verwijderMedia } = require('./db/concerten.js')
    ids.forEach(id => verwijderMedia(id))
    event.sender.send('concert-media-verwijderd')
    if (mainWindow) mainWindow.webContents.send('herlaad-concerten')
  }
})

app.whenReady().then(() => {
  startJukeboxServer()
  createWindow()
  controleerApiSleutel()
})

// er was hiervoor nergens een window-all-closed-handler - het app-proces bleef daardoor altijd op de
// achtergrond draaien nadat alle vensters (incl. het hoofdscherm) gesloten waren, ongeacht de cascade
// hierboven, want niets riep ooit app.quit() aan
app.on('window-all-closed', () => {
  app.quit()
})