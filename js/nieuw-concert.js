const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { maakConcert, updateConcert } = require('./db/concerten.js')

let modus = 'aanmaken'
let concertId = null

ipcRenderer.on('stel-bewerk-in', (event, concert) => {
  modus = 'bewerken'
  concertId = concert.id
  document.getElementById('titel').textContent = 'Concert bewerken'
  document.getElementById('opslaan-btn').textContent = 'Opslaan'
  document.getElementById('naam').value = concert.naam || ''
  document.getElementById('artiest').value = concert.artiest || ''
  document.getElementById('datum').value = concert.datum || ''
  document.getElementById('verhaal').value = concert.verhaal || ''
  document.getElementById('naam').select()
})

document.getElementById('naam').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('artiest').focus()
})

document.getElementById('artiest').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('datum').focus()
})

function slaOp() {
  const naam = document.getElementById('naam').value.trim()
  const artiest = document.getElementById('artiest').value.trim()
  const datum = document.getElementById('datum').value.trim()
  const verhaal = document.getElementById('verhaal').value.trim()

  if (!naam) {
    document.getElementById('melding').textContent = 'Vul een naam in.'
    return
  }

  if (modus === 'bewerken') {
    updateConcert({ id: concertId, naam, artiest, datum, verhaal })
  } else {
    maakConcert({ naam, artiest, datum, verhaal })
  }
  ipcRenderer.send('concert-toegevoegd')
}

window.slaOp = slaOp
