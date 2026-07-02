const electron = require('electron')
const ipcRenderer = electron.ipcRenderer

ipcRenderer.on('stel-bevestiging-in', (event, { titel, bericht }) => {
  document.getElementById('titel').textContent = titel
  document.getElementById('bericht').textContent = bericht
})

function bevestig() {
  ipcRenderer.send('bevestiging-resultaat', true)
}

function annuleer() {
  ipcRenderer.send('bevestiging-resultaat', false)
}

window.bevestig = bevestig
window.annuleer = annuleer