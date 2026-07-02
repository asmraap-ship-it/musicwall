const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { maakWall, hernoemWall } = require('./db/walls.js')

let modus = 'aanmaken'
let wallId = null

function toonTitelEnKnop() {
  document.getElementById('titel').textContent = modus === 'hernoemen' ? t('nieuweWall.hernoemenTitel') : t('nieuweWall.titel')
  document.getElementById('opslaan-btn').textContent = modus === 'hernoemen' ? t('algemeen.opslaanBtn') : t('nieuweWall.aanmakenBtn')
}

ipcRenderer.on('stel-hernoem-in', (event, { wallId: id, huidigeNaam }) => {
  modus = 'hernoemen'
  wallId = id
  toonTitelEnKnop()
  document.getElementById('naam').value = huidigeNaam
  document.getElementById('naam').select()
})

document.addEventListener('taal-gewijzigd', toonTitelEnKnop)
toonTitelEnKnop()

document.getElementById('naam').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') slaOp()
})

function slaOp() {
  const naam = document.getElementById('naam').value.trim()
  if (!naam) {
    document.getElementById('melding').textContent = t('validatie.vulNaamIn')
    return
  }

  if (modus === 'hernoemen') {
    hernoemWall(wallId, naam)
  } else {
    maakWall(naam)
  }

  ipcRenderer.send('wall-toegevoegd')
}

window.slaOp = slaOp