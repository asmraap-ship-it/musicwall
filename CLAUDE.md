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
playlist     (id, lokaal_pad, artiest, titel, volgorde)
```

De `playlist`-tabel (jukebox) staat los van `videos`/`concert_media` — bij toevoegen wordt `lokaal_pad`/`artiest`/`titel` gekopieerd, zodat zowel wall-video's als lokale video's uit concertervaringen toegevoegd kunnen worden. Dedupliceert op `lokaal_pad`. Nieuwe rijen krijgen `volgorde` = hoogste bestaande `volgorde` + 1 (niet `COUNT(*)+1`, dat gaf botsingen na verwijderingen).

## Belangrijke ontwerpkeuzes
- `js/index.js` en `js/concerten.js` worden geladen na `js/achtergrond.js` in index.html
- `ipcRenderer` is gedeclareerd in `js/index.js` — niet opnieuw declareren in andere scripts
- `schakelSectie()` staat alleen in `js/concerten.js` — niet in `js/index.js`
- Tab-knoppen in `index.html` hebben geen `onclick` — eventlisteners worden gezet onderaan `js/concerten.js`
- GSAP animaties altijd controleren op lege NodeList voor aanroep (`kaarten.length > 0`)
- Drag-and-drop: `kaartDrop` stopt propagatie alleen bij dezelfde wall; andere wall laat event doorgaan naar `drop()`

## Thema's
Zes thema's via `data-thema` attribuut op `<html>`: standaard, metaal, jukebox, nacht, jr (Raw), natuur. Opgeslagen in localStorage.

## Volgorde wijzigen via slepen
- **Walls**: sleep aan de `wall-header` (niet de hele wall, om conflict met het bestaande video-drag-and-drop in `.wall-videos` te vermijden) → `wallDragStart`/`wallDragOver`/`wallDragLeave`/`wallDrop`/`wallDragEnd` in `js/index.js`, IPC `sla-wall-volgorde-op` → `herschikWalls()` in `db/walls.js`
- **Concertervaringen**: sleep de hele `.concert-kaart` → `concertDragStart`/`concertDragOver`/`concertDragLeave`/`concertDrop`/`concertDragEnd` in `js/concerten.js`, IPC `sla-concert-volgorde-op` → `herschikConcerten()` in `db/concerten.js`
- Beide volgen hetzelfde patroon als het bestaande video-kaart-slepen (`kaartDrop`): DOM-elementen herordenen op basis van hun index, dan de nieuwe volgorde als array van id's doorsturen

## YouTube zoeken
- Klikken op een zoekresultaat selecteert het (net als Ctrl+klik bij walls/concert-detail), niet direct toevoegen
- Onderin verschijnt een selectiebalk met aantal + knop **"Voeg geselecteerde toe"**; pas dan worden de geselecteerde video's toegevoegd aan de gekozen wall

## Jukebox-gedrag
- Selecteren met **Ctrl+klik** op lokale video's, zowel in een wall-kaart als op een lokale-video-tegel in concert-detail
- Handmatig bladeren (vorige/volgende/eerste/laatste) verwijdert nooit iets uit de playlist
- Een nummer dat **vanzelf** uitspeelt (`ended`-event) wordt automatisch uit de playlist verwijderd; het afspelen gaat daarna verder met het volgende nummer, of springt terug naar het eerste nummer als het laatste was
- Melding "playlist leeg" verschijnt alleen als de lijst na het uitspelen echt leeg is; handmatig doorbladeren tot het einde toont in plaats daarvan "einde van de playlist"

## Wat nog gebouwd moet worden
1. **Tab styling verfijnen** — kleine detailwijzigingen nog gewenst
2. **Nieuwe distributie bouwen** na alle wijzigingen

## ipcMain handlers aanwezig in main.js (selectie)
- `open-nieuw-concert` → opent nieuw-concert.html
- `concert-toegevoegd` → herlaad concerten, sluit venster
- `open-concert-detail` → opent concert-detail.html
- `kies-concert-media` → bestandsdialoog voor foto/video, stuurt paden terug
- `concert-media-toegevoegd` → herlaad concerten
- `concert-media-naar-playlist` → voegt geselecteerde lokale video's uit concert-detail toe aan de jukebox-playlist
- `toevoegen-aan-playlist` → voegt geselecteerde lokale video's uit een wall toe aan de jukebox-playlist
- `sla-volgorde-op` → slaat video volgorde op via slaVolgordeOp()
- `maak-thumbnail` (handle) → ffmpeg thumbnail generatie

## Stijlprincipes
- Donker goudkleurig palet: `--accent: #c8a87a`
- Achtergrond: bijna zwart `#0a0a0a`
- Wall-headers: `linear-gradient(135deg, #252018 0%, #0e0c09 100%)` met clip-path
- Tabs: zelfde gradient als wall-headers, actieve tab met gouden rand
- GSAP voor alle animaties (intro, walls, cards, toggle open/dicht)
- Parallax op walls via mousemove (diepte factor 1)