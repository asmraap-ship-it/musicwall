# Musicwall

Een persoonlijke Electron desktop-applicatie waarmee je YouTube-video's en lokale video's koppelt aan levensmomenten, georganiseerd in thematische "walls" en concertervaringen. Geïnspireerd op de Wurlitzer MediaPlayer (Flash/ActionScript, 2000–2020).

## Functionaliteit

- **Walls** — groepeer video's (YouTube of lokaal) rond een thema, met een titel, artiest en persoonlijk verhaal per nummer
- **Wall-groepen** — verdeel walls over eigen tabs (bijv. per thema of gelegenheid), aan te maken en te herordenen naast de vaste "Mijn walls"/"Mijn concerten"-tabs; alle tabs zijn te hernoemen
- **Concertervaringen** — leg concerten vast met foto's, video's en YouTube-clips in een collage, inclusief verhaal, naam en datum
- **Jukebox** — speel je eigen playlist af, lokale video's én YouTube door elkaar, met shuffle, vorige/volgende en schermvullende weergave; een YouTube-nummer dat niet afspeelbaar is wordt automatisch overgeslagen
- **YouTube zoeken & map importeren** — zoek video's of hele playlists (per artiest of genre) direct binnen Musicwall, of importeer een map met lokale bestanden; eerst een groepskeuze zodat je meteen de juiste wall uit de juiste groep kiest
- **Zeven thema's** — Standaard, Metaal, Jukebox, Nacht, Raw, Natuur en Licht, elk met een eigen kleurpalet en achtergrondstijl
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
main.js               Electron main process, alle ipcMain handlers, lokale server voor de YouTube-jukebox-speler
database.js            SQLite initialisatie, tabel definities
index.html              Hoofdscherm
css/                        Stylesheets, incl. css/themas/ voor de zeven thema's
js/index.js               Walls logica, drag-and-drop, GSAP animaties
js/concerten.js         Concertervaringen logica
js/jukebox.js            Jukebox-speler (lokaal + YouTube via postMessage)
yt-embed.html          Ingesloten YouTube IFrame Player, geserveerd via een lokale http-server
js/i18n.js + js/vertalingen.js   Meertaligheid (NL/EN)
db/                          CRUD-modules per tabel (walls, wallgroepen, videos, concerten, playlist)
build/icon.ico           App-icoon
```

Zie `CLAUDE.md` voor uitgebreide projectcontext en ontwerpkeuzes.
