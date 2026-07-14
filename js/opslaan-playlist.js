const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const { getPlaylist } = require('./db/playlist.js')
const { slaPlaylistOp, bestaatPlaylistNaam } = require('./db/opgeslagenPlaylists.js')

document.getElementById('naam').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') slaOp()
})

function slaOp() {
  const naam = document.getElementById('naam').value.trim()
  if (!naam) {
    document.getElementById('melding').textContent = t('validatie.vulNaamIn')
    return
  }

  if (bestaatPlaylistNaam(naam)) {
    document.getElementById('melding').textContent = t('playlistOpslaan.naamBestaatAl')
    return
  }

  if (getPlaylist().length === 0) {
    document.getElementById('melding').textContent = t('playlistOpslaan.playlistLeeg')
    return
  }

  const { overgeslagen } = slaPlaylistOp(naam)
  ipcRenderer.send('playlist-opgeslagen', { naam, overgeslagen })
}

window.slaOp = slaOp
