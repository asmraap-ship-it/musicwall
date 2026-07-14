const electron = require('electron')
const ipcRenderer = electron.ipcRenderer

ipcRenderer.on('stel-bevestiging-in', (event, { titel, bericht, knopTekst }) => {
  document.getElementById('titel').textContent = titel
  document.getElementById('bericht').textContent = bericht

  if (knopTekst) {
    const knop = document.getElementById('bevestig-btn')
    knop.removeAttribute('data-i18n')
    knop.textContent = knopTekst
  }
})

function bevestig() {
  ipcRenderer.send('bevestiging-resultaat', true)
}

function annuleer() {
  ipcRenderer.send('bevestiging-resultaat', false)
}

window.bevestig = bevestig
window.annuleer = annuleer