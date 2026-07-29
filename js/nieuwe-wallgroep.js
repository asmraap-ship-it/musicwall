const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { maakWallGroep, hernoemWallGroep } = require('./db/wallgroepen.js')

let modus = 'aanmaken'
let groepId = null
let huidigType = 'walls'

function toonTitelEnKnop() {
  document.getElementById('titel').textContent = modus === 'hernoemen' ? t('nieuweWallGroep.hernoemenTitel') : t('nieuweWallGroep.titel')
  document.getElementById('opslaan-btn').textContent = modus === 'hernoemen' ? t('algemeen.opslaanBtn') : t('nieuweWallGroep.aanmakenBtn')
}

function kiesType(type) {
  huidigType = type
  document.getElementById('btn-type-walls').classList.toggle('actief', type === 'walls')
  document.getElementById('btn-type-albums').classList.toggle('actief', type === 'albums')
}

ipcRenderer.on('stel-hernoem-in', (event, { groepId: id, huidigeNaam }) => {
  modus = 'hernoemen'
  groepId = id
  toonTitelEnKnop()
  document.getElementById('naam').value = huidigeNaam
  document.getElementById('naam').select()
  document.getElementById('type-keuze').style.display = 'none'
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
    maakWallGroep(naam, huidigType)
  }

  ipcRenderer.send('wallgroep-toegevoegd')
}

window.slaOp = slaOp
window.kiesType = kiesType
