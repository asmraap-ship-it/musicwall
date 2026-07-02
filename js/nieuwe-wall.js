const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { maakWall, hernoemWall } = require('./db/walls.js')

let modus = 'aanmaken'
let wallId = null

ipcRenderer.on('stel-hernoem-in', (event, { wallId: id, huidigeNaam }) => {
  modus = 'hernoemen'
  wallId = id
  document.getElementById('titel').textContent = 'Wall hernoemen'
  document.getElementById('opslaan-btn').textContent = 'Opslaan'
  document.getElementById('naam').value = huidigeNaam
  document.getElementById('naam').select()
})

document.getElementById('naam').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') slaOp()
})

function slaOp() {
  const naam = document.getElementById('naam').value.trim()
  if (!naam) {
    document.getElementById('melding').textContent = 'Vul een naam in.'
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