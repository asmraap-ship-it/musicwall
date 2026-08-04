const { ipcRenderer } = require('electron')

const SECTIE_VOLGORDE = ['Added', 'Changed', 'Fixed']
const SECTIE_VERTAALSLEUTEL = {
  Added: 'whatsNew.sectieAdded',
  Changed: 'whatsNew.sectieChanged',
  Fixed: 'whatsNew.sectieFixed'
}

function escapeHtml(tekst) {
  const div = document.createElement('div')
  div.textContent = tekst
  return div.innerHTML
}

async function laadWhatsNew() {
  const { versie, secties } = await ipcRenderer.invoke('haal-whats-new-op', huidigeTaalCode())
  const versieTekst = versie || require('./package.json').version
  document.getElementById('whats-new-versie').textContent = t('help.versieLabel', { versie: versieTekst })

  const container = document.getElementById('whats-new-inhoud')
  const aanwezigeSecties = SECTIE_VOLGORDE.filter(naam => secties[naam] && secties[naam].length)

  if (!aanwezigeSecties.length) {
    container.innerHTML = '<p>' + escapeHtml(t('whatsNew.leeg')) + '</p>'
    return
  }

  container.innerHTML = aanwezigeSecties.map(naam => {
    const items = secties[naam].map(regel => '<li>' + escapeHtml(regel) + '</li>').join('')
    return '<section><h2>' + escapeHtml(t(SECTIE_VERTAALSLEUTEL[naam])) + '</h2><ul>' + items + '</ul></section>'
  }).join('')
}

document.getElementById('whats-new-sluiten-btn').addEventListener('click', () => window.close())

laadWhatsNew()
