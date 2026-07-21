var electron = require('electron')
var ipcRenderer = electron.ipcRenderer
var shell = electron.shell
var clipboard = electron.clipboard
var fs = require('fs')

var SLEUTEL_FORMAAT = /^AIza[0-9A-Za-z_-]{35}$/
var TEST_VIDEO_ID = 'jNQXAC9IVRw'

var modus = new URLSearchParams(window.location.search).get('modus')
var huidigeStap = 1

function openGoogleConsole() {
  shell.openExternal('https://console.cloud.google.com/apis/library/youtube.googleapis.com')
}

function maakApiKey() {
  shell.openExternal('https://console.cloud.google.com/apis/credentials')
}

function plakSleutel() {
  document.getElementById('sleutel').value = clipboard.readText().trim()
}

function toonStap(n) {
  document.querySelectorAll('.sectie').forEach(el => el.classList.remove('zichtbaar'))
  document.getElementById('stap' + n).classList.add('zichtbaar')
  for (let i = 1; i <= 3; i++) {
    document.getElementById('bol-' + i).classList.toggle('actief', i === n)
  }
  document.getElementById('stap-label').textContent = t('apiSleutelDialoog.stapLabel', { n })
  huidigeStap = n
}

function volgendeStap() {
  if (huidigeStap < 3) toonStap(huidigeStap + 1)
}

function vorigeStap() {
  if (huidigeStap > 1) toonStap(huidigeStap - 1)
}

async function initModus() {
  toonStap(1)

  if (modus !== 'wijzig') return

  document.getElementById('titel').textContent = t('apiSleutelDialoog.titelWijzigen')
  document.getElementById('intro').textContent = t('apiSleutelDialoog.introWijzigen')
  document.getElementById('overslaan-link').textContent = t('apiSleutelDialoog.annulerenBtn')

  const instellingenPad = await ipcRenderer.invoke('get-instellingen-pad')
  if (fs.existsSync(instellingenPad)) {
    try {
      const instellingen = JSON.parse(fs.readFileSync(instellingenPad, 'utf8'))
      if (instellingen.youtubeApiKey && !instellingen.youtubeApiKey.includes('VUL_HIER')) {
        document.getElementById('sleutel').value = instellingen.youtubeApiKey
      }
    } catch (e) {}
  }

  toonStap(3)
}

initModus()

document.getElementById('sleutel').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') slaOp()
})

async function testSleutel(sleutel) {
  const url = 'https://www.googleapis.com/youtube/v3/videos?part=id&id=' + TEST_VIDEO_ID + '&key=' + sleutel
  try {
    const response = await fetch(url)
    const json = await response.json()
    return { status: response.status, json }
  } catch (e) {
    return { netwerkfout: true }
  }
}

async function slaOp() {
  const sleutel = document.getElementById('sleutel').value.trim()
  const meldingEl = document.getElementById('melding')
  if (!sleutel) {
    meldingEl.textContent = t('apiSleutelDialoog.leegMelding')
    return
  }
  if (!SLEUTEL_FORMAAT.test(sleutel)) {
    meldingEl.textContent = t('apiSleutelDialoog.formaatFout')
    return
  }

  const opslaanBtn = document.getElementById('opslaan-btn')
  const opnieuwTestenBtn = document.getElementById('opnieuw-testen-btn')
  opslaanBtn.disabled = true
  opnieuwTestenBtn.disabled = true
  meldingEl.textContent = t('apiSleutelDialoog.testBezig')

  const resultaat = await testSleutel(sleutel)
  const foutSleutel = bepaalFoutmelding(resultaat)

  opslaanBtn.disabled = false
  opnieuwTestenBtn.disabled = false

  if (foutSleutel) {
    meldingEl.textContent = t(foutSleutel)
    opnieuwTestenBtn.style.display = 'block'
    return
  }

  opnieuwTestenBtn.style.display = 'none'
  meldingEl.textContent = ''

  const instellingenPad = await ipcRenderer.invoke('get-instellingen-pad')
  let instellingen = {}
  if (fs.existsSync(instellingenPad)) {
    try {
      instellingen = JSON.parse(fs.readFileSync(instellingenPad, 'utf8'))
    } catch (e) {}
  }
  instellingen.youtubeApiKey = sleutel
  fs.writeFileSync(instellingenPad, JSON.stringify(instellingen, null, 2))

  ipcRenderer.send('api-sleutel-venster-sluiten')
}

function overslaan() {
  ipcRenderer.send('api-sleutel-venster-sluiten')
}

window.volgendeStap = volgendeStap
window.vorigeStap = vorigeStap
window.openGoogleConsole = openGoogleConsole
window.maakApiKey = maakApiKey
window.plakSleutel = plakSleutel
window.slaOp = slaOp
window.overslaan = overslaan
