# Musicwall

Een persoonlijke Electron desktop-applicatie waarmee je YouTube-video's en lokale video's koppelt aan levensmomenten, georganiseerd in thematische "walls" en concertervaringen. Geïnspireerd op de Wurlitzer MediaPlayer (Flash/ActionScript, 2000–2020).

## Functionaliteit

- **Walls** — groepeer video's (YouTube of lokaal) rond een thema, met een titel, artiest en persoonlijk verhaal per nummer
- **Concertervaringen** — leg concerten vast met foto's, video's en YouTube-clips in een collage, inclusief verhaal, naam en datum
- **Jukebox** — speel je eigen playlist van lokale video's af, met shuffle, vorige/volgende en schermvullende weergave
- **YouTube zoeken & map importeren** — voeg eenvoudig nieuwe content toe aan je walls
- **Zes thema's** — Standaard, Metaal, Jukebox, Nacht, Raw en Licht, elk met een eigen kleurpalet en achtergrondstijl
- **Meertalig** — Nederlands/Engels, automatisch op basis van je systeemtaal, met handmatige wisselknop

## Technische stack

- [Electron](https://www.electronjs.org/) v42
- SQLite via `better-sqlite3`
- [GSAP](https://gsap.com/) voor animaties
- `ffmpeg-static` voor thumbnail-generatie

## Installatie & ontwikkelen

```bash
npm install
npm start
```

Gebruikersdata (database en thumbnails) wordt opgeslagen in `%APPDATA%\Musicwall\`.

## Build

Een distributeerbare Windows-installer bouwen:

```bash
npm run build
```

Het resultaat komt in de map `dist/` te staan (`Musicwall Setup.exe` en een unpacked versie).

## Projectstructuur

```
main.js               Electron main process, alle ipcMain handlers
database.js            SQLite initialisatie, tabel definities
index.html              Hoofdscherm
css/                        Stylesheets, incl. css/themas/ voor de zes thema's
js/index.js               Walls logica, drag-and-drop, GSAP animaties
js/concerten.js         Concertervaringen logica
js/jukebox.js            Jukebox-speler
js/i18n.js + js/vertalingen.js   Meertaligheid (NL/EN)
db/                          CRUD-modules per tabel (walls, videos, concerten, playlist)
build/icon.ico           App-icoon
```

Zie `CLAUDE.md` voor uitgebreide projectcontext en ontwerpkeuzes.
