const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { updateVideo } = require('./db/videos.js')

let huidigVideoId = null

ipcRenderer.on('stel-video-in', (event, video) => {
  huidigVideoId = video.id
  document.getElementById('artiest').value = video.artiest || ''
  document.getElementById('titel').value = video.titel || ''
  document.getElementById('verhaal').value = video.verhaal || ''
  document.getElementById('tag').value = video.tag || ''
})

function slaOp() {
  const artiest = document.getElementById('artiest').value.trim()
  const titel = document.getElementById('titel').value.trim()
  const verhaal = document.getElementById('verhaal').value.trim()
  const tag = document.getElementById('tag').value.trim()

  if (!titel) {
    document.getElementById('melding').textContent = 'Vul minimaal een titel in.'
    return
  }

  updateVideo({ id: huidigVideoId, artiest, titel, verhaal, tag })

  document.getElementById('melding').textContent = '✓ Opgeslagen'
  setTimeout(() => {
    ipcRenderer.send('bewerken-klaar')
  }, 800)
}