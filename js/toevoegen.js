  const { ipcRenderer, shell } = require('electron')
  const { getAlleWalls } = require('./db/walls.js')
  const { voegVideoToe } = require('./db/videos.js')
  
  let huidigType = 'youtube'
  let gekozenPad = ''
  let huidigWallId = null
  
  ipcRenderer.on('stel-wall-in', (event, wallId) => {
  huidigWallId = wallId
  })

  function kiesType(type) {
    huidigType = type
    document.getElementById('btn-youtube').classList.toggle('actief', type === 'youtube')
    document.getElementById('btn-lokaal').classList.toggle('actief', type === 'lokaal')
    document.getElementById('sectie-youtube').classList.toggle('zichtbaar', type === 'youtube')
    document.getElementById('sectie-lokaal').classList.toggle('zichtbaar', type === 'lokaal')
  }

  function kiesBestand() {
    ipcRenderer.send('kies-bestand')
  }

  ipcRenderer.on('bestand-gekozen', (event, pad) => {
    gekozenPad = pad
    document.getElementById('bestand-naam').textContent = pad.split('\\').pop()
    document.getElementById('lokaal-pad').value = pad
  })

  function slaOp() {
    if (!huidigWallId) {
      document.getElementById('melding').textContent = 'Geen wall geselecteerd.'
      return
    }
	
    const wallId = huidigWallId
	const artiest = document.getElementById('artiest').value.trim()
    const titel = document.getElementById('titel').value.trim()
    const verhaal = document.getElementById('verhaal').value.trim()
    const tag = document.getElementById('tag').value.trim()

    if (!titel) {
      document.getElementById('melding').textContent = 'Vul minimaal een titel in.'
      return
    }

    if (huidigType === 'youtube') {
      const url = document.getElementById('youtube-url').value.trim()
      if (!url) {
        document.getElementById('melding').textContent = 'Vul een YouTube URL in.'
        return
      }
      voegVideoToe({ wallId, type: 'youtube', artiest, titel, verhaal, tag, youtubeUrl: url })
    } else {
      if (!gekozenPad) {
        document.getElementById('melding').textContent = 'Kies een videobestand.'
        return
      }
      voegVideoToe({ wallId, type: 'lokaal', artiest, titel, verhaal, tag, lokaalPad: gekozenPad })
    }
	
	document.getElementById('melding').textContent = '✓ Opgeslagen'
    setTimeout(() => {
      ipcRenderer.send('nummer-toegevoegd')
    }, 800)
  }