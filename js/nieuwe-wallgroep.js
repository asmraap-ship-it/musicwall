const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { maakWallGroep, hernoemWallGroep } = require('./db/wallgroepen.js')

let modus = 'aanmaken'
let groepId = null

function toonTitelEnKnop() {
  document.getElementById('titel').textContent = modus === 'hernoemen' ? t('nieuweWallGroep.hernoemenTitel') : t('nieuweWallGroep.titel')
  document.getElementById('opslaan-btn').textContent = modus === 'hernoemen' ? t('algemeen.opslaanBtn') : t('nieuweWallGroep.aanmakenBtn')
}

ipcRenderer.on('stel-hernoem-in', (event, { groepId: id, huidigeNaam }) => {
  modus = 'hernoemen'
  groepId = id
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
    hernoemWallGroep(groepId, naam)
  } else {
    maakWallGroep(naam)
  }

  ipcRenderer.send('wallgroep-toegevoegd')
}

window.slaOp = slaOp
