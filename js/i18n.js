function bepaalTaal() {
  const override = localStorage.getItem('musicwall-taal')
  if (override) return override
  const stelselTaal = (navigator.language || 'nl').toLowerCase()
  return stelselTaal.startsWith('nl') ? 'nl' : 'en'
}

let huidigeTaal = bepaalTaal()

function t(sleutel, vervang) {
  let tekst = (VERTALINGEN[huidigeTaal] && VERTALINGEN[huidigeTaal][sleutel]) || VERTALINGEN.nl[sleutel] || sleutel
  if (vervang) {
    Object.keys(vervang).forEach(k => {
      tekst = tekst.split('{' + k + '}').join(vervang[k])
    })
  }
  return tekst
}

function pasVertalingenToe() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'))
  })
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'))
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'))
  })
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'))
  })
}

function wisselTaal(taal) {
  localStorage.setItem('musicwall-taal', taal)
  huidigeTaal = taal
  pasVertalingenToe()
  if (typeof require === 'function') {
    try { require('electron').ipcRenderer.send('taal-gewijzigd', taal) } catch (e) {}
  }
  document.dispatchEvent(new CustomEvent('taal-gewijzigd'))
}

function huidigeTaalCode() {
  return huidigeTaal
}

pasVertalingenToe()

if (typeof require === 'function') {
  try { require('electron').ipcRenderer.send('taal-gewijzigd', huidigeTaal) } catch (e) {}
}

window.t = t
window.wisselTaal = wisselTaal
window.pasVertalingenToe = pasVertalingenToe
window.huidigeTaalCode = huidigeTaalCode
