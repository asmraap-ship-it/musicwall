// Gedeelde HTML-escape-helper, geladen via een eigen <script src>-tag (zelfde patroon als
// js/api-sleutel-foutmapping.js) i.p.v. require() - en als losse `function`-declaratie (niet
// `let`/`const`) zodat een dubbele laadbeurt in dezelfde pagina geen SyntaxError geeft.
// Nodig voor elke plek die externe, door anderen te beinvloeden tekst (YouTube-titels/
// kanaalnamen, ID3-tags) in innerHTML plakt - zie CLAUDE.md en de beveiligingsreview
// van 2026-08-24 (stored DOM-injectie, RCE-equivalent door nodeIntegration:true).
function escapeHtml(tekst) {
  const div = document.createElement('div')
  div.textContent = tekst == null ? '' : String(tekst)
  return div.innerHTML
}

if (typeof window !== 'undefined') {
  window.escapeHtml = escapeHtml
}
