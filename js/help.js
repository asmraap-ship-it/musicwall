const { ipcRenderer } = require('electron')

function wijzigApiSleutel() {
  ipcRenderer.send('open-api-sleutel-instellen')
}

document.getElementById('help-versie').textContent = t('help.versieLabel', { versie: require('./package.json').version })

window.wijzigApiSleutel = wijzigApiSleutel
