const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const shell = electron.shell
const fs = require('fs')

const modus = new URLSearchParams(window.location.search).get('modus')

function openGoogleConsole() {
  shell.openExternal('https://console.cloud.google.com/apis/library/youtube.googleapis.com')
}

async function initModus() {
  if (modus !== 'wijzig') return

  document.querySelector('h2').textContent = t('apiSleutelDialoog.titelWijzigen')
  document.querySelector('.uitleg').textContent = t('apiSleutelDialoog.introWijzigen')
  document.getElementById('overslaan-link').textContent = t('apiSleutelDialoog.annulerenBtn')

  const instellingenPad = await ipcRenderer.invoke('get-instellingen-pad')
  if (!fs.existsSync(instellingenPad)) return
  try {
    const instellingen = JSON.parse(fs.readFileSync(instellingenPad, 'utf8'))
    if (instellingen.youtubeApiKey && !instellingen.youtubeApiKey.includes('VUL_HIER')) {
      document.getElementById('sleutel').value = instellingen.youtubeApiKey
    }
  } catch (e) {}
}

initModus()

document.getElementById('sleutel').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') slaOp()
})

async function slaOp() {
  const sleutel = document.getElementById('sleutel').value.trim()
  if (!sleutel) {
    document.getElementById('melding').textContent = t('apiSleutelDialoog.leegMelding')
    return
  }

  const instellingenPad = await ipcRenderer.invoke('get-instellingen-pad')
  let instellingen = {}
  if (fs.existsSync(instellingenPad)) {
    try {
      instellingen = JSON.parse(fs.readFileSync(instellingenPad, 'utf8'))
    } catch (e) {}
  }
  instellingen.youtubeApiKey = sleutel
  fs.writeFileSync(instellingenPad, JSON.stringify(instellingen, null, 2))

  ipcRenderer.send('api-sleutel-venster-sluiten')
}

function overslaan() {
  ipcRenderer.send('api-sleutel-venster-sluiten')
}

window.openGoogleConsole = openGoogleConsole
window.slaOp = slaOp
window.overslaan = overslaan
