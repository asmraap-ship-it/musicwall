const { ipcRenderer } = require('electron')

ipcRenderer.on('stel-media-in', (event, { pad, coverPad, isAudio, artiest, titel }) => {
  const body = document.getElementById('speler-body')
  const coverImg = document.getElementById('cover-img')
  const placeholder = document.getElementById('placeholder')
  const trackInfo = document.getElementById('track-info')
  const trackTitel = document.getElementById('track-titel')
  const trackArtiest = document.getElementById('track-artiest')
  const audioEl = document.getElementById('audio-el')
  const videoEl = document.getElementById('video-el')

  if (isAudio) {
    if (coverPad) {
      coverImg.src = coverPad
      coverImg.style.display = ''
    } else {
      placeholder.style.display = ''
    }
    if (titel) {
      trackTitel.textContent = titel
      trackArtiest.textContent = artiest || ''
      trackInfo.style.display = ''
    }
    audioEl.src = pad
    audioEl.style.display = ''
  } else {
    body.classList.add('video')
    videoEl.src = pad
    videoEl.style.display = ''
  }
})
