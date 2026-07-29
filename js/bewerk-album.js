const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { updateAlbum } = require('./db/albums.js')

let albumId = null

ipcRenderer.on('stel-album-in', (event, album) => {
  albumId = album.id
  document.getElementById('album-naam').value = album.naam || ''
  document.getElementById('album-artiest').value = album.artiest || ''
  document.getElementById('album-naam').select()
})

document.getElementById('album-naam').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') slaOp()
})
document.getElementById('album-artiest').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') slaOp()
})

function slaOp() {
  const naam = document.getElementById('album-naam').value.trim()
  const artiest = document.getElementById('album-artiest').value.trim()

  if (!naam || !artiest) {
    document.getElementById('melding').textContent = t('validatie.vulNaamIn')
    return
  }

  updateAlbum({ id: albumId, naam, artiest })
  ipcRenderer.send('album-toegevoegd')
}

window.slaOp = slaOp
