const fs = require('fs')
const path = require('path')

const DRAAISCHIJF_ORIGIN = '390 395'
const ARM_ORIGIN = '863 142'
// Rotatie-deltas t.o.v. de as-getekende stand van #toonarm in svg/pioneer-plx1000.svg (rotatie 0),
// berekend rond pivot (863,142): de naaldpunt staat in de brontekening zelf al vlak buiten het label
// (r ≈ 103 t.o.v. vinylcentrum 390,395) - vandaar eindHoek = 0, geen rotatie nodig. Drie afzonderlijke
// hoeken, geen twee: rustHoek is de geparkeerde stand ver van de plaat (r ≈ 377, duidelijk los van de
// rand - hoe negatiever de hoek, hoe verder de arm naar rechts zwaait, op gebruikersverzoek verruimd van
// -26° naar -30° voor een iets verdere ruststand), startHoek is waar de naald een nummer daadwerkelijk
// oppikt op de buitenste groef (r ≈ 287, net bínnen de vinylrand r = 292) - dat zijn bewust twee
// verschillende hoeken, anders zou de "needle drop" bij het starten van een nummer nergens naartoe
// bewegen (rust ligt dan al op exact dezelfde plek als het begin van de plaat).
const RUST_HOEK = -30
const START_HOEK = -20
const EIND_HOEK = 0
const RPM_DEFAULT = 33
// Op gebruikersverzoek verruimd van 0.6s - zowel de needle-drop bij starten als de lift-terug-naar-rust
// bij stoppen/pauzeren voelden te snel/abrupt aan. Geldt voor beide (start()/stop() delen deze constante).
const ARM_DROP_DUUR = 1.3

let draaischijfEl = null
let toonarmEl = null
let coverPlaceholderEl = null
let coverIcoonEl = null
let coverImageEl = null
let draaischijfTween = null
let laatsteProgressie = 0

function hoekVoorProgressie(progressie) {
  const p = Math.min(1, Math.max(0, progressie))
  return START_HOEK + (EIND_HOEK - START_HOEK) * p
}

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

  draaischijfEl = wrap.querySelector('#draaischijf')
  toonarmEl = wrap.querySelector('#toonarm')
  coverPlaceholderEl = wrap.querySelector('#album-cover-placeholder')
  coverIcoonEl = wrap.querySelector('#album-cover-icoon')
  coverImageEl = wrap.querySelector('#album-cover-image')

  if (!draaischijfEl || !toonarmEl) {
    console.error('Turntable: #draaischijf of #toonarm niet gevonden in de geïnjecteerde svg')
    return
  }

  gsap.set(toonarmEl, { svgOrigin: ARM_ORIGIN, rotation: RUST_HOEK })

  // Roteert #draaischijf, niet #vinyl rechtstreeks - #vinyl is een geneste child-groep van #draaischijf
  // in svg/pioneer-plx1000.svg (mechanisch: de motor drijft de platter aan, de vinyl draait daar via de
  // slipmat gewoon in mee), dus één rotatie hier volstaat voor beide. Eén keer aangemaakt, daarna alleen
  // play()/pause() - i.p.v. de tween telkens te herscheppen, zodat pauzeren de huidige rotatie vasthoudt
  // en hervatten vloeiend doorloopt (geen jank/reset naar 0).
  draaischijfTween = gsap.to(draaischijfEl, {
    rotation: '+=360',
    duration: 60 / RPM_DEFAULT,
    repeat: -1,
    ease: 'none',
    svgOrigin: DRAAISCHIJF_ORIGIN,
    paused: true
  })
}

function start() {
  if (draaischijfTween) draaischijfTween.play()
  if (toonarmEl) {
    // Needle drop: vanaf de ruststand naar de hoek die bij de laatst bekende trackvoortgang hoort - bij
    // een vers nummer is dat startHoek (het begin van de vinyl, niet de ruststand zelf), bij hervatten
    // na pauzeren landt de arm weer op de plek waar de muziek al was. overwrite:true/kill voorkomt dat
    // een snelle pauze-hervat-opeenvolging animaties laat opstapelen.
    gsap.killTweensOf(toonarmEl)
    gsap.to(toonarmEl, {
      rotation: hoekVoorProgressie(laatsteProgressie),
      duration: ARM_DROP_DUUR,
      ease: 'power2.out',
      overwrite: true
    })
  }
}

function stop() {
  if (draaischijfTween) draaischijfTween.pause()
  if (toonarmEl) {
    gsap.killTweensOf(toonarmEl)
    gsap.to(toonarmEl, {
      rotation: RUST_HOEK,
      duration: ARM_DROP_DUUR,
      ease: 'power2.out',
      overwrite: true
    })
  }
}

function reset() {
  laatsteProgressie = 0
  if (toonarmEl) {
    gsap.killTweensOf(toonarmEl)
    gsap.set(toonarmEl, { rotation: RUST_HOEK })
  }
}

function bijwerken(currentTime, duration) {
  if (!toonarmEl || !duration) return
  laatsteProgressie = Math.min(1, Math.max(0, currentTime / duration))
  // Korte "inhaal"-tween i.p.v. de rotatie direct te zetten - timeupdate vuurt maar een paar keer per
  // seconde, dus zonder deze tussenstap zou de arm merkbaar springen i.p.v. geloofwaardig mee te glijden.
  // overwrite:true voorkomt dat opeenvolgende updates (of de needle-drop-tween van start()) elkaar
  // opstapelen.
  gsap.to(toonarmEl, {
    rotation: hoekVoorProgressie(laatsteProgressie),
    duration: 0.3,
    ease: 'sine.out',
    overwrite: true
  })
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
