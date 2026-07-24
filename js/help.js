const { ipcRenderer } = require('electron')

function wijzigApiSleutel() {
  ipcRenderer.send('open-api-sleutel-instellen')
}

async function maakBackup() {
  const meldingEl = document.getElementById('backup-melding')
  meldingEl.textContent = t('backup.bezigMetBackup')
  const resultaat = await ipcRenderer.invoke('maak-backup')
  if (resultaat.geannuleerd) {
    meldingEl.textContent = ''
    return
  }
  if (!resultaat.ok) {
    meldingEl.textContent = t('backup.mislukt')
    return
  }
  meldingEl.textContent = t('backup.gemaakt', { pad: resultaat.pad })
}

async function herstelBackup() {
  const meldingEl = document.getElementById('backup-melding')
  const resultaat = await ipcRenderer.invoke('herstel-backup')
  if (resultaat.geannuleerd) {
    meldingEl.textContent = ''
    return
  }
  if (!resultaat.ok) {
    meldingEl.textContent = resultaat.foutSleutel ? t(resultaat.foutSleutel) : t('backup.mislukt')
    return
  }
  meldingEl.textContent = t('backup.bezigMetHerstellen')
}

document.getElementById('help-versie').textContent = t('help.versieLabel', { versie: require('./package.json').version })

window.wijzigApiSleutel = wijzigApiSleutel
window.maakBackup = maakBackup
window.herstelBackup = herstelBackup
