const fs = require('fs')
const path = require('path')
const { MotionPathPlugin } = require('gsap/MotionPathPlugin')

gsap.registerPlugin(MotionPathPlugin)

const DRAAISCHIJF_ORIGIN = '390 395'
const ARM_ORIGIN = '863 142'
// Rotatie-deltas t.o.v. de as-getekende stand van #toonarm-inner in svg/pioneer-plx1000.svg (rotatie 0),
// berekend rond pivot (863,142): de naaldpunt staat in de brontekening zelf al vlak buiten het label
// (r ≈ 110 t.o.v. vinylcentrum 390,395) - vandaar eindHoek = 0, geen rotatie nodig. Drie afzonderlijke
// hoeken, geen twee: rustHoek is de geparkeerde stand ver van de plaat, duidelijk los van de rand - hoe
// negatiever de hoek, hoe verder de arm naar rechts zwaait. startHoek is waar de naald een nummer
// daadwerkelijk oppikt op de buitenste groef (r ≈ 285, net bínnen de vinylrand r = 292, tussen de rand
// zelf en de eerste groefring op r = 278) - dat zijn bewust twee verschillende hoeken, anders zou de
// "needle drop" bij het starten van een nummer nergens naartoe bewegen (rust ligt dan al op exact
// dezelfde plek als het begin van de plaat).
// Herijkt nadat de gebruiker de toonarm/pivot-positie in de svg zelf handmatig verschoven heeft
// (translate van #toonarm/#g89 van (-49.95,26.72) naar (-88.22,~42) - de pivot staat nu dichter bij/
// anders t.o.v. de platter). #toonarm-inner's eigen lokale geometrie (armbuis-pad, headshell-rotatie,
// pivot-cirkel op (863,142)) is ongewijzigd, dus ARM_ORIGIN/DRAAISCHIJF_ORIGIN blijven kloppen - alleen
// de rotatie-uitkomst (waar de naald tov de platter landt) verschoof mee met de nieuwe pivot-positie.
// Opnieuw geometrisch bepaald via CDP (getCTM() van #g251 op een reeks testhoeken, i.p.v. losse
// schermmetingen - dat geeft de naaldpositie direct in dezelfde canvas-eenheden als het platter-
// middelpunt, zonder schaalfactor-omrekening nodig). startHoek verschoof van -20 naar -23 (bij -20 landt
// de naald nu op r ≈ 262, te ver naar binnen). rustHoek (-40) bleek toevallig nog steeds ruim vrij te
// blijven van de pitch-fader (x 880-926) - gemeten marge ~113 canvas-eenheden, geen aanpassing nodig.
const RUST_HOEK = -40
const START_HOEK = -23
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
let stroboscoopEl = null
let draaischijfTween = null
let vinylTween = null
let strobeTween = null
let laatsteProgressie = 0
// True vanaf het begin van start()'s needle-drop- óf stop()'s lift-tween tot-en-met zijn onComplete - zie
// de uitgebreide toelichting bij start()/stop() en bijwerken() hieronder (stale-timeupdate-race). Ooit
// alleen voor start() (toen wachtOpStart geheten), later verbreed naar stop() nadat bleek dat dezelfde race
// ook bij pauzeren optrad - zie de toelichting bij stop() hieronder.
let armTransitieBezig = false
// Onthoudt welk album (op cover_pad, dezelfde sleutel als elders in dit project voor "is dit dezelfde
// plaat") momenteel op de platter ligt. Twee coverloze tracks (cover_pad null, bv. losse mp3's die niet
// via de Albums-functie geïmporteerd zijn) tellen bewust ook als "hetzelfde" - zie de bug hieronder bij
// toonVinyl() voor waarom null vroeger juist expliciet uitgesloten was, en waarom dat averechts werkte.
let vinylZichtbaar = false
let huidigeCoverPad = null

function hoekVoorProgressie(progressie) {
  const p = Math.min(1, Math.max(0, progressie))
  return START_HOEK + (EIND_HOEK - START_HOEK) * p
}

// Blauw stroboscooplicht: een vaste, niet-roterende LED-unit náást de platter (#strobe-lamp, in
// #behuizing van svg/pioneer-plx1000.svg) die op de platterrand-stipjes (#stroboscope-rings, in
// #draaischijf) schijnt - net als op een echte platenspeler. Eerdere versie kleurde in plaats daarvan de
// hele #stroboscope-rings-groep blauw, wat er verkeerd uitzag (het hele draaiende plateau licht dan op,
// i.p.v. een vast lampje ernaast). Aan/uit gekoppeld aan exact dezelfde plekken die de platter-rotatie
// zelf al starten/stoppen (start()/stop()/toonHuidigeStandInstant() hieronder) - geen nieuw, los
// aanroeppad vanuit js/jukebox.js of js/album-detail.js nodig. De kleurwissel zelf (donker -> blauw) gaat
// via de .strobe-actief-CSS-klasse in de svg zelf (#strobe-stijl); hier alleen de klasse togglen plus een
// zachte knipper-tween op de lamp-opacity. Eén langlevende tween, net als draaischijfTween/vinylTween
// hierboven - alleen play()/pause(), niet steeds opnieuw aanmaken.
function strobeAan() {
  if (!stroboscoopEl) return
  stroboscoopEl.classList.add('strobe-actief')
  if (!strobeTween) {
    strobeTween = gsap.fromTo(stroboscoopEl,
      { opacity: 0.55 },
      { opacity: 1, duration: 0.45, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true })
  }
  strobeTween.play()
}

function strobeUit() {
  if (!stroboscoopEl) return
  stroboscoopEl.classList.remove('strobe-actief')
  if (strobeTween) strobeTween.pause()
  gsap.set(stroboscoopEl, { opacity: 1 })
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
  stroboscoopEl = wrap.querySelector('#strobe-lamp')

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
// **Bug gevonden en gefixt (vorige/volgende bleef afwisselend op 0:00/0:03 staan, ook bij normaal tempo
// doorklikken, niet alleen bij snel dubbelklikken)**: een `timeupdate`-event van het VORIGE (net gepauzeerde)
// nummer kan al vóór `speler.pause()` door de browser in de wachtrij zijn gezet, en dan pas ná deze `start()`-
// aanroep alsnog vuren - `bijwerken()` (hieronder) gebruikt `overwrite:true`, dus zo'n verlate, stale event
// kapte de net-gestarte, callback-dragende needle-drop-tween af en verving 'm door een tween zónder
// `onComplete` - `startAfspelen()` (in js/jukebox.js) werd dan nooit aangeroepen, het nummer bleef stil
// staan. Bevestigd via CDP-trace: `bijwerken()` vuurde met exact de laatste `currentTime` van het vórige
// nummer, vlak na `start()`'s tween-aanmaak, zonder dat `onComplete` ooit volgde. Verklaart ook waarom dit
// afwisselend optrad: een mislukte overgang laat #speler stil (gepauzeerd, geen eigen `timeupdate`-ritme
// meer) staan, dus de daaropvolgende overgang heeft niets storends meer te verwerken en lukt juist wél -
// een geslaagde overgang laat #speler juist weer actief `timeupdate` produceren, wat de éérstvolgende
// overgang weer kwetsbaar maakt. Opgelost met `wachtOpStart`: vanaf het moment dat deze drop-tween begint
// tot-en-met zijn `onComplete`, negeert `bijwerken()` elke aanroep - een echte `timeupdate` van het NIEUWE
// nummer kan sowieso nooit vóór deze `onComplete` binnenkomen (`startAfspelen()` draait pas ná `klaar()`),
// dus elke `bijwerken()`-aanroep die hier binnenkomt is per definitie een stale event van het vorige nummer.
function start(klaar) {
  armTransitieBezig = true
  if (draaischijfTween) draaischijfTween.play()
  strobeAan()
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
      onComplete: () => { armTransitieBezig = false; if (klaar) klaar() }
    })
  } else {
    armTransitieBezig = false
    if (klaar) klaar()
  }
}

// **Bug gevonden en gefixt (bij pauzeren ging de toonarm niet naar de ruststand)**: dezelfde stale-
// `timeupdate`-race als bij start() hierboven (zie de uitgebreide toelichting daar), maar dan op het pauze-
// pad. `js/jukebox.js`'s `speelPauze()` roept bij pauzeren eerst `speler.pause()` aan en meteen daarna
// `Turntable.stop()` - maar een `timeupdate`-event dat vlak vóór `speler.pause()` al in de wachtrij stond
// kan alsnog ná deze aanroep vuren. `bijwerken()` (hieronder) gebruikt `overwrite:true`, dus zo'n stale
// event doodde de net-gestarte rust-tween en verving 'm door een "inhaal"-tween terug naar de (bevroren)
// afspeelpositie - de arm bleef daardoor op zijn afspeelplek staan i.p.v. naar rust te liften. Deze functie
// had, in tegenstelling tot start(), nooit een guard tegen deze race. Opgelost door dezelfde
// `armTransitieBezig`-vlag (voorheen `wachtOpStart`, puur voor start() bedoeld) ook hier te zetten/wissen -
// bijwerken() genegeert nu elke aanroep tijdens zowel de needle-drop als de lift.
function stop() {
  armTransitieBezig = true
  if (draaischijfTween) draaischijfTween.pause()
  strobeUit()
  if (toonarmInnerEl) {
    gsap.killTweensOf(toonarmInnerEl)
    gsap.to(toonarmInnerEl, {
      rotation: RUST_HOEK,
      duration: ARM_DROP_DUUR,
      ease: 'power2.out',
      overwrite: true,
      onComplete: () => { armTransitieBezig = false }
    })
  } else {
    armTransitieBezig = false
  }
}

// **Bug gevonden en gefixt (bij een albumwissel via vorige/volgende bleef de toonarm boven de draaischijf
// hangen i.p.v. eerst naar rust te gaan)**: speelIndex() (js/jukebox.js) roept bij elke handmatige
// navigatie Turntable.stop() gevolgd door deze reset() aan, om de arm instant (zonder animatie) naar rust
// te zetten vóórdat toonVinyl() de plaatwissel start. reset() zette armTransitieBezig voorheen zelf ook
// terug op false - dat is precies dezelfde stale-timeupdate-race die hierboven bij start()/stop() al is
// gefixt (zie de toelichting daar), maar dan met een veel groter tijdvenster: bij een albumwissel duurt
// toonVinyl()'s weghaal+neerleg-animatie zo'n 1,8s vóórdat Turntable.start() weer wordt aangeroepen, en in
// die hele tussentijd stond bijwerken() dus gewoon weer open - een timeupdate-event van het net-gepauzeerde
// vorige nummer (met de eigen bereikte currentTime/duration van dát nummer) kon de arm dan alsnog naar een
// middenpositie boven de plaat trekken. Bij een gewone track binnen hetzelfde album viel dit nauwelijks op,
// omdat toonVinyl() daar vrijwel synchroon doorloopt (geen animatie nodig) en het venster dus verwaarloosbaar
// kort is. Opgelost door hier armTransitieBezig niet meer aan te raken - stop()/start() blijven de enige
// plekken die 'm zetten/wissen (zie de toelichting daar), reset() regelt alleen nog de instante visuele
// stand; de guard blijft zo doorlopend actief vanaf stop() tot aan start()'s onComplete.
function reset() {
  laatsteProgressie = 0
  if (toonarmInnerEl) {
    gsap.killTweensOf(toonarmInnerEl)
    gsap.set(toonarmInnerEl, { rotation: RUST_HOEK })
  }
}

// Genegeerd zolang armTransitieBezig aanstaat - zie de uitgebreide toelichting bij start()/stop()
// hierboven. Een timeupdate van vóór díe overgang kan zo geen net-gestarte drop-/lift-tween meer kapen.
function bijwerken(currentTime, duration) {
  if (!toonarmInnerEl || !duration || armTransitieBezig) return
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
// **Bug gevonden en gefixt (vorige/volgende op lokale mp3's bleef op 0:00 staan)**: de "zelfde album"-check
// sloot `coverPad === null` vroeger expliciet uit (zie de toelichting bij huidigeCoverPad hierboven) - elke
// track zonder cover_pad (elke gewone, niet via de Albums-functie geïmporteerde mp3) werd dus altijd als
// "ander album" behandeld, ook t.o.v. de vórige, eveneens coverloze track. Dat triggerde bij élke vorige/
// volgende-klik de volledige weghaal+neerleg-animatie (0.9s + 0.9s) plus, ná toonVinyl()'s klaar()-callback,
// nog eens de needle-drop (1.3s) - ruim 3s stilte per klik. Een volgende klik binnen die tijd (heel
// gebruikelijk) annuleerde de hele keten via speelIndex()'s eigen Turntable.stop()/reset() (zie
// js/jukebox.js), vóórdat startAfspelen() ooit werd aangeroepen - bij een gebruiker die in een tempo sneller
// dan ~3s doorklikte, begon het geluid daardoor structureel nooit. Opgelost door coverPad === null ook als
// "zelfde plaat" te behandelen: visueel verandert er toch niets (dezelfde generieke, coverloze hoes) tussen
// twee coverloze tracks, dus hoeft de plaat niet weggehaald en teruggelegd te worden. Een overgang van/naar
// een échte cover (wél/niet meer null) blijft wél een zichtbare wissel triggeren, want dat is een wel
// degelijk zichtbaar andere hoes.
// Gedeeld door plaatsNieuw() (toonVinyl(), hieronder) en toonHuidigeStandInstant() - beide markeren de plaat
// als "ligt er" en zetten de hoes, alleen de manier waaróp (geanimeerd vs instant) verschilt.
function plaatsCover(coverPad) {
  setAlbumCover(coverPad)
  huidigeCoverPad = coverPad
  vinylZichtbaar = true
}

function toonVinyl(coverPad, klaar) {
  const klaarMelden = () => { if (klaar) klaar() }

  if (vinylZichtbaar && coverPad === huidigeCoverPad) {
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
    plaatsCover(coverPad)
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

// **Bug gevonden en gefixt (album-detail.html: draaitafel-paneel tonen liet de plaat opnieuw "opleggen")**:
// toggleDraaitafelZichtbaar() (js/album-detail.js) riep bij het aanzetten gewoon toonVinyl()+start() aan,
// dezelfde functies als een echte tracklaunch - maar het paneel zichtbaar maken simuleert geen fysieke
// handeling (er wordt geen plaat opgelegd, geen naald neergezet), het toont alleen een al lopende sessie.
// Op gebruikersverzoek: de aankomst-/needle-drop-animaties horen uitsluitend bij een echte start (laadTrack()
// in album-detail.html, resp. speelIndex() in de jukebox), nooit bij het puur zichtbaar maken van een paneel.
// Deze functie zet de plaat/hoes/naald/platter-rotatie in één keer, instant, op de staat die bij de huidige
// afspeelpositie hoort - geen enkele tween, dus geen "opnieuw opgelegd"-illusie.
function toonHuidigeStandInstant(coverPad, progressie, spelend) {
  plaatsCover(coverPad)
  laatsteProgressie = Math.min(1, Math.max(0, progressie))

  if (vinylTween) {
    vinylTween.pause()
    vinylTween.progress(1)
  }
  if (toonarmInnerEl) {
    gsap.killTweensOf(toonarmInnerEl)
    gsap.set(toonarmInnerEl, { rotation: hoekVoorProgressie(laatsteProgressie) })
  }
  if (draaischijfTween) {
    if (spelend) draaischijfTween.play()
    else draaischijfTween.pause()
  }
  if (spelend) strobeAan()
  else strobeUit()
}

window.Turntable = { start, stop, bijwerken, reset, setAlbumCover, toonVinyl, verbergVinyl, verbergVinylInstant, toonHuidigeStandInstant }

initTurntable()
