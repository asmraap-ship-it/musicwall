const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const shell = electron.shell
const fs = require('fs')

function openGoogleConsole() {
  shell.openExternal('https://console.cloud.google.com/apis/library/youtube.googleapis.com')
}

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
