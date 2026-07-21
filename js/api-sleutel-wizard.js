const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const shell = electron.shell
const clipboard = electron.clipboard
const fs = require('fs')

const SLEUTEL_FORMAAT = /^AIza[0-9A-Za-z_-]{35}$/

const modus = new URLSearchParams(window.location.search).get('modus')
let huidigeStap = 1

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

async function slaOp() {
  const sleutel = document.getElementById('sleutel').value.trim()
  if (!sleutel) {
    document.getElementById('melding').textContent = t('apiSleutelDialoog.leegMelding')
    return
  }
  if (!SLEUTEL_FORMAAT.test(sleutel)) {
    document.getElementById('melding').textContent = t('apiSleutelDialoog.formaatFout')
    return
  }

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
