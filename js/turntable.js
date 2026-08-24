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
// Opnieuw bijgesteld -23 -> -24.5 (2026-08-22, eerste correctie: de naald bij het starten kwam niet
// helemaal tot de rand van de plaat): een CDP-hermeting liet zien dat de naald bij -23 nog maar op
// r ≈ 274 landde - ín plaats van tussen de vinylrand (r=292) en de eerste groefring (r=278), zoals
// origineel bedoeld - vermoedelijk gedrift door latere, losstaande wijzigingen aan headshell-plaat/de
// armbuis-dikte (die #g251's precieze lokale geometrie beïnvloeden, ook al ligt het kalibratiepunt zelf
// nog op dezelfde coördinaat). Bij -24.5 landde de naald weer op r ≈ 285.7.
// Tweede, fundamentelere correctie, zelfde dag: de gebruiker wees erop dat de headshell "buiten het
// middelpunt van de plaat komt" - simuleer je de volledige zwaai (verder dan alleen START_HOEK/EIND_HOEK),
// dan hoort de naald ergens vlak bij, maar nooit voorbij, het midden te komen. Een CDP-meting van de
// werkelijk getekende armlengte bevestigde dit kwantitatief: de vaste afstand pivot (863,142) -> naaldpunt
// (via #g251, zie hieronder) was 509,1 eenheden, tegenover een pivot-naar-plaatmiddelpunt-afstand van
// 438,8 - de dichtste nadering tot het middelpunt over de volle rotatiecirkel is dus |509,1-438,8|=70,3,
// en die trad pas op bij hoek ≈ +10° (ver voorbij het toen gebruikte bereik). Geen S-curve-beperking,
// puur een te lange effectieve arm. Opgelost bij de bron i.p.v. met een kunstgreep in de hoeken: het
// `translate(...,0)`-onderdeel van #g251's eigen transform (svg/pioneer-plx1000.svg) - dat plaatst de
// headshell op zijn eigen positie tov de buis, los van path246's getekende buiseinde - is verlaagd van
// 33,3 naar -10, wat de naald zo'n 20 eenheden dichter naar de pivot trekt zonder de buis zelf in te
// korten (dus geen zichtbare naad/breuk bij de aansluiting - geverifieerd via CDP-screenshot vóór en na).
// Nieuwe armlengte 468,6, dichtste nadering nu 29,8 (bij hoek ≈ +10°) - "net binnen het midden" i.p.v.
// er ver voorbij.
// Derde correctieronde, nog dezelfde dag: START_HOEK -25°/EIND_HOEK +8° bleken zelf ook niet goed -
// de gebruiker meldde dat de naald bij het starten alsnog bijna buiten de plaat kwam, EN dat de arm aan
// het einde veel te ver ging: er staat een echte labelcirkel getekend in de svg (`circle243`,
// cx=390 cy=395 r=84 - "de plaat met albumhoes-label") en het einde van een nummer hoort daar net
// buiten te blijven, niet er middenin te eindigen (bij +8° landde de naald op r ≈ 40, ruim ín het
// label). Beide hoeken opnieuw doorgemeten (dezelfde CDP-methode: `getScreenCTM()` + de vinylrand als
// schaalreferentie, venster met `show:true`) met een ruimere marge dan de vorige ronde:
// START_HOEK -23° (r ≈ 269,6 - duidelijk binnen zowel de vinylrand 292 als de eerste groefring 278,
// i.p.v. er nog maar net binnen te schrapen) en EIND_HOEK +0.5° (r ≈ 90,9 - net buiten de labelrand 84,
// ruim vóór de werkelijke dichtste-naderingshoek bij +10°). RUST_HOEK (-40) bleef ongewijzigd.
// Vierde correctieronde (2026-08-24): #g251 (de headshell) is 20% vergroot (o.b.v. een referentiefoto,
// "de grootte van de headshell is nu kleiner qua afmeting") - a/b/c/d van g251's matrix-transform
// geschaald met factor 1.2, e/f (translate) ongewijzigd zodat de lokale origin (dicht bij de
// aansluiting op path246) op zijn plek blijft; de rest van de headshell (incl. de naaldpositie, elders
// in g251's lokale coördinaten) groeit daar omheen. Dat verschuift de vaste pivot-naaldafstand, dus
// opnieuw doorgemeten met dezelfde CDP-methode (plain `rotate(deg,863,142)`-attribuut i.p.v. GSAP -
// `require('gsap').gsap` bleek in een los scratchpad-testbestand buiten de projectroot niet op te
// lossen, puur een testharnas-beperking, geen productiecode-issue): **START_HOEK -25°** (r ≈ 284,94,
// nog preciezer op de vinylrand/eerste-groef-marge dan de vorige ronde) en **EIND_HOEK +0.75°**
// (r ≈ 89,33, opnieuw net buiten de labelrand 84). RUST_HOEK (-40) opnieuw ongewijzigd/niet
// herbevestigd nodig (puur decoratief, geen precisie-eis).
// Vijfde correctieronde (2026-08-24, zelfde dag): gebruiker meldde alsnog "de toonarm komt niet goed
// op de plaat". De vorige ronde mat alleen het éne naaldpunt (9.9012225,10.001832, headshell-plaat's
// eigen eerste padpunt) - maar die 20%-vergroting maakt de hele plaat groter, niet alleen dat ene punt:
// de plaat is een fysieke vorm met een echte oppervlakte, en het TEGENOVERGESTELDE hoekpunt (de
// achterkant, dicht bij het buisje/de toonarmbuis) ligt bij START_HOEK -25° op r ≈ 327 - ruim ín de
// stroboscoop-stippenring (die begint bij r ≈ 307, zie svg's #strobo-ring-*-groepen) i.p.v. op de
// vinyl zelf. Visueel (CDP-screenshot, needle-drop-tip.png in scratchpad) hing daardoor het grootste
// deel van de headshell-plaat over de platterrand/stippenring, met maar een klein hoekje nog op zwart
// vinyl - precies het "komt niet goed op de plaat"-effect. Losgelost door BEIDE hoekpunten (niet alleen
// het naaldpunt) te bewaken: bij elke testhoek zowel het naaldpunt (front, dichtst bij vinylcentrum) als
// het verste bbox-hoekpunt van headshell-plaat (back, verst van vinylcentrum) gemeten. START_HOEK -19°
// geeft front r ≈ 239,5 (ruim binnen vinylrand 292, ruim buiten labelrand 84) én back r ≈ 285,6 (net
// bínnen de vinylrand, dus de hele plaat past nu op de vinyl, geen overlap meer met de stippenring).
// EIND_HOEK (+0.75°, front r ≈ 89,9, back r ≈ 144,9) bleef ongewijzigd - bij de binnenste groef speelt
// dit probleem niet, daar zit geen decoratieve ring in de weg. RUST_HOEK (-40) ongewijzigd.
// Zesde correctieronde (2026-08-24, zelfde dag, twee iteraties op basis van live feedback ín de app
// i.p.v. losse CDP-screenshots): START_HOEK -19° bleek een overcorrectie - de gebruiker gaf aan dat de
// headshell nu juist veel te ver van de plaatrand af kwam (front r ≈ 239,5, een ruime 53 eenheden
// binnen de vinylrand 292). De achterkant-tegen-de-stippenring-constraint uit de vijfde ronde woog dus
// zwaarder mee dan wat de gebruiker in de praktijk wilde zien: liever de naald duidelijk zichtbaar op/
// nabij de buitenste rand, ook als de achterkant van de plaat daarbij wat verder in de stippenring komt.
// Eerst teruggezet naar -24° (front r ≈ 277,4, rond de eerste-groefring-marge 278), waarna de gebruiker
// nog een kleine correctie in dezelfde richting vroeg ("nog iets verder, nu komt hij precies op de
// rand") - eerst naar **-24,5°** (front r ≈ 281,2), maar de gebruiker gaf daarna aan dat dit weer te
// ver naar buiten was ("nog steeds niet goed, meer naar binnen met de hoek") - **START_HOEK -22°**
// (front r ≈ 262,3, back r ≈ 306,4) is de huidige stand, middenin het eerder beproefde bereik tussen
// -19° (te ver naar binnen) en -24,5° (te ver naar buiten).
const RUST_HOEK = -40
const START_HOEK = -22
const EIND_HOEK = 0.75
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

// Fysieke nominale snelheden (rpm) - vóór de `let`-variabelen hierbeneden gedefinieerd omdat
// currentSpeed (verderop) hier al bij initialisatie naar verwijst. Ook gebruikt door setStroboPitch()/
// STROBO_RING_GROEPEN (zie de stroboscoop-sectie verderop) en nu ook door de platter-rotatiesnelheid zelf
// (draaischijfTween hieronder) - vroeger draaide de platter altijd op een losse, afgeronde RPM_DEFAULT=33
// i.p.v. de fysiek correcte 33⅓, want er was nog geen snelheidskeuze; nu beide op dezelfde bron leunen
// voorkomt dat platter-rotatie en stroboscoopringen ooit uit sync raken.
const STROBO_RPM_3313 = 33.333
const STROBO_RPM_45 = 45

// Echte TEMPO-fader (2026-08-24) - rail-ijkpunten opgemeten in svg/pioneer-plx1000.svg (lokale
// coördinaten van de fader-groep, geen extra transform nodig): TOP = volle uitslag omhoog (-range%),
// ZERO = midden (valt samen met het gele nulpunt-blokje/de RESET-knop-hoogte), BOTTOM = volle uitslag
// omlaag (+range%). Twee-segments-lineair (TOP->ZERO, ZERO->BOTTOM) i.p.v. één rechte lijn TOP->BOTTOM,
// zodat 0% altijd exact op de gele nulmarkering landt ondanks een kleine, bestaande asymmetrie in de
// getekende schaalstreepjes (de -8-streep zit net iets dichter bij 0 dan de +8-streep).
const TEMPO_RAIL_TOP_Y = 451.95386
const TEMPO_RAIL_ZERO_Y = 566.09399
const TEMPO_RAIL_BOTTOM_Y = 683.07532
// #tempo-handle's 6 kind-elementen zijn getekend op hun eigen, vaste y (rusthoogte) - dat komt al
// nagenoeg overeen met TEMPO_RAIL_ZERO_Y (center ≈568.01, verschil <2 eenheden, onzichtbaar), dus die
// getekende stand IS de 0%-referentie waar een translate(0,dy) vanaf rekent.
const TEMPO_HANDLE_REST_CENTER_Y = 555.03333 + 25.958475 / 2

let draaischijfEl = null
let vinylEl = null
let toonarmInnerEl = null
let coverPlaceholderEl = null
let coverIcoonEl = null
let coverImageEl = null
let strobeGloedEl = null
let strobeRingsWrap = null
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
// 33⅓/45-toerenwissel (2026-08-15): currentSpeed is de enige bron van waarheid voor "welke snelheid staat
// er nu geselecteerd" - zowel de platter-rotatiesnelheid (draaischijfTween's timeScale, zie setSpeed()
// hieronder) als de stroboscoopringen (pasStroboRingModusToe(), zie de toelichting daar) lezen hieruit,
// zodat ze per definitie nooit uit sync kunnen raken.
// Begint op 33⅓ omdat de "33"-knop in de svg-tekening zelf al als geselecteerd is opgemaakt
// (.speed-actief op #speed-33-btn, zie svg/pioneer-plx1000.svg).
let currentSpeed = STROBO_RPM_3313
let speed33BtnEl = null
let speed45BtnEl = null
// Echte TEMPO-fader/TEMPO RANGE (2026-08-24) - currentTempoFraction (-1..+1) is de positie langs de
// rail, ONAFHANKELIJK van het gekozen bereik (net als op echte hardware: de fysieke schuifstand blijft
// staan als je van bereik wisselt, alleen het percentage dat die stand vertegenwoordigt verandert).
// currentTempoRange begint op 16 omdat de "±16"-knop in de svg-tekening zelf al als geselecteerd is
// opgemaakt (.tempo-range-actief op #tempo-range-16-btn).
let currentTempoFraction = 0
let currentTempoRange = 16
let tempoChangeCallback = null
let tempoDragging = false
let tempoHandleEl = null
let tempoRailEl = null
let tempoResetBtnEl = null
let tempoRange8BtnEl = null
let tempoRange16BtnEl = null
let tempoRange50BtnEl = null
let svgRootEl = null
// START/STOP-knop (2026-08-24) - startStopClickCallback is venster-onafhankelijk (net als
// tempoChangeCallback hierboven): js/turntable.js weet niets van speelPauze()/albumSpeelPauze(), elk
// venster registreert zijn eigen functie via window.Turntable.onStartStopClick(cb).
let startStopClickCallback = null
let startStopBtnEl = null

function hoekVoorProgressie(progressie) {
  const p = Math.min(1, Math.max(0, progressie))
  return START_HOEK + (EIND_HOEK - START_HOEK) * p
}

// Blauw stroboscooplicht: twee losstaande mechanismen, bewust niet gekoppeld (zie ook de toelichting bij
// #strobo-rings/#strobo-glow in svg/pioneer-plx1000.svg).
// (1) De LED-gloed (#strobo-glow) - een vast, niet-roterend blauw gloeivlekje bovenop de ring, dat puur
//     aan/uit gaat (de LED van een echte platenspeler licht alleen op zolang de motor draait). Gekoppeld
//     aan exact dezelfde plekken die de platter-rotatie zelf al starten/stoppen (start()/stop()/
//     toonHuidigeStandInstant() hieronder) - geen nieuw, los aanroeppad vanuit js/jukebox.js of
//     js/album-detail.js nodig. Aan/uit gaat via de .strobe-actief-CSS-klasse (#strobe-stijl in de svg);
//     hier alleen de klasse togglen plus een zachte knipper-tween op de opacity. Eén langlevende tween,
//     net als draaischijfTween/vinylTween hierboven - alleen play()/pause(), niet steeds opnieuw
//     aanmaken.
// (2) De vier ringen zelf (#strobo-rings, setStroboPitch() verderop) - draaien NIET mee met
//     strobeAan/strobeUit, die volgen uitsluitend de geselecteerde snelheid + pitch.
//
// Aan/uit-knop voor de gloed (decoratieve UI-toggle, op een echt apparaat zit hier geen schakelaar op - de
// LED gaat gewoon mee met de motor/voeding). strobeAan()/strobeUit() blijven het enige aanroeppad vanuit
// start()/stop()/toonHuidigeStandInstant() - geen nieuw aanroeppad daar. In plaats daarvan onthoudt
// laatstSpelend hier alleen "speelt de plaat op dit moment af", en pasStrobeGloedToe() combineert dat met
// de losse stroboZichtbaar-voorkeur (gezet via setStroboZichtbaar(), aangeroepen vanuit js/jukebox.js/
// js/album-detail.js op basis van hun eigen localStorage-voorkeur) - de gloed is alleen daadwerkelijk aan
// als beide waar zijn.
let laatstSpelend = false
let stroboZichtbaar = true

function pasStrobeGloedToe() {
  if (!strobeGloedEl) return
  if (laatstSpelend && stroboZichtbaar) {
    strobeGloedEl.classList.add('strobe-actief')
    if (!strobeTween) {
      strobeTween = gsap.fromTo(strobeGloedEl,
        { opacity: 0.55 },
        { opacity: 1, duration: 0.45, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true })
    }
    strobeTween.play()
  } else {
    strobeGloedEl.classList.remove('strobe-actief')
    if (strobeTween) strobeTween.pause()
    gsap.set(strobeGloedEl, { opacity: 1 })
  }
}

// START/STOP-knop se ledGlow-rand volgt laatstSpelend - zelfde bron als de stroboscoop-gloed, dus
// hier meteen mee aangeroepen i.p.v. een los, derde aanroeppad ergens anders toe te voegen.
function pasStartStopToe() {
  if (!startStopBtnEl) return
  startStopBtnEl.classList.toggle('start-stop-speelt', laatstSpelend)
}

function strobeAan() {
  laatstSpelend = true
  pasStrobeGloedToe()
  pasStroboRingModusToe()
  pasStartStopToe()
}

function strobeUit() {
  laatstSpelend = false
  pasStrobeGloedToe()
  pasStroboRingModusToe()
  pasStartStopToe()
}

function setStroboZichtbaar(zichtbaar) {
  stroboZichtbaar = !!zichtbaar
  pasStrobeGloedToe()
  pasStroboRingModusToe()
}

// Vier stroboscoopringen (33⅓rpm/50Hz, 33⅓rpm/60Hz, 45rpm/50Hz, 45rpm/60Hz - zie svg/pioneer-plx1000.svg's
// #strobo-rings), elk permanent zichtbaar en onafhankelijk aangestuurd, maar altijd in paren van twee
// (de twee ringen van dezelfde fysieke snelheid gedragen zich per definitie identiek - ze verschillen
// alleen in stippenaantal, niet in draaisnelheid). STROBO_RPM_3313/STROBO_RPM_45 staan nu bovenaan dit
// bestand (currentSpeed heeft ze al nodig vóór dit punt), hier alleen nog STROBO_RING_GROEPEN zelf.
const STROBO_RING_GROEPEN = [
  { ids: ['strobo-ring-3313-50', 'strobo-ring-3313-60'], nominalRpm: STROBO_RPM_3313 },
  { ids: ['strobo-ring-45-50', 'strobo-ring-45-60'], nominalRpm: STROBO_RPM_45 }
]

// Stroboscoopring-rotatie, volledig los van de platter-rotatie zelf (draaischijfTween hierboven draait op
// zijn eigen, door setSpeed() bestuurde timeScale). Op een echt apparaat lijkt elke gedrukte stippenring
// onder stroboscooplicht stil te staan zodra de wérkelijke rotatiesnelheid precies zijn eigen fysieke
// nominale snelheid (33⅓ of 45) is, en langzaam mee/terug te "kruipen" zodra dat niet zo is - dus
// bijvoorbeeld het 45rpm-ringenpaar bevriest wanneer de plaat op 45 rpm draait, terwijl het 33⅓-paar dan
// juist zichtbaar drift, en andersom. Dat natuurkundig nabootsen met echte flikkerende belichting +
// schermverversing is onbetrouwbaar/onnodig complex in een browser; in plaats daarvan wordt de wérkelijke
// rotatiesnelheid uitgerekend uit de geselecteerde nominale snelheid + de pitch-afwijking, en per ring
// vergeleken met diens éígen fysieke nominale snelheid (dus NIET simpelweg pitch% van elke ring z'n eigen
// snelheid apart - dat zou bij pitch 0% alle vier de ringen tegelijk laten bevriezen, ongeacht welke
// snelheid geselecteerd is, wat niet overeenkomt met een echt apparaat). Bij drift 0 staat de animatie op
// 'paused' (ring oogt stilstaand); bij een afwijking draait de ring in `60 / |drift|` seconden per
// omwenteling, mee bij positieve drift, terug bij negatieve.
// Sinds de echte TEMPO-fader (2026-08-24) is pitchPercent niet meer altijd 0 - pasTempoFractieToe()/
// setTempoRange() verderop roepen deze functie aan met het daadwerkelijke fader-percentage.
// `geselecteerdeNominaalRpm` volgt sinds de 33⅓/45-toerenwissel (setSpeed() verderop) de daadwerkelijk
// gekozen snelheid, i.p.v. altijd hardcoded STROBO_RPM_3313.
function setStroboPitch(pitchPercent, geselecteerdeNominaalRpm) {
  if (!strobeRingsWrap) return
  const actueleRpm = geselecteerdeNominaalRpm * (1 + pitchPercent / 100)
  STROBO_RING_GROEPEN.forEach(({ ids, nominalRpm }) => {
    const drift = actueleRpm - nominalRpm
    ids.forEach(id => strobeRingSet(id, drift))
  })
}

function strobeRingSet(id, drift) {
  const el = strobeRingsWrap.querySelector('#' + id)
  if (!el) return
  if (!drift) {
    el.style.setProperty('--strobo-state', 'paused')
    return
  }
  el.style.setProperty('--strobo-duration', `${60 / Math.abs(drift)}s`)
  el.style.setProperty('--strobo-direction', drift > 0 ? 'normal' : 'reverse')
  el.style.setProperty('--strobo-state', 'running')
}

const STROBO_RING_IDS = ['strobo-ring-3313-50', 'strobo-ring-3313-60', 'strobo-ring-45-50', 'strobo-ring-45-60']

// Echt aan/uit-gedrag van de stroboscoopbelichting (2026-08-15). Tot nu toe simuleerde setStroboPitch()
// hierboven altijd het "licht AAN"-effect (scherp, traag driftend o.b.v. het snelheidsverschil) - maar op
// een echt apparaat is dat een illusie die uitsluitend ontstaat DOOR het knipperende stroboscooplicht op
// netfrequentie; zonder dat licht draait de platter gewoon door op volle snelheid en zijn de losse
// stipjes te snel om te volgen (vervagen). Bewust GEEN nieuwe POWER-knop hiervoor gebouwd - deze app heeft
// nergens een echt aan/uit-schakelaar-concept (de POWER-knop op de svg is decoratief, geen click-handler),
// en er bestond al een vrijwel identiek decoratief UI-toggle-concept voor dit exacte licht: de bestaande
// 💡-knop/stroboZichtbaar-voorkeur (zie pasStrobeGloedToe() hierboven, ooit gebouwd voor de LED-gloed).
// Die wordt hier hergebruikt i.p.v. een tweede, overlappende schakelaar te bouwen.
// AAN (stroboZichtbaar): ongewijzigd bestaand gedrag via setStroboPitch(). UIT: geen .strobo-fast-blur-
// klasse meer nodig op basis van drift - elke ring draait gewoon "normaal" mee op de werkelijke,
// actuele platter-rpm (currentSpeed), en de svg/#strobe-stijl-CSS vervaagt (blur + verlaagde opacity) elke
// ring-<g> als geheel zodra .strobo-fast-blur op #strobo-rings staat - dat blurt vier <g>-elementen i.p.v.
// een blur-filter op elk van de ~690 losse <ellipse>-stipjes apart te zetten, veel goedkoper om te
// renderen voor exact hetzelfde visuele resultaat.
// **Bug gevonden en gefixt (2026-08-15, door de gebruiker gemeld): de ringen bleven driften/vervagen
// terwijl de muziek gepauzeerd/gestopt was** - deze functie las tot dan toe alleen stroboZichtbaar,
// nooit laatstSpelend, dus de "licht aan"-drift-illusie (of de "licht uit"-vervaging) bleef gewoon actief
// ook al stond de platter zelf allang stil (draaischijfTween.pause() in stop() hierboven raakt #strobo-
// rings niet aan, dat is een volledig losse animatie). Nu wordt strobeAan()/strobeUit() (dezelfde vaste
// call-sites als altijd, zie de "nooit een tweede aanroeppad"-regel) ook hier aangeroepen, en bevriest
// deze functie alle vier de ringen zodra laatstSpelend false is - net zoals een echte, stilstaande
// platter geen enkele stroboscoopring meer laat driften, ongeacht licht aan/uit.
function pasStroboRingModusToe() {
  if (!strobeRingsWrap) return
  if (!laatstSpelend) {
    strobeRingsWrap.classList.remove('strobo-fast-blur')
    STROBO_RING_IDS.forEach(id => strobeRingSet(id, 0))
    return
  }
  if (stroboZichtbaar) {
    strobeRingsWrap.classList.remove('strobo-fast-blur')
    // Niet hardcoded 0 (2026-08-24) - anders zou het aan/uit-togglen van dit licht of het wisselen van
    // 33⅓/45 de ringen laten "vergeten" dat de TEMPO-fader ergens anders dan 0% staat.
    setStroboPitch(huidigTempoPercent(), currentSpeed)
  } else {
    strobeRingsWrap.classList.add('strobo-fast-blur')
    const duur = `${60 / currentSpeed}s`
    STROBO_RING_IDS.forEach(id => {
      const el = strobeRingsWrap.querySelector('#' + id)
      if (!el) return
      el.style.setProperty('--strobo-duration', duur)
      el.style.setProperty('--strobo-direction', 'normal')
      el.style.setProperty('--strobo-state', 'running')
    })
  }
}

// 33⅓/45-toerenwissel: klikken op #speed-33-btn/#speed-45-btn (svg/pioneer-plx1000.svg) roept dit aan.
// Puur visueel/decoratief - heeft geen effect op de daadwerkelijke afspeelsnelheid van het audiobestand
// (dat wordt uitsluitend door de TEMPO-fader/TEMPO RANGE bestuurd, zie pasTempoFractieToe() verderop).
// timeScale i.p.v. draaischijfTween opnieuw
// aan te maken of zijn duration() te wijzigen: timeScale verandert het tempo vanaf de huidige rotatiehoek,
// zonder de rotatie zelf te resetten of te laten springen - en gsap.to() erop geeft een korte, vloeiende
// op-/afbouw (alsof de motor van toerental wisselt) i.p.v. een abrupte tempowissel.
function setSpeed(rpm) {
  if (rpm === currentSpeed) return
  currentSpeed = rpm
  if (draaischijfTween) {
    gsap.to(draaischijfTween, {
      timeScale: rpm / STROBO_RPM_3313,
      duration: 0.5,
      ease: 'power1.inOut',
      overwrite: true
    })
  }
  // pasStroboRingModusToe() (niet rechtstreeks setStroboPitch) - bij stroboZichtbaar bevriest/drift het
  // juiste ringenpaar zoals voorheen, bij licht-uit draait alles gewoon mee op de nieuwe currentSpeed.
  pasStroboRingModusToe()
  bijwerkenSpeedKnoppen()
}

function bijwerkenSpeedKnoppen() {
  if (speed33BtnEl) speed33BtnEl.classList.toggle('speed-actief', currentSpeed === STROBO_RPM_3313)
  if (speed45BtnEl) speed45BtnEl.classList.toggle('speed-actief', currentSpeed === STROBO_RPM_45)
}

// Echte TEMPO-fader/TEMPO RANGE (2026-08-24): slepen aan #tempo-handle (of klikken op de rail zelf,
// #rect-tempo-vlak - beide via dezelfde mousedown-handler in initTurntable() hieronder) stuurt de
// werkelijke afspeelsnelheid aan via een geregistreerde callback (onTempoChange, zie window.Turntable
// hieronder) - js/jukebox.js/js/album-detail.js zetten daar zelf speler.playbackRate mee, deze module
// weet niets van het <audio>-element van het aanroepende venster.
function huidigTempoPercent() {
  return currentTempoFraction * currentTempoRange
}

// Twee-segments-lineair (TOP->ZERO, ZERO->BOTTOM), zie de toelichting bij de TEMPO_RAIL_*-constanten
// hierboven voor waarom niet één rechte lijn TOP->BOTTOM.
function fractionToCenterY(fraction) {
  if (fraction <= 0) return TEMPO_RAIL_TOP_Y + (fraction + 1) * (TEMPO_RAIL_ZERO_Y - TEMPO_RAIL_TOP_Y)
  return TEMPO_RAIL_ZERO_Y + fraction * (TEMPO_RAIL_BOTTOM_Y - TEMPO_RAIL_ZERO_Y)
}

function yToFraction(y) {
  const geklemd = Math.min(TEMPO_RAIL_BOTTOM_Y, Math.max(TEMPO_RAIL_TOP_Y, y))
  let fraction
  if (geklemd <= TEMPO_RAIL_ZERO_Y) {
    fraction = -1 + (geklemd - TEMPO_RAIL_TOP_Y) / (TEMPO_RAIL_ZERO_Y - TEMPO_RAIL_TOP_Y)
  } else {
    fraction = (geklemd - TEMPO_RAIL_ZERO_Y) / (TEMPO_RAIL_BOTTOM_Y - TEMPO_RAIL_ZERO_Y)
  }
  return Math.min(1, Math.max(-1, fraction))
}

// clientY (muisevent-coördinaat) -> svg user-space y, via de svg-root z'n eigen screen-CTM - de
// standaard, betrouwbare DOM-API hiervoor (houdt vanzelf rekening met viewBox-schaling en de vh-
// gebaseerde CSS-breedte van #turntable-svg-wrap).
function clientYNaarSvgY(clientY) {
  if (!svgRootEl) return TEMPO_RAIL_ZERO_Y
  const pt = svgRootEl.createSVGPoint()
  pt.x = 0
  pt.y = clientY
  const ctm = svgRootEl.getScreenCTM()
  if (!ctm) return TEMPO_RAIL_ZERO_Y
  return pt.matrixTransform(ctm.inverse()).y
}

function bijwerkenTempoHandle(animate) {
  if (!tempoHandleEl) return
  const dy = fractionToCenterY(currentTempoFraction) - TEMPO_HANDLE_REST_CENTER_Y
  if (animate) {
    gsap.to(tempoHandleEl, { y: dy, duration: 0.3, ease: 'power2.out', overwrite: true })
  } else {
    gsap.killTweensOf(tempoHandleEl)
    gsap.set(tempoHandleEl, { y: dy })
  }
}

// animate: alleen true bij RESET (een korte tween oogt als een gemotoriseerde terugkeer) - tijdens het
// slepen zelf moet de knop 1-op-1 de muis volgen, nooit vertraagd door een tween.
function pasTempoFractieToe(fraction, animate) {
  currentTempoFraction = Math.min(1, Math.max(-1, fraction))
  bijwerkenTempoHandle(animate)
  setStroboPitch(huidigTempoPercent(), currentSpeed)
  if (tempoChangeCallback) tempoChangeCallback(huidigTempoPercent())
}

// TEMPO RANGE wisselen verplaatst de schuifknop bewust NIET - zelfde gedrag als een echt fysiek
// apparaat: de fysieke stand blijft staan, alleen het percentage dat die stand vertegenwoordigt
// verandert mee met het nieuwe bereik.
function setTempoRange(range) {
  if (range === currentTempoRange) return
  currentTempoRange = range
  bijwerkenTempoRangeKnoppen()
  setStroboPitch(huidigTempoPercent(), currentSpeed)
  if (tempoChangeCallback) tempoChangeCallback(huidigTempoPercent())
}

function bijwerkenTempoRangeKnoppen() {
  if (tempoRange8BtnEl) tempoRange8BtnEl.classList.toggle('tempo-range-actief', currentTempoRange === 8)
  if (tempoRange16BtnEl) tempoRange16BtnEl.classList.toggle('tempo-range-actief', currentTempoRange === 16)
  if (tempoRange50BtnEl) tempoRange50BtnEl.classList.toggle('tempo-range-actief', currentTempoRange === 50)
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
  strobeGloedEl = wrap.querySelector('#strobo-glow')
  strobeRingsWrap = wrap.querySelector('#strobo-rings')
  speed33BtnEl = wrap.querySelector('#speed-33-btn')
  speed45BtnEl = wrap.querySelector('#speed-45-btn')
  svgRootEl = wrap.querySelector('svg')
  tempoHandleEl = wrap.querySelector('#tempo-handle')
  tempoRailEl = wrap.querySelector('#rect-tempo-vlak')
  tempoResetBtnEl = wrap.querySelector('#tempo-reset-btn')
  tempoRange8BtnEl = wrap.querySelector('#tempo-range-8-btn')
  tempoRange16BtnEl = wrap.querySelector('#tempo-range-16-btn')
  tempoRange50BtnEl = wrap.querySelector('#tempo-range-50-btn')
  startStopBtnEl = wrap.querySelector('#start-stop-schaduw')

  if (!draaischijfEl || !vinylEl || !toonarmInnerEl) {
    console.error('Turntable: #draaischijf, #vinyl of #toonarm-inner niet gevonden in de geïnjecteerde svg')
    return
  }

  if (speed33BtnEl) speed33BtnEl.addEventListener('click', () => setSpeed(STROBO_RPM_3313))
  if (speed45BtnEl) speed45BtnEl.addEventListener('click', () => setSpeed(STROBO_RPM_45))
  bijwerkenSpeedKnoppen()

  // TEMPO-fader slepen + klikken-op-de-rail (2026-08-24) - mousedown op zowel de knop zelf als het
  // rail-vlak eromheen springt meteen naar die positie (dekt "klik = spring ernaartoe" én de eerste
  // sleepstap); de daaropvolgende mousemove/mouseup zitten op document (één keer geregistreerd, no-op
  // als er niet gesleept wordt) zodat het slepen ook buiten de svg zelf blijft werken als de muis
  // eventjes van de rail af beweegt.
  const tempoMousedown = (event) => {
    tempoDragging = true
    pasTempoFractieToe(yToFraction(clientYNaarSvgY(event.clientY)), false)
    event.preventDefault()
  }
  if (tempoHandleEl) tempoHandleEl.addEventListener('mousedown', tempoMousedown)
  if (tempoRailEl) tempoRailEl.addEventListener('mousedown', tempoMousedown)
  document.addEventListener('mousemove', (event) => {
    if (!tempoDragging) return
    pasTempoFractieToe(yToFraction(clientYNaarSvgY(event.clientY)), false)
  })
  document.addEventListener('mouseup', () => { tempoDragging = false })

  if (tempoResetBtnEl) tempoResetBtnEl.addEventListener('click', () => pasTempoFractieToe(0, true))
  if (tempoRange8BtnEl) tempoRange8BtnEl.addEventListener('click', () => setTempoRange(8))
  if (tempoRange16BtnEl) tempoRange16BtnEl.addEventListener('click', () => setTempoRange(16))
  if (tempoRange50BtnEl) tempoRange50BtnEl.addEventListener('click', () => setTempoRange(50))
  bijwerkenTempoRangeKnoppen()
  bijwerkenTempoHandle(false)

  // START/STOP-knop (2026-08-24) - roept alleen de geregistreerde callback aan, geen eigen
  // play/pause-logica hier (die hoort bij het aanroepende venster, zie window.Turntable.onStartStopClick).
  if (startStopBtnEl) startStopBtnEl.addEventListener('click', () => { if (startStopClickCallback) startStopClickCallback() })
  pasStartStopToe()

  // Zet de ringen op basis van currentSpeed (33⅓ bij opstart) én de stroboZichtbaar-lichtstand - zie
  // pasStroboRingModusToe()'s toelichting hierboven.
  pasStroboRingModusToe()

  gsap.set(toonarmInnerEl, { svgOrigin: ARM_ORIGIN, rotation: RUST_HOEK })

  // Roteert #draaischijf, niet #vinyl rechtstreeks - #vinyl is een geneste child-groep van #draaischijf
  // in svg/pioneer-plx1000.svg (mechanisch: de motor drijft de platter aan, de vinyl draait daar via de
  // slipmat gewoon in mee), dus één rotatie hier volstaat voor beide. Eén keer aangemaakt, daarna alleen
  // play()/pause() - i.p.v. de tween telkens te herscheppen, zodat pauzeren de huidige rotatie vasthoudt
  // en hervatten vloeiend doorloopt (geen jank/reset naar 0). Basis-duration op de 33⅓-snelheid (dus
  // timeScale 1 bij currentSpeed===STROBO_RPM_3313); setSpeed() hierboven wijzigt de timeScale, nooit deze
  // duration zelf - dat zou anders de lopende rotatiehoek laten springen.
  draaischijfTween = gsap.to(draaischijfEl, {
    rotation: '+=360',
    duration: 60 / STROBO_RPM_3313,
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

window.Turntable = {
  start, stop, bijwerken, reset, setAlbumCover, toonVinyl, verbergVinyl, verbergVinylInstant,
  toonHuidigeStandInstant, setStroboPitch, setStroboZichtbaar,
  onTempoChange: (cb) => { tempoChangeCallback = cb },
  getTempoPercent: huidigTempoPercent,
  onStartStopClick: (cb) => { startStopClickCallback = cb }
}

initTurntable()
