const fs = require('fs')
const path = require('path')
const { MotionPathPlugin } = require('gsap/MotionPathPlugin')

gsap.registerPlugin(MotionPathPlugin)

const DRAAISCHIJF_ORIGIN = '390 395'
const ARM_ORIGIN = '863 142'
// Rotatie-deltas t.o.v. de as-getekende stand van #toonarm-inner in svg/pioneer-plx1000.svg (rotatie 0),
// berekend rond pivot (863,142): de naaldpunt staat in de brontekening zelf al vlak buiten het label
// (r ≈ 103 t.o.v. vinylcentrum 390,395) - vandaar eindHoek = 0, geen rotatie nodig. Drie afzonderlijke
// hoeken, geen twee: rustHoek is de geparkeerde stand ver van de plaat, duidelijk los van de rand - hoe
// negatiever de hoek, hoe verder de arm naar rechts zwaait, op gebruikersverzoek stapsgewijs verruimd
// (-26° -> -30° -> -40°). Bij -40° geometrisch nagerekend (rotatie om pivot (813.05,168.72), de headshell
// landt rond scherm-x ≈ 746) dat de arm nog ruim (>150px) vrij blijft van de pitch-fader (x 880-926) en de
// tempo-range-behuizing (x 858-952) rechts van de pivot - geen aanraking. startHoek is waar de naald een
// nummer daadwerkelijk oppikt op de buitenste groef (r ≈ 287, net bínnen de vinylrand r = 292) - dat zijn
// bewust twee verschillende hoeken, anders zou de "needle drop" bij het starten van een nummer nergens
// naartoe bewegen (rust ligt dan al op exact dezelfde plek als het begin van de plaat).
const RUST_HOEK = -40
const START_HOEK = -20
const EIND_HOEK = 0
const RPM_DEFAULT = 33
// Op gebruikersverzoek verruimd van 0.6s - zowel de needle-drop bij starten als de lift-terug-naar-rust
// bij stoppen/pauzeren voelden te snel/abrupt aan. Geldt voor beide (start()/stop() delen deze constante).
const ARM_DROP_DUUR = 1.3

// Vinyl-plaatsing (op gebruikersverzoek): de plaat komt aanzweven met een boogvormig pad de draaitafel
// op, en verdwijnt weer diezelfde kant op. Coördinaten zijn offsets t.o.v. vinyl's eigen, correct
// getekende rustpositie (0,0 = goed gecentreerd op de spindel) - dus onafhankelijk van de absolute
// canvas-positie, en onafhankelijk van #vinyl's nesting in #draaischijf.
// Bewust van LINKS i.p.v. rechts: #vinyl komt in de SVG vóór #toonarm te staan (dus #toonarm tekent er
// als latere sibling overheen, correct voor de rust-/speelstand - de arm hoort zichtbaar boven de plaat
// te liggen). Een pad van rechts kruiste het scherm-gebied van de toonarm/het pivot-mechaniek (rond
// x=650-950, y=50-650), waardoor de aankomende plaat er zichtbaar "onderdoor" leek te schuiven. Links is
// volledig vrij van de toonarm, dus geen paint-order-conflict mogelijk.
const VINYL_AANKOMST_PAD = 'M -750,100 Q -350,-150 0,0'
const VINYL_PLAATSING_DUUR = 0.9

let draaischijfEl = null
let vinylEl = null
let toonarmInnerEl = null
let coverPlaceholderEl = null
let coverIcoonEl = null
let coverImageEl = null
let draaischijfTween = null
let vinylTween = null
let laatsteProgressie = 0
// Onthoudt welk album (op cover_pad, dezelfde sleutel als elders in dit project voor "is dit dezelfde
// plaat") momenteel op de platter ligt - null cover_pad telt bewust nooit als "hetzelfde album" (twee
// losse mp3's zonder hoes zijn geen album), dus die geven altijd een wissel-animatie.
let vinylZichtbaar = false
let huidigeCoverPad = null

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
  vinylEl = wrap.querySelector('#vinyl')
  // #toonarm-inner, niet de buitenste #toonarm - die buitenste groep draagt sinds de pivot-positiecorrectie
  // (zie #behuizing) een statische translate voor de verplaatste pivot; GSAP roteert alleen de binnenste
  // groep, anders zou de rotatie-tween die translate overschrijven.
  toonarmInnerEl = wrap.querySelector('#toonarm-inner')
  coverPlaceholderEl = wrap.querySelector('#album-cover-placeholder')
  coverIcoonEl = wrap.querySelector('#album-cover-icoon')
  coverImageEl = wrap.querySelector('#album-cover-image')

  if (!draaischijfEl || !vinylEl || !toonarmInnerEl) {
    console.error('Turntable: #draaischijf, #vinyl of #toonarm-inner niet gevonden in de geïnjecteerde svg')
    return
  }

  gsap.set(toonarmInnerEl, { svgOrigin: ARM_ORIGIN, rotation: RUST_HOEK })

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

  // Eén langlevende plaatsings-tween, net als draaischijfTween hierboven. motionPath's beginpunt (het
  // eerste punt van VINYL_AANKOMST_PAD) wordt automatisch als startwaarde gebruikt (het pad zelf bepaalt
  // "van"), maar dat geldt niet voor opacity: gsap.to() vangt daarvoor gewoon de huídige waarde (SVG-
  // default 1) als "van" op, dus zonder deze losse gsap.set() zou opacity nooit echt animeren (1 -> 1,
  // een no-op) - vandaar wél expliciet.
  gsap.set(vinylEl, { opacity: 0 })
  // play(0) = aankomst-animatie, reverse() = weghaal-animatie, beide op hetzelfde pad/dezelfde tween.
  vinylTween = gsap.to(vinylEl, {
    motionPath: { path: VINYL_AANKOMST_PAD },
    opacity: 1,
    duration: VINYL_PLAATSING_DUUR,
    ease: 'power2.out',
    paused: true
  })
}

// klaar (optioneel) vuurt pas zodra de naald écht geland is (onComplete van de drop-tween) - js/jukebox.js
// gebruikt dit om het daadwerkelijke afspelen van het audiobestand uit te stellen tot de arm zichtbaar op
// de plaat ligt, i.p.v. het geluid al te laten horen terwijl de arm nog aan het zakken is.
function start(klaar) {
  if (draaischijfTween) draaischijfTween.play()
  if (toonarmInnerEl) {
    // Needle drop: vanaf de ruststand naar de hoek die bij de laatst bekende trackvoortgang hoort - bij
    // een vers nummer is dat startHoek (het begin van de vinyl, niet de ruststand zelf), bij hervatten
    // na pauzeren landt de arm weer op de plek waar de muziek al was. overwrite:true/kill voorkomt dat
    // een snelle pauze-hervat-opeenvolging animaties laat opstapelen.
    gsap.killTweensOf(toonarmInnerEl)
    gsap.to(toonarmInnerEl, {
      rotation: hoekVoorProgressie(laatsteProgressie),
      duration: ARM_DROP_DUUR,
      ease: 'power2.out',
      overwrite: true,
      onComplete: () => { if (klaar) klaar() }
    })
  } else if (klaar) {
    klaar()
  }
}

function stop() {
  if (draaischijfTween) draaischijfTween.pause()
  if (toonarmInnerEl) {
    gsap.killTweensOf(toonarmInnerEl)
    gsap.to(toonarmInnerEl, {
      rotation: RUST_HOEK,
      duration: ARM_DROP_DUUR,
      ease: 'power2.out',
      overwrite: true
    })
  }
}

function reset() {
  laatsteProgressie = 0
  if (toonarmInnerEl) {
    gsap.killTweensOf(toonarmInnerEl)
    gsap.set(toonarmInnerEl, { rotation: RUST_HOEK })
  }
}

function bijwerken(currentTime, duration) {
  if (!toonarmInnerEl || !duration) return
  laatsteProgressie = Math.min(1, Math.max(0, currentTime / duration))
  // Korte "inhaal"-tween i.p.v. de rotatie direct te zetten - timeupdate vuurt maar een paar keer per
  // seconde, dus zonder deze tussenstap zou de arm merkbaar springen i.p.v. geloofwaardig mee te glijden.
  // overwrite:true voorkomt dat opeenvolgende updates (of de needle-drop-tween van start()) elkaar
  // opstapelen.
  gsap.to(toonarmInnerEl, {
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

// Toont de vinyl voor het gegeven album (cover_pad als albumsleutel, zie de toelichting bij de losse
// variabelen hierboven). Slim genoeg om drie situaties te onderscheiden:
// - nog geen plaat neer: aankomst-animatie.
// - zelfde album al neer: blijft gewoon liggen, geen animatie (net als bij een echte platenspeler - je
//   haalt de plaat niet van de tafel om alleen van nummer te wisselen).
// - ander album al neer: eerst de oude plaat weghalen, dán pas de nieuwe neerleggen (nooit gelijktijdig).
// klaar() vuurt zodra de juiste plaat definitief ligt (meteen bij "zelfde album", na de animatie(s) bij
// de andere twee) - de aanroeper (js/jukebox.js) start het daadwerkelijke afspelen pas dan, zodat de
// naald nooit op een lege of nog-in-beweging-zijnde platter lijkt te zakken.
function toonVinyl(coverPad, klaar) {
  const klaarMelden = () => { if (klaar) klaar() }

  if (vinylZichtbaar && coverPad !== null && coverPad === huidigeCoverPad) {
    // Zelfde album, maar de vorige aankomst-animatie kan nog bezig zijn (bv. snel na elkaar genavigeerd
    // binnen hetzelfde album, vóórdat de plaat al helemaal geland was) - dan pas klaar melden zodra díe
    // animatie écht afloopt, niet meteen. Anders zou de nog lopende tween later alsnog de originele
    // (inmiddels verouderde) callback afvuren en de boel door elkaar halen.
    if (vinylTween && vinylTween.isActive()) {
      vinylTween.eventCallback('onComplete', klaarMelden)
    } else {
      klaarMelden()
    }
    return
  }

  const plaatsNieuw = () => {
    // #vinyl's aankomstpad is een offset t.o.v. zijn eigen rustpositie, maar dat offset wordt toegepast
    // ín #draaischijf's (mogelijk gepauzeerde-maar-niet-teruggezette) rotatie - stop() hierboven pauzeert
    // de platter-rotatie namelijk op de hoek waar hij toevallig stond, niet terug naar 0. Zonder deze
    // reset kwam de plaat daardoor telkens uit een andere schermhoek aanzweven (bug gemeld door de
    // gebruiker tijdens live testen) en oogde de bevroren plaat scheef/"nog aan het draaien" i.p.v. recht
    // stilstaand. Instant (geen tween) - de plaat is op dit moment nog onzichtbaar (opacity 0), dus alleen
    // de kale platter-stipjes/wordmark springen even terug, wat niet opvalt.
    if (draaischijfEl) gsap.set(draaischijfEl, { rotation: 0 })
    setAlbumCover(coverPad)
    huidigeCoverPad = coverPad
    vinylZichtbaar = true
    if (vinylTween) {
      vinylTween.eventCallback('onComplete', klaarMelden)
      vinylTween.play(0)
    } else {
      klaarMelden()
    }
  }

  if (vinylZichtbaar) {
    if (vinylTween) {
      vinylTween.eventCallback('onReverseComplete', plaatsNieuw)
      vinylTween.reverse()
    } else {
      plaatsNieuw()
    }
  } else {
    plaatsNieuw()
  }
}

// Haalt de vinyl weg (weghaal-animatie) - alleen bedoeld voor een écht stoppen (stop-knop/einde playlist),
// niet voor pauzeren: pauzeren stopt alleen het draaien en tilt de arm (zie stop() hierboven), de plaat
// blijft gewoon liggen, net als in het echt.
function verbergVinyl(klaar) {
  if (!vinylZichtbaar) {
    if (klaar) klaar()
    return
  }
  vinylZichtbaar = false
  huidigeCoverPad = null
  if (vinylTween) {
    vinylTween.eventCallback('onReverseComplete', klaar || null)
    vinylTween.reverse()
  } else if (klaar) {
    klaar()
  }
}

// Instant (geen animatie) opruimen van de vinyl-status - voor situaties waarin de platenspeler toch al
// in één keer onzichtbaar wordt (bv. overschakelen naar een YouTube-nummer, waar #audio-cover-wrap direct
// verborgen wordt), zodat een latere toonVinyl() niet per ongeluk denkt dat er nog een (onzichtbare) plaat
// ligt.
function verbergVinylInstant() {
  vinylZichtbaar = false
  huidigeCoverPad = null
  if (vinylTween) vinylTween.pause(0)
}

window.Turntable = { start, stop, bijwerken, reset, setAlbumCover, toonVinyl, verbergVinyl, verbergVinylInstant }

initTurntable()
