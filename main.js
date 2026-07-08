const { app, BrowserWindow, ipcMain, dialog } = require('electron')
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

const thumbnailsPath = path.join(userDataPath, 'thumbnails')
if (!fs.existsSync(thumbnailsPath)) {
  fs.mkdirSync(thumbnailsPath, { recursive: true })
}

let mainWindow
let videoWindow = null
let jukeboxWin = null
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

const titelbalkOpties = titelbalkOptiesVoorThema('')

app.on('browser-window-created', (event, win) => {
  try { win.setTitleBarOverlay(titelbalkOptiesVoorThema(huidigThema).titleBarOverlay) } catch (e) {}
})

ipcMain.on('thema-gewijzigd', (event, thema) => {
  huidigThema = thema || ''
  BrowserWindow.getAllWindows().forEach(win => {
    try { win.setTitleBarOverlay(titelbalkOptiesVoorThema(huidigThema).titleBarOverlay) } catch (e) {}
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    ...titelbalkOpties,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  mainWindow.loadFile('index.html')
  mainWindow.maximize()
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

ipcMain.on('open-lokaal', (event, pad) => {
  if (videoWindow && !videoWindow.isDestroyed()) {
    videoWindow.close()
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'Musicwall',
    frame: false,
    backgroundColor: '#000000'
  })
  videoWindow = win

  const bestandUrl = pathToFileURL(pad).href
  const spelerHtml = '<!DOCTYPE html><html><head><style>'
    + 'html,body{margin:0;background:#000;height:100%;overflow:hidden}'
    + 'video{width:100vw;height:100vh;object-fit:contain;background:#000}'
    + '</style></head><body>'
    + '<video src="' + bestandUrl + '" autoplay controls></video>'
    + '</body></html>'
  const spelerPad = path.join(userDataPath, 'video-speler.html')
  fs.writeFileSync(spelerPad, spelerHtml)
  win.loadFile(spelerPad)
  win.setMenuBarVisibility(false)

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
    ...titelbalkOpties,
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
    ...titelbalkOpties,
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
    height: 320,
    title: t('nieuweWallGroep.titel'),
    ...titelbalkOpties,
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
    ...titelbalkOpties,
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
    ...titelbalkOpties,
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
  const bericht = t('wallGroep.verwijderen.bevestiging', { naam: groepNaam })

  const akkoord = await vraagBevestiging(t('wallGroep.verwijderen.titel'), bericht)
  if (akkoord) {
    const { verwijderWallGroep } = require('./db/wallgroepen.js')
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
    ...titelbalkOpties,
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
  const importWin = new BrowserWindow({
    width: 550,
    height: 620,
    title: t('importeren.titel'),
    ...titelbalkOpties,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  importWin.loadFile('importeren.html')
  importWin.setMenuBarVisibility(false)
})

ipcMain.on('import-klaar', () => {
  if (mainWindow) mainWindow.webContents.send('herlaad')
  BrowserWindow.getFocusedWindow().close()
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
    ...titelbalkOpties,
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
    ...titelbalkOpties,
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

ipcMain.on('open-help', () => {
  const helpWin = new BrowserWindow({
    width: 650,
    height: 750,
    title: 'Musicwall — ' + t('help.titel'),
    ...titelbalkOpties,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  helpWin.loadFile('help.html')
  helpWin.setMenuBarVisibility(false)
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

function vraagBevestiging(titel, bericht) {
  return new Promise((resolve) => {
    const bevestigWin = new BrowserWindow({
      width: 420,
      height: 320,
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
      bevestigWin.webContents.send('stel-bevestiging-in', { titel, bericht })
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
    ...titelbalkOpties,
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

ipcMain.handle('get-instellingen-pad', () => {
  return path.join(userDataPath, 'instellingen.json')
})

ipcMain.handle('get-instellingen-voorbeeld-pad', () => {
  return path.join(__dirname, 'instellingen.voorbeeld.json')
})

ipcMain.on('api-sleutel-venster-sluiten', () => {
  BrowserWindow.getFocusedWindow().close()
})

function openApiSleutelWindow(modus) {
  const apiWin = new BrowserWindow({
    width: 480,
    height: 700,
    title: t(modus === 'wijzig' ? 'apiSleutelDialoog.titelWijzigen' : 'apiSleutelDialoog.titel'),
    ...titelbalkOpties,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  apiWin.loadFile('api-sleutel-instellen.html', modus ? { query: { modus } } : undefined)
  apiWin.setMenuBarVisibility(false)
}

ipcMain.on('open-api-sleutel-instellen', () => {
  openApiSleutelWindow('wijzig')
})

function controleerApiSleutel() {
  const instellingenPad = path.join(userDataPath, 'instellingen.json')
  const voorbeeldPad = path.join(__dirname, 'instellingen.voorbeeld.json')

  if (!fs.existsSync(instellingenPad)) {
    if (!fs.existsSync(voorbeeldPad)) return
    fs.copyFileSync(voorbeeldPad, instellingenPad)
  }

  let instellingen
  try {
    instellingen = JSON.parse(fs.readFileSync(instellingenPad, 'utf8'))
  } catch (e) {
    return
  }

  if (!instellingen.youtubeApiKey || instellingen.youtubeApiKey.includes('VUL_HIER')) {
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
    ...titelbalkOpties,
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
    ...titelbalkOpties,
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
    ...titelbalkOpties,
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

app.whenReady().then(() => {
  startJukeboxServer()
  createWindow()
  controleerApiSleutel()
})