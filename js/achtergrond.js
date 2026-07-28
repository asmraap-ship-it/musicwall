const canvas = document.getElementById('achtergrond')
const ctx = canvas.getContext('2d')

let deeltjes = []
let lijnen = []
let muis = { x: 0, y: 0 }
const AANTAL_DEELTJES = 80
const AANTAL_LIJNEN = 8

// ~30fps i.p.v. de volle 60fps van requestAnimationFrame - zelfde reden en aanpak als de spectrum-analyzer
// in de jukebox (zie SPECTRUM_INTERVAL_MS in js/jukebox.js): dit draait continu, ook als er verder niets op
// het scherm gebeurt, en deelt zijn renderproces met eventueel open andere vensters (o.a. de jukebox). Beweging
// wordt met dtFactor geschaald naar verstreken tijd, zodat de animatiesnelheid ondanks de lagere framerate
// gelijk blijft aan de oorspronkelijke 60fps-versie.
const ACHTERGROND_INTERVAL_MS = 33
let laatsteTekenTijd = 0
let statischeAchtergrondLaag = null

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  statischeAchtergrondLaag = null
}

function maakDeeltje() {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.5 + 0.3,
    dx: (Math.random() - 0.5) * 0.3,
    dy: (Math.random() - 0.5) * 0.3,
    alpha: Math.random() * 0.5 + 0.1,
    puls: Math.random() * Math.PI * 2,
    pulsTempo: Math.random() * 0.02 + 0.005
  }
}

function maakLijn() {
  const horizontaal = Math.random() > 0.5
  return {
    horizontaal,
    positie: Math.random() * (horizontaal ? canvas.height : canvas.width),
    snelheid: (Math.random() * 0.3 + 0.1) * (Math.random() > 0.5 ? 1 : -1),
    lengte: Math.random() * 200 + 100,
    alpha: Math.random() * 0.15 + 0.05,
    offset: Math.random() * (horizontaal ? canvas.width : canvas.height)
  }
}

function initialiseer() {
  resize()
  deeltjes = []
  lijnen = []
  for (let i = 0; i < AANTAL_DEELTJES; i++) deeltjes.push(maakDeeltje())
  for (let i = 0; i < AANTAL_LIJNEN; i++) lijnen.push(maakLijn())
}

let themaKleuren = null
let diagonaalPatroon = null

function leesThemaKleuren() {
  const stijl = getComputedStyle(document.documentElement)
  const accentRgb = stijl.getPropertyValue('--accent-rgb').trim() || '200, 168, 122'
  const achtergrond = stijl.getPropertyValue('--achtergrond').trim() || '#2b2620'
  themaKleuren = { accentRgb, achtergrond }
  diagonaalPatroon = null
  statischeAchtergrondLaag = null
}

new MutationObserver(() => { themaKleuren = null }).observe(
  document.documentElement, { attributes: true, attributeFilter: ['data-thema'] }
)

function getDeeltjesKleur() {
  if (!themaKleuren) leesThemaKleuren()
  return themaKleuren.accentRgb
}

function hexNaarRgb(hex) {
  const schoon = hex.replace('#', '')
  const getal = parseInt(schoon, 16)
  return [(getal >> 16) & 255, (getal >> 8) & 255, getal & 255]
}

function lichter([r, g, b], factor) {
  return [r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor].map(Math.round)
}

function donkerder([r, g, b], factor) {
  return [r * (1 - factor), g * (1 - factor), b * (1 - factor)].map(Math.round)
}

function rgbNaarCss([r, g, b]) {
  return 'rgb(' + r + ', ' + g + ', ' + b + ')'
}

function maakDiagonaalPatroon() {
  const tegel = document.createElement('canvas')
  tegel.width = 12
  tegel.height = 12
  const tctx = tegel.getContext('2d')
  tctx.strokeStyle = 'rgba(' + getDeeltjesKleur() + ', 0.05)'
  tctx.lineWidth = 1
  tctx.beginPath()
  tctx.moveTo(0, 12)
  tctx.lineTo(12, 0)
  tctx.moveTo(-3, 3)
  tctx.lineTo(3, -3)
  tctx.moveTo(9, 15)
  tctx.lineTo(15, 9)
  tctx.stroke()
  diagonaalPatroon = ctx.createPattern(tegel, 'repeat')
}

// Gradient + patroon zijn per frame identiek (hangen alleen af van thema en canvasgrootte) maar werden
// voorheen elke tick opnieuw opgebouwd en tweemaal over het volledige canvas gefillt - verreweg de duurste
// canvas-bewerking in deze animatie. Nu eenmalig pre-gerenderd op een offscreen laag, per frame alleen nog
// een goedkope drawImage-blit; ongewijzigd resultaat, alleen invalidatie bij resize/themawissel.
function bouwStatischeAchtergrondLaag() {
  const basis = hexNaarRgb(themaKleuren.achtergrond)
  const laag = document.createElement('canvas')
  laag.width = canvas.width
  laag.height = canvas.height
  const lctx = laag.getContext('2d')

  const gradient = lctx.createRadialGradient(
    laag.width * 0.3, laag.height * 0.4, 0,
    laag.width * 0.3, laag.height * 0.4, laag.width * 0.8
  )
  gradient.addColorStop(0, rgbNaarCss(lichter(basis, 0.35)))
  gradient.addColorStop(0.5, rgbNaarCss(basis))
  gradient.addColorStop(1, rgbNaarCss(donkerder(basis, 0.35)))
  lctx.fillStyle = gradient
  lctx.fillRect(0, 0, laag.width, laag.height)

  if (!diagonaalPatroon) maakDiagonaalPatroon()
  lctx.fillStyle = diagonaalPatroon
  lctx.fillRect(0, 0, laag.width, laag.height)

  statischeAchtergrondLaag = laag
}

function tekenAchtergrond() {
  if (!themaKleuren) leesThemaKleuren()
  if (!statischeAchtergrondLaag) bouwStatischeAchtergrondLaag()
  ctx.drawImage(statischeAchtergrondLaag, 0, 0)
}

function tekenDeeltjes(dtFactor) {
  const kleur = getDeeltjesKleur()
  deeltjes.forEach(d => {
    d.puls += d.pulsTempo * dtFactor
    const alpha = d.alpha * (0.6 + 0.4 * Math.sin(d.puls))

    ctx.beginPath()
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(' + kleur + ', ' + alpha + ')'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(d.x, d.y, d.r * 4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(' + kleur + ', ' + alpha * 0.06 + ')'
    ctx.fill()

    d.x += d.dx * dtFactor
    d.y += d.dy * dtFactor
    if (d.x < 0 || d.x > canvas.width) d.dx *= -1
    if (d.y < 0 || d.y > canvas.height) d.dy *= -1
  })
}

function tekenLijnen(dtFactor) {
  const kleur = getDeeltjesKleur()
  lijnen.forEach(l => {
    const gloed = ctx.createLinearGradient(
      l.horizontaal ? l.offset : l.positie,
      l.horizontaal ? l.positie : l.offset,
      l.horizontaal ? l.offset + l.lengte : l.positie,
      l.horizontaal ? l.positie : l.offset + l.lengte
    )
    gloed.addColorStop(0, 'rgba(' + kleur + ', 0)')
    gloed.addColorStop(0.5, 'rgba(' + kleur + ', ' + l.alpha + ')')
    gloed.addColorStop(1, 'rgba(' + kleur + ', 0)')

    ctx.beginPath()
    ctx.strokeStyle = gloed
    ctx.lineWidth = 0.5

    if (l.horizontaal) {
      ctx.moveTo(l.offset, l.positie)
      ctx.lineTo(l.offset + l.lengte, l.positie)
    } else {
      ctx.moveTo(l.positie, l.offset)
      ctx.lineTo(l.positie, l.offset + l.lengte)
    }
    ctx.stroke()

    l.offset += l.snelheid * dtFactor

    if (l.horizontaal) {
      if (l.offset > canvas.width) l.offset = -l.lengte
      if (l.offset < -l.lengte) l.offset = canvas.width
    } else {
      if (l.offset > canvas.height) l.offset = -l.lengte
      if (l.offset < -l.lengte) l.offset = canvas.height
    }
  })
}

function teken(tijdstip) {
  // Eerst de volgende frame al inplannen, ongeacht of dit tick'je zelf werk doet - anders stopt de hele lus
  // zodra er één keer geskipt wordt door de throttle hieronder (zelfde patroon als spectrumTick())
  requestAnimationFrame(teken)

  if (tijdstip - laatsteTekenTijd < ACHTERGROND_INTERVAL_MS) return
  // Math.min(4, ...) vangt een uitzonderlijk grote sprong op (bv. na minimaliseren/tabwissel, waarbij
  // requestAnimationFrame een tijd stilligt) - zonder deze clamp zouden deeltjes/lijnen in één keer een groot
  // stuk verspringen i.p.v. gewoon een gemiste periode over te slaan
  const dtFactor = laatsteTekenTijd === 0 ? 1 : Math.min(4, (tijdstip - laatsteTekenTijd) / (1000 / 60))
  laatsteTekenTijd = tijdstip

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  tekenAchtergrond()
  tekenLijnen(dtFactor)
  tekenDeeltjes(dtFactor)
}

window.addEventListener('mousemove', (e) => {
  muis.x = e.clientX
  muis.y = e.clientY
})

window.addEventListener('resize', () => {
  resize()
})

initialiseer()
requestAnimationFrame(teken)