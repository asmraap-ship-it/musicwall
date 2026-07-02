# Musicwall — Projectcontext voor Claude Code

## Wat is Musicwall?
Een persoonlijke Electron desktop-applicatie waarbij gebruikers YouTube-video's en lokale video's koppelen aan levensmomenten, georganiseerd in thematische "walls" en concertervaringen. Geïnspireerd op de Wurlitzer MediaPlayer (Flash/ActionScript, 2000–2020).

## Technische stack
- Electron v42.5.0
- SQLite via better-sqlite3
- GSAP voor animaties
- ffmpeg-static voor thumbnails
- Gebruikersdata: `%APPDATA%\Musicwall\` (database, thumbnails)
- Projectmap: `C:\Software\Musicwall\`

## Projectstructuur
```
main.js               — Electron main process, alle ipcMain handlers
database.js           — SQLite initialisatie, tabel definities
index.html            — Hoofdscherm
css/index.css         — Hoofdstylesheet
js/index.js           — Walls logica, drag-and-drop, GSAP animaties
js/concerten.js       — Concertervaringen logica, schakelSectie functie
js/achtergrond.js     — Animated canvas achtergrond
db/walls.js           — CRUD voor walls
db/videos.js          — CRUD voor videos incl. slaVolgordeOp
db/concerten.js       — CRUD voor concerten en concert_media
db/playlist.js        — Jukebox playlist
nieuw-concert.html    — Formulier nieuw concert
js/nieuw-concert.js   — Logica nieuw concert formulier
help.html             — Helpscherm
css/help.css          — Help styling
css/toevoegen.css     — Gedeelde formulier styling
css/themas/           — Zes thema CSS bestanden
sounds/               — click.mp3, whoosh.wav, open.wav
build/icon.ico        — App icoon
```

## Database tabellen
```sql
walls        (id, naam, volgorde)
videos       (id, wall_id, type, artiest, titel, verhaal, tag, youtube_url, lokaal_pad, volgorde)
concerten    (id, naam, artiest, datum, verhaal, volgorde)
concert_media (id, concert_id, type, bestand_pad, volgorde)
```

## Belangrijke ontwerpkeuzes
- `js/index.js` en `js/concerten.js` worden geladen na `js/achtergrond.js` in index.html
- `ipcRenderer` is gedeclareerd in `js/index.js` — niet opnieuw declareren in andere scripts
- `schakelSectie()` staat alleen in `js/concerten.js` — niet in `js/index.js`
- Tab-knoppen in `index.html` hebben geen `onclick` — eventlisteners worden gezet onderaan `js/concerten.js`
- GSAP animaties altijd controleren op lege NodeList voor aanroep (`kaarten.length > 0`)
- Drag-and-drop: `kaartDrop` stopt propagatie alleen bij dezelfde wall; andere wall laat event doorgaan naar `drop()`

## Thema's
Zes thema's via `data-thema` attribuut op `<html>`: standaard, metaal, jukebox, nacht, jr (Raw), natuur. Opgeslagen in localStorage.

## Wat nog gebouwd moet worden
1. **Concertervaringen detail-scherm** — `concert-detail.html` en `js/concert-detail.js`
   - Collage weergave van foto's en video's
   - Foto's tonen in lightbox, video's afspelen
   - Verhaal en naam/datum prominent tonen
   - Media toevoegen via `kies-concert-media` handler (al aanwezig in main.js)
2. **Tab styling verfijnen** — kleine detailwijzigingen nog gewenst
3. **Meertaligheid** — Nederlands/Engels op basis van systeemtaal
4. **Nieuwe distributie bouwen** na alle wijzigingen

## ipcMain handlers aanwezig in main.js (selectie)
- `open-nieuw-concert` → opent nieuw-concert.html
- `concert-toegevoegd` → herlaad concerten, sluit venster
- `open-concert-detail` → opent concert-detail.html (nog niet gebouwd)
- `kies-concert-media` → bestandsdialoog voor foto/video, stuurt paden terug
- `concert-media-toegevoegd` → herlaad concerten
- `sla-volgorde-op` → slaat video volgorde op via slaVolgordeOp()
- `maak-thumbnail` (handle) → ffmpeg thumbnail generatie

## Stijlprincipes
- Donker goudkleurig palet: `--accent: #c8a87a`
- Achtergrond: bijna zwart `#0a0a0a`
- Wall-headers: `linear-gradient(135deg, #252018 0%, #0e0c09 100%)` met clip-path
- Tabs: zelfde gradient als wall-headers, actieve tab met gouden rand
- GSAP voor alle animaties (intro, walls, cards, toggle open/dicht)
- Parallax op walls via mousemove (diepte factor 1)