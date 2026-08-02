const fs = require('fs')
const path = require('path')

const VINYL_ORIGIN = '390 395'
const ARM_ORIGIN = '863 142'
// Rotatie-delta t.o.v. de as-getekende stand van #toonarm in svg/pioneer-plx1000.svg (rotatie 0) -
// wordt in een latere stap ingevuld (tonearm-rotatie op basis van trackvoortgang). Tot die tijd blijft
// de arm gewoon op zijn getekende ruststand staan.
const RUST_HOEK = 0
const RPM_DEFAULT = 33

let vinylEl = null
let toonarmEl = null
let coverPlaceholderEl = null
let coverIcoonEl = null
let coverImageEl = null
let vinylTween = null

function initTurntable() {
  const wrap = document.getElementById('turntable-svg-wrap')
  if (!wrap) return

  try {
    // __dirname wijst hier naar de map van het ládende document (jukebox.html, dus de projectroot),
    // niet naar js/ - zelfde valkuil als eerder bij de Rive-integratie, vandaar geen '..' in dit pad.
    const svgPad = path.join(__dirname, 'svg', 'pioneer-plx1000.svg')
    wrap.innerHTML = fs.readFileSync(svgPad, 'utf8')
  } catch (fout) {
    console.error('Turntable: kon svg/pioneer-plx1000.svg niet laden:', fout)
    return
  }

  vinylEl = wrap.querySelector('#vinyl')
  toonarmEl = wrap.querySelector('#toonarm')
  coverPlaceholderEl = wrap.querySelector('#album-cover-placeholder')
  coverIcoonEl = wrap.querySelector('#album-cover-icoon')
  coverImageEl = wrap.querySelector('#album-cover-image')

  if (!vinylEl || !toonarmEl) {
    console.error('Turntable: #vinyl of #toonarm niet gevonden in de geïnjecteerde svg')
    return
  }

  // Eén keer aangemaakt, daarna alleen play()/pause() - i.p.v. de tween telkens te herscheppen, zodat
  // pauzeren de huidige rotatie vasthoudt en hervatten vloeiend doorloopt (geen jank/reset naar 0).
  vinylTween = gsap.to(vinylEl, {
    rotation: '+=360',
    duration: 60 / RPM_DEFAULT,
    repeat: -1,
    ease: 'none',
    svgOrigin: VINYL_ORIGIN,
    paused: true
  })
}

function start() {
  if (vinylTween) vinylTween.play()
}

function stop() {
  if (vinylTween) vinylTween.pause()
}

function reset() {
  if (toonarmEl) gsap.set(toonarmEl, { svgOrigin: ARM_ORIGIN, rotation: RUST_HOEK })
}

function bijwerken() {
  // Tonearm-rotatie op basis van trackvoortgang volgt in een latere stap.
}

function setAlbumCover(coverPad) {
  if (!coverImageEl || !coverPad) return
  coverImageEl.setAttribute('href', 'file:///' + coverPad.replace(/\\/g, '/'))
  coverImageEl.style.display = ''
  if (coverPlaceholderEl) coverPlaceholderEl.style.display = 'none'
  if (coverIcoonEl) coverIcoonEl.style.display = 'none'
}

window.Turntable = { start, stop, bijwerken, reset, setAlbumCover }

initTurntable()
