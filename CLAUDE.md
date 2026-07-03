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
db/wallgroepen.js     — CRUD voor wall_groepen, wall-toewijzing en herschikken
db/videos.js          — CRUD voor videos incl. slaVolgordeOp
db/concerten.js       — CRUD voor concerten en concert_media
db/playlist.js        — Jukebox playlist
nieuw-concert.html    — Formulier nieuw concert
js/nieuw-concert.js   — Logica nieuw concert formulier
nieuwe-wallgroep.html — Formulier nieuwe/hernoem wall-groep
js/nieuwe-wallgroep.js — Logica nieuwe/hernoem wall-groep formulier
hernoem-tab.html      — Formulier hernoemen vaste tab (Mijn walls / Mijn concerten)
js/hernoem-tab.js     — Logica hernoemen vaste tab formulier
help.html             — Helpscherm
css/help.css          — Help styling
css/toevoegen.css     — Gedeelde formulier styling
css/themas/           — Zes thema CSS bestanden
sounds/               — click.mp3, whoosh.wav, open.wav
build/icon.ico        — App icoon
```

## Database tabellen
```sql
walls        (id, naam, volgorde, groep_id)
wall_groepen (id, naam, volgorde)
videos       (id, wall_id, type, artiest, titel, verhaal, tag, youtube_url, lokaal_pad, volgorde)
concerten    (id, naam, artiest, datum, verhaal, volgorde)
concert_media (id, concert_id, type, bestand_pad, volgorde)
playlist     (id, lokaal_pad, artiest, titel, volgorde)
```

`walls.groep_id` verwijst (los, geen enforced FK — dit project gebruikt nergens `PRAGMA foreign_keys`) naar `wall_groepen.id`. `NULL` betekent ongegroepeerd. `groep_id` is via migratie toegevoegd (`ALTER TABLE walls ADD COLUMN groep_id INTEGER` in `database.js`, alleen als de kolom nog niet bestaat).

De `playlist`-tabel (jukebox) staat los van `videos`/`concert_media` — bij toevoegen wordt `lokaal_pad`/`artiest`/`titel` gekopieerd, zodat zowel wall-video's als lokale video's uit concertervaringen toegevoegd kunnen worden. Dedupliceert op `lokaal_pad`. Nieuwe rijen krijgen `volgorde` = hoogste bestaande `volgorde` + 1 (niet `COUNT(*)+1`, dat gaf botsingen na verwijderingen).

## Belangrijke ontwerpkeuzes
- `js/index.js` en `js/concerten.js` worden geladen na `js/achtergrond.js` in index.html
- `ipcRenderer` is gedeclareerd in `js/index.js` — niet opnieuw declareren in andere scripts
- `schakelSectie()` staat alleen in `js/concerten.js` — niet in `js/index.js`
- Tab-knoppen `#btn-walls`/`#btn-concerten` in `index.html` hebben geen `onclick` — eventlisteners (click/dblclick/dragover/drop) worden gezet onderaan `js/concerten.js`. De vaste `#btn-nieuwe-groep`-tab (`+`) heeft wél een inline `onclick`, net als de dynamisch aangemaakte groepstabs (die volledig via JS in `laadWallGroepenTabs()` worden opgebouwd)
- GSAP animaties altijd controleren op lege NodeList voor aanroep (`kaarten.length > 0`)
- Drag-and-drop: `kaartDrop` stopt propagatie alleen bij dezelfde wall; andere wall laat event doorgaan naar `drop()`

## Thema's
Zeven thema's via `data-thema` attribuut op `<html>` (leeg attribuut = standaard): standaard, metaal, jukebox, nacht, jr (Raw), natuur, licht. Opgeslagen in `localStorage` (`musicwall-thema`).
- `laadOpgeslagenThema()` in `js/index.js` schrijft bij de allereerste opstart (wanneer de localStorage-key nog niet bestaat, `=== null`) expliciet de standaardwaarde (`''`) terug naar `localStorage`, zodat het gekozen thema vanaf dat moment een bewuste, opgeslagen keuze is in plaats van een impliciete fallback
- Alle donkere thema's (dus alle behalve Licht) zijn gebaseerd op een gematigd-donker palet (achtergronden rond L≈16-20%, niet bijna-zwart) voor beter contrast en leesbaarheid, met behoud van elk thema's eigen kleurkarakter (goud/metaal-blauw/jukebox-rood-goud/nacht-paars/raw-mono/natuur-groen)

## Volgorde wijzigen via slepen
- **Walls**: sleep aan de `wall-header` (niet de hele wall, om conflict met het bestaande video-drag-and-drop in `.wall-videos` te vermijden) → `wallDragStart`/`wallDragOver`/`wallDragLeave`/`wallDrop`/`wallDragEnd` in `js/index.js`, IPC `sla-wall-volgorde-op` → `herschikWalls()` in `db/walls.js`
- **Concertervaringen**: sleep de hele `.concert-kaart` → `concertDragStart`/`concertDragOver`/`concertDragLeave`/`concertDrop`/`concertDragEnd` in `js/concerten.js`, IPC `sla-concert-volgorde-op` → `herschikConcerten()` in `db/concerten.js`
- Beide volgen hetzelfde patroon als het bestaande video-kaart-slepen (`kaartDrop`): DOM-elementen herordenen op basis van hun index, dan de nieuwe volgorde als array van id's doorsturen

## Wall-groepen (dynamische tabs)
- Naast de vaste tabs "Mijn walls" en "Mijn concerten" kunnen gebruikers eigen groepstabs aanmaken (`+`-tab, `voegWallGroepToe()` → `open-nieuwe-wallgroep`) die walls filteren op `groep_id`
- `huidigeGroepId` (let, `js/concerten.js`) bepaalt de actieve filter; `js/index.js`'s `laadWalls()` filtert `getAlleWalls()` op `w.groep_id === huidigeGroepId` (groepstab actief) of `!w.groep_id` (Walls-tab, alleen ongegroepeerd) — leest `huidigeGroepId` via gedeelde script-scope, met een `typeof huidigeGroepId !== 'undefined'` guard omdat `laadWalls()` ook al draait vóórdat `js/concerten.js` geladen is
- **Toewijzen aan een groep**: sleep een wall aan de `wall-header` (hetzelfde `wallId`-dataTransfer-payload als bij het herordenen van walls) naar een groepstab of naar `#btn-walls` (koppelt los, `groep_id = NULL`) — dit gaat rechtstreeks via `verplaatsWallNaarGroep()` in de renderer, geen IPC nodig (net als `drop()`/`verplaatsVideo` voor video's tussen walls)
- **Nieuwe wall terwijl een groepstab actief is**: `voegWallToe()` stuurt `huidigeGroepId` mee via `open-nieuwe-wall` → `stel-groep-in` IPC naar `nieuwe-wall.html`, zodat `maakWall(naam, groepId)` de wall meteen in de juiste groep aanmaakt
- **Groepstabs herordenen**: sleep een tab-knop op een andere (`groepTabId`-dataTransfer-payload, apart van `wallId` zodat beide drop-doelen naast elkaar kunnen bestaan op dezelfde tab-knop) → `herschikGroepTabs()` → IPC `sla-wallgroep-volgorde-op` → `herschikWallGroepen()`
- **Groep verwijderen**: hover + `×` op de tab → bevestiging via `bevestig-wallgroep-verwijderen` (dezelfde `vraagBevestiging()`-popup als walls/concerten) → `verwijderWallGroep()` zet alleen `groep_id = NULL` op de walls erin, verwijdert de walls zelf niet
- **Tabs hernoemen**: dubbelklik op een tab. Voor groepstabs gaat dit via `open-hernoem-wallgroep` → `nieuwe-wallgroep.html` in hernoem-modus (database, `hernoemWallGroep()`). Voor de vaste tabs "Mijn walls"/"Mijn concerten" (geen database-rij) gaat dit via een apart `hernoem-tab.html`/`js/hernoem-tab.js` venster dat de naam terugstuurt via `tab-hernoemd` → `tab-naam-gewijzigd`, opgeslagen in `localStorage` (`musicwall-tab-walls-naam` / `musicwall-tab-concerten-naam`) en toegepast via `pasTabNamenToe()` — verwijdert dan het `data-i18n`-attribuut van het label zodat een taalwissel de aangepaste naam niet overschrijft

## Wall kiezen bij importeren/zoeken
- `importeren.html` en `zoeken.html` tonen eerst een groepskeuze (`#groep-keuze`, gevuld via `getAlleWallGroepen()` + een vaste "ongegroepeerd"-optie met het label van `tabs.walls`), pas daarna een wall-dropdown (`#wall-keuze`) die alleen walls uit de gekozen groep toont (`laadWallsVoorGroep()`) — voorkomt dat alle walls van alle groepen plat in één lijst staan
- Een groep zonder walls toont een disabled placeholder-optie (`wallGroep.geenWalls`); importeren/toevoegen valideert op een geldige `wallId` voordat het doorgaat (`validatie.geenWall`)

## YouTube zoeken
- Klikken op een zoekresultaat selecteert het (net als Ctrl+klik bij walls/concert-detail), niet direct toevoegen
- Onderin verschijnt een selectiebalk met aantal + knop **"Voeg geselecteerde toe"**; pas dan worden de geselecteerde video's toegevoegd aan de gekozen wall

## Jukebox-gedrag
- Selecteren met **Ctrl+klik** op lokale video's, zowel in een wall-kaart als op een lokale-video-tegel in concert-detail
- **Alles selecteren/deselecteren per wall**: een knop in de `wall-header` (naast de verwijder-knop, alleen zichtbaar als de wall lokale video's bevat) roept `toggleSelecteerAlleLokaal(wallId)` aan — selecteert alle lokale video's van die wall als nog niet alles geselecteerd is, anders deselecteert het ze allemaal. Andere walls' selectie blijft ongemoeid
- **Concert-detail**: dezelfde toggle-knop staat in de `media-toevoegen-balk` (`#selecteer-lokale-btn`, alleen zichtbaar als het concert lokale video's heeft) en roept `toggleSelecteerAlleLokaal()` aan voor alle lokale video-tegels van het concert
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
- `open-nieuwe-wallgroep` / `open-hernoem-wallgroep` → opent nieuwe-wallgroep.html in aanmaak- resp. hernoem-modus
- `wallgroep-toegevoegd` → herlaad hoofdscherm, sluit venster
- `bevestig-wallgroep-verwijderen` → bevestiging + verwijderWallGroep()
- `sla-wallgroep-volgorde-op` → herschikWallGroepen()
- `open-hernoem-tab` / `tab-hernoemd` → hernoemen van de vaste "Mijn walls"/"Mijn concerten"-tabs (localStorage, geen database)
- `maak-thumbnail` (handle) → ffmpeg thumbnail generatie

## Stijlprincipes
- Donker goudkleurig palet: `--accent: #c8a87a`
- Achtergrond: gematigd donker `#2b2620` (niet bijna-zwart, zie `## Thema's`)
- Wall-headers: `linear-gradient(135deg, #3a3428 0%, #1f1a12 100%)` met clip-path
- Tabs: zelfde gradient als wall-headers, actieve tab met gouden rand
- GSAP voor alle animaties (intro, walls, cards, toggle open/dicht)
- Parallax op walls via mousemove (diepte factor 1)