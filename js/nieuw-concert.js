const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { maakConcert, updateConcert } = require('./db/concerten.js')

let modus = 'aanmaken'
let concertId = null

function toonTitelEnKnop() {
  document.getElementById('titel').textContent = modus === 'bewerken' ? t('nieuwConcert.bewerkenTitel') : t('nieuwConcert.titel')
  document.getElementById('opslaan-btn').textContent = modus === 'bewerken' ? t('algemeen.opslaanBtn') : t('nieuwConcert.aanmakenBtn')
}

ipcRenderer.on('stel-bewerk-in', (event, concert) => {
  modus = 'bewerken'
  concertId = concert.id
  toonTitelEnKnop()
  document.getElementById('naam').value = concert.naam || ''
  document.getElementById('artiest').value = concert.artiest || ''
  document.getElementById('datum').value = concert.datum || ''
  document.getElementById('verhaal').value = concert.verhaal || ''
  document.getElementById('naam').select()
})

document.addEventListener('taal-gewijzigd', toonTitelEnKnop)
toonTitelEnKnop()

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
    document.getElementById('melding').textContent = t('validatie.vulNaamIn')
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
