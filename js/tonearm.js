// Tonearm: geïsoleerde module voor de SVG pick-uparm naast de draaiende vinylplaat in de jukebox (zie
// css/jukebox.css's .vinyl-plaat / CLAUDE.md ## Jukebox-gedrag). Losse <script src>-module i.p.v. require(),
// zelfde reden als js/link-controle.js/js/api-sleutel-foutmapping.js: een require() van een sibling-
// renderer-module is in deze configuratie (nodeIntegration:true, geladen via <script src>) onbetrouwbaar
// gebleken. js/jukebox.js roept window.Tonearm.* rechtstreeks aan vanuit zijn bestaande timeupdate/play/
// pause-listeners op #speler - geen eigen requestAnimationFrame-loop, de arm volgt exact hetzelfde ritme
// als de bestaande voortgangsbalk/tijdweergave.

// -20° = rust op de buitenrand (currentTime === 0), -2° = binnenste groeven (currentTime === duration).
// Oorspronkelijk -20°/-5° (exact zo opgegeven), maar met een realistische armlengte/draaipunt (zie
// CLAUDE.md ## Jukebox-gedrag) kwam de naald dan nooit verder dan ~60% naar het midden - fysiek de max.
// haalbare uitslag bij dat kleine bereik. Op verzoek van de gebruiker verruimd, eerst naar -20°/+10° - maar
// die waarde ging enkel uit van de naald zelf en hield geen rekening met de afmeting van de headshell
// (de rechthoek eromheen): bij -20° stak de achterkant van de headshell dan al bijna buiten de plaatrand,
// en bij +10° lag de naald al ver óver het label. Herberekend met de volle headshell-omtrek als grens, en
// vervolgens nóg een keer bijgesteld (0° → -2°) nadat bleek dat de "optillen"-transitie (zie css/jukebox.css's
// #tonearm-lift, ook zelf gefixt - die verschoof de headshell met tientallen pixels i.p.v. een paar) precies
// bij -0° een héél kleine, maar wel degelijk aanwezige overlap met het label gaf op het natuurlijke einde
// van een nummer (pauzeren/stoppen zet de arm dan omhoog, middenin de -2°-hoek). -2° geeft daar nu ook marge.
const TONEARM_HOEK_RUST = -20
const TONEARM_HOEK_EINDE = -2
const TONEARM_PIVOT_X = 108
const TONEARM_PIVOT_Y = 20
// Iets langer dan de CSS-transitieduur op #tonearm-lift, zodat de "opgetild"-klasse pas verdwijnt nadat de
// visuele lift-beweging zelf al helemaal is afgerond
const TONEARM_LIFT_MS = 360

function tonearmHoek(fractie) {
  const f = Math.min(1, Math.max(0, fractie || 0))
  return TONEARM_HOEK_RUST + (TONEARM_HOEK_EINDE - TONEARM_HOEK_RUST) * f
}

// Rechtstreeks de SVG-transform-attribuutwaarde zetten (niet via CSS/style met een transition) - dat is
// bewust, zodat deze aanroep vanuit timeupdate() de arm ONMIDDELLIJK naar de juiste hoek zet, zonder dat er
// een CSS-transitie tussen elke tick door blijft "inhalen" en de arm achter de audio aan laat lopen
function tonearmBijwerken(currentTime, duration) {
  const groep = document.getElementById('tonearm-rotatie')
  if (!groep) return
  const fractie = duration ? currentTime / duration : 0
  const hoek = tonearmHoek(fractie)
  groep.setAttribute('transform', 'rotate(' + hoek + ' ' + TONEARM_PIVOT_X + ' ' + TONEARM_PIVOT_Y + ')')
}

// Terug naar de ruststand - gebruikt bij het laden van een nieuw nummer en bij expliciet stoppen, zodat de
// arm niet op de hoek van het vórige (mogelijk verder afgespeelde) nummer blijft staan
function tonearmReset() {
  const groep = document.getElementById('tonearm-rotatie')
  if (!groep) return
  groep.setAttribute('transform', 'rotate(' + TONEARM_HOEK_RUST + ' ' + TONEARM_PIVOT_X + ' ' + TONEARM_PIVOT_Y + ')')
}

// Korte lift-overgang vóór het afspelen: de .opgetild-klasse (CSS-transitie op #tonearm-lift, zie
// css/jukebox.css) tilt de arm even op, dan zakt hij vanzelf weer - de horizontale hoek zelf wordt
// ondertussen al gewoon door tonearmBijwerken() bijgehouden via timeupdate, dus die twee bewegingen
// (optillen + horizontaal volgen) lopen onafhankelijk van elkaar
function tonearmStart() {
  const wrap = document.getElementById('tonearm')
  if (!wrap) return
  wrap.classList.add('opgetild')
  clearTimeout(tonearmStart._timer)
  tonearmStart._timer = setTimeout(() => wrap.classList.remove('opgetild'), TONEARM_LIFT_MS)
}

// Bij stoppen/pauzeren blijft de arm bewust opgetild staan (i.p.v. na de transitie weer te zakken) - net
// als bij een echte platenspeler, waar de arm pas weer zakt zodra er opnieuw wordt afgespeeld (tonearmStart()
// verwijdert de klasse dan zelf weer via zijn eigen timer)
function tonearmStop() {
  const wrap = document.getElementById('tonearm')
  if (!wrap) return
  clearTimeout(tonearmStart._timer)
  wrap.classList.add('opgetild')
}

window.Tonearm = {
  bijwerken: tonearmBijwerken,
  reset: tonearmReset,
  start: tonearmStart,
  stop: tonearmStop
}
