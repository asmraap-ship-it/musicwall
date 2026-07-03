const electron = require('electron')
const ipcRenderer = electron.ipcRenderer

let type = null

ipcRenderer.on('stel-tab-in', (event, { type: tabType, huidigeNaam }) => {
  type = tabType
  document.getElementById('naam').value = huidigeNaam
  document.getElementById('naam').select()
})

document.getElementById('naam').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') slaOp()
})

function slaOp() {
  const naam = document.getElementById('naam').value.trim()
  if (!naam) {
    document.getElementById('melding').textContent = t('validatie.vulNaamIn')
    return
  }

  ipcRenderer.send('tab-hernoemd', { type, naam })
}

window.slaOp = slaOp
