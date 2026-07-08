# Musicwall — Projectcontext voor Claude Code

## Wat is Musicwall?
Een persoonlijke Electron desktop-applicatie waarbij gebruikers YouTube-video's en lokale video's koppelen aan levensmomenten, georganiseerd in thematische "walls" en concertervaringen. Geïnspireerd op de Wurlitzer MediaPlayer (Flash/ActionScript, 2000–2020).

## Technische stack
- Electron v42.6.0
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
db/zoeken.js           — Doorzoekt videos + concert_media samen (jukebox-bibliotheekzoeken)
nieuw-concert.html    — Formulier nieuw concert
js/nieuw-concert.js   — Logica nieuw concert formulier
nieuwe-wallgroep.html — Formulier nieuwe/hernoem wall-groep
js/nieuwe-wallgroep.js — Logica nieuwe/hernoem wall-groep formulier
hernoem-tab.html      — Formulier hernoemen vaste tab (Mijn walls / Mijn concerten)
js/hernoem-tab.js     — Logica hernoemen vaste tab formulier
help.html             — Helpscherm
css/help.css          — Help styling
css/toevoegen.css     — Gedeelde formulier styling
css/themas/           — Zeven thema CSS bestanden
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
playlist     (id, type, lokaal_pad, youtube_url, artiest, titel, volgorde)
```

`walls.groep_id` verwijst (los, geen enforced FK — dit project gebruikt nergens `PRAGMA foreign_keys`) naar `wall_groepen.id`. `NULL` betekent ongegroepeerd. `groep_id` is via migratie toegevoegd (`ALTER TABLE walls ADD COLUMN groep_id INTEGER` in `database.js`, alleen als de kolom nog niet bestaat).

De `playlist`-tabel (jukebox) staat los van `videos`/`concert_media` — bij toevoegen wordt `type`/`lokaal_pad`/`youtube_url`/`artiest`/`titel` gekopieerd, zodat zowel wall-video's als media uit concertervaringen toegevoegd kunnen worden, lokaal én YouTube. Dedupliceert op `lokaal_pad` (lokaal) resp. `youtube_url` (youtube). Nieuwe rijen krijgen `volgorde` = hoogste bestaande `volgorde` + 1 (niet `COUNT(*)+1`, dat gaf botsingen na verwijderingen). `type`/`youtube_url` zijn via migratie toegevoegd (`db/playlist.js`, tabel-rebuild net als de eerdere `video_id`→`lokaal_pad`-migratie, omdat SQLite een bestaande `NOT NULL`-kolom niet los kan maken via `ALTER TABLE`).

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
- Bovenaan `zoeken.html` kiest een modus-toggle (`stelModusIn('videos'|'playlists')` in `js/zoeken.js`) tussen video's zoeken en playlists zoeken; beide gebruiken `search.list` met `maxResults=50` (het maximum per YouTube-aanvraag)
- **Playlists zoeken**: toont eerst gevonden playlists (`zoekPlaylists()` → `renderPlaylistLijst()`); klikken op één playlist (`toonPlaylistVideos()`) haalt via `playlistItems.list` (pagina's van 50, tot 100 pagina's = 5000 nummers, YouTube's maximale playlistgrootte) alle nummers op en toont ze als normale selecteerbare zoekresultaten, met een **"← Terug naar playlists"**-knop (`terugNaarPlaylists()`, gebruikt de cache in `playlistResultatenCache` — geen nieuwe API-aanroep) en een eigen **"Selecteer alles"**-knop
- Private en verwijderde video's in een playlist (YouTube geeft deze terug met de vaste titel "Private video"/"Deleted video") worden uit de nummerlijst gefilterd, ook omdat ze vaak geen thumbnail hebben
- **"Selecteer alles"** (`selecteerAlleZoekresultaten()`) staat ook bij het normale video zoeken, direct boven de resultatenlijst — toggle-gedrag net als de wall/concert-detail selecteer-alles-knoppen

## Jukebox-gedrag
- Selecteren met **Ctrl+klik** op video's, zowel lokaal als YouTube, in een wall-kaart of op een media-tegel in concert-detail — beide typen gaan naar de playlist
- **Alles selecteren/deselecteren per wall**: een knop in de `wall-header` (naast de verwijder-knop, zichtbaar zodra de wall video's bevat) roept `toggleSelecteerAlleInWall(wallId)` aan — selecteert alle video's (lokaal én YouTube) van die wall als nog niet alles geselecteerd is, anders deselecteert het ze allemaal. Andere walls' selectie blijft ongemoeid. Vóór de YouTube-jukebox-ondersteuning was dit beperkt tot lokale video's (vandaar de oudere naam `toggleSelecteerAlleLokaal` in eerdere versies) — nu beide typen jukebox-geschikt zijn, selecteert de knop alles
- **Concert-detail**: dezelfde toggle-knop staat in de `media-toevoegen-balk` (`#selecteer-alles-btn`, zichtbaar zodra het concert lokale of YouTube-video's heeft) en roept `toggleSelecteerAlleInConcert()` aan voor alle afspeelbare media-tegels van het concert (foto's blijven uitgesloten)
- Handmatig bladeren (vorige/volgende/eerste/laatste) verwijdert nooit iets uit de playlist
- **YouTube-afspelen in de jukebox**: de YouTube IFrame Player API vereist een echte http(s)-pagina-origin om video's te mogen insluiten — `jukebox.html` laadt zelf gewoon via `file://` (nodig voor `require()`/`db/playlist.js`, dat breekt bij een generieke `http://`-load omdat Electrons module-resolutie voor `<script>`-tags aan het `file://`-protocol van het document hangt). Daarom draait de YouTube-speler in een apart, node-loos bestand `yt-embed.html`, geserveerd door een minimale lokale statische server (`startJukeboxServer()` in `main.js`, luistert op een vrije poort op `127.0.0.1`, gestart in `app.whenReady()`). `js/jukebox.js` haalt de poort op via `ipcRenderer.invoke('get-jukebox-server-poort')` en zet die als `src` van `<iframe id="youtube-speler-frame">` (in `#youtube-speler-wrap`, naast de bestaande `<video id="speler">`, zelfde `.zichtbaar`-toggle-patroon). Communicatie tussen `jukebox.js` en `yt-embed.html` gaat via `window.postMessage` (acties `laad`/`afspelen`/`pauzeren`/`stoppen` heen, types `ready`/`playing`/`paused`/`ended`/`error` terug) — geen directe `YT.Player`-referentie in `jukebox.js` zelf
- **Nooit vastlopen op YouTube**: een `error`-bericht vanuit `yt-embed.html` (bijv. video verwijderd, of insluiten door de uploader uitgeschakeld — dat laatste kan zelfs bij een verder publiek zichtbare video) roept `foutGaVerder()` aan, dat een korte toast toont (`#foutmelding`, 7s zichtbaar, `jukebox.nietAfspeelbaar`: "{titel} niet afspeelbaar, verwijderd uit de playlist (handmatig nog wel mogelijk)") en daarna dezelfde `afgespeeldGaVerder()` aanroept als een normaal afgespeeld nummer — het nummer wordt uit de *playlist* verwijderd (niet uit de wall/concertervaring zelf) en de jukebox gaat door met de volgende
- **Insluiten-uitgeschakeld komt vaak geclusterd voor**: officiële muziekvideo's van platenlabels hebben dit vaak aanstaan, dus playlists die vooral uit officiële videoclips bestaan (bijv. een Top 2000-lijst) kunnen een groot deel van hun nummers alleen handmatig afspeelbaar hebben. Dit is een instelling van de rechthebbende op YouTube zelf en is niet te omzeilen vanuit de iframe-API — overwogen alternatief (een los `BrowserView` met de echte youtube.com-pagina als fallback) is bewust niet gebouwd omdat een apart venster/laag naast de fullscreen-jukebox een storende "scherm-over-scherm"-overgang geeft; toegelicht in `help.jukebox.liBeperking` in plaats van technisch opgelost
- Een nummer dat **vanzelf** uitspeelt (lokaal: `ended`-event op de `<video>`; YouTube: `ended`-bericht vanuit `yt-embed.html`) wordt automatisch uit de playlist verwijderd via de gedeelde `afgespeeldGaVerder()`; het afspelen gaat daarna verder met het volgende nummer, of springt terug naar het eerste nummer als het laatste was
- Melding "playlist leeg" verschijnt alleen als de lijst na het uitspelen echt leeg is; handmatig doorbladeren tot het einde toont in plaats daarvan "einde van de playlist"
- **Eén jukebox-venster tegelijk**: `jukeboxWin` (`main.js`) is module-scope, net als `mainWindow` en `videoWindow`. `open-jukebox` focust een al open jukebox-venster (`jukeboxWin.focus()`) in plaats van er een tweede naast te openen — voorkomt overlappend geluid uit twee onafhankelijke `<video>`/YouTube-iframe-instanties. `jukeboxWin` wordt op `null` gezet bij het sluiten van het venster
- **Playlist live bijwerken**: `toevoegen-aan-playlist` en `concert-media-naar-playlist` (`main.js`) sturen na het opslaan `jukeboxWin.webContents.send('playlist-bijgewerkt')` als de jukebox open staat, zodat nummers die vanuit een wall of concert-detail worden toegevoegd meteen in de al openstaande jukebox-lijst verschijnen. `js/jukebox.js` luistert hierop via `ipcRenderer.on('playlist-bijgewerkt', laadPlaylist)` — ververst alleen de lijst-HTML, laat de lopende afspeelstatus ongemoeid
- **Zoeken in je eigen bibliotheek**: een zoekveld boven de playlist (`#bibliotheek-zoekveld` in `jukebox.html`) doorzoekt live (bij elke `input`) je hele verzameling — alle wall-video's én alle afspeelbare concert-media (`db/zoeken.js`'s `zoekBibliotheek(term)`, een `LIKE`-match op artiest/titel over `videos` JOIN `walls` en `concert_media` JOIN `concerten`; `concert_media` heeft geen eigen artiest/titel-kolommen, dus die resultaten gebruiken het concert zelf als artiest/titel, net als `stuurNaarJukebox()` in `concert-detail.js` al deed). Zoekresultaten vervangen tijdelijk de playlist-weergave (`#playlist-lijst` verborgen, `#bibliotheek-resultaten` getoond) — leegmaken van het zoekveld toont de echte playlist weer
- Klikken op een resultaat **selecteert** het (geen directe toevoeging, zelfde patroon als `zoeken.html`'s YouTube-zoekresultaten) — een selectiebalk onderin (`#bibliotheek-selectie-info`, hergebruikt de generieke `selectie.tekst`/`selectie.voegToeAanPlaylist`-vertalingen) toont het aantal en een knop om de selectie in één keer toe te voegen via de bestaande `voegToeAanPlaylist()` (`db/playlist.js`) — rechtstreeks `require()`'d in `js/jukebox.js`, geen IPC nodig omdat zoeken/selecteren/toevoegen allemaal in hetzelfde jukebox-venster gebeurt (in tegenstelling tot `toevoegen-aan-playlist`/`concert-media-naar-playlist`, die wél via IPC gaan omdat ze vanuit een ándere renderer komen)
- Selectiesleutel is `soort + '|' + (lokaalPad of youtubeUrl)`, niet een DB-id — hetzelfde nummer dat in meerdere walls voorkomt (zelfde YouTube-url) deelt daardoor bewust dezelfde sleutel: klikken op één exemplaar markeert alle exemplaren als geselecteerd en telt als 1, wat correct is omdat het toch hetzelfde nummer is (`voegToeAanPlaylist()` dedupliceert daar ook al op)
- **Selecteer alles**: `toggleSelecteerAlleBibliotheekResultaten()` boven de resultatenlijst, zelfde toggle-gedrag als bij walls/concert-detail/YouTube-zoeken — telt (en toont in de selectiebalk) het aantal *unieke* sleutels, dus bij duplicaten over meerdere walls kan het aantal geselecteerde rijen in de DOM hoger zijn dan het getoonde aantal
- Race-guard (`bibliotheekZoekGeneratie`, opgehoogd bij elke nieuwe zoekopdracht): lokale-video-thumbnails in de resultatenlijst worden async opgehaald (`maak-thumbnail` IPC per item), dus bij snel typen kan een oudere zoekopdracht pas ná een nieuwere klaar zijn — elk resultaat-item checkt vóór het toevoegen aan de DOM of zijn zoekopdracht nog de actuele is, anders stopt het renderen stil

## Concert-detail mediaviewer
- Klikken op een foto- of videotegel in `concert-detail.html` (zonder Ctrl) opent `openViewer(index)` in plaats van direct af te spelen — een volledig-scherm viewer (`#lightbox`/`#lightbox-inhoud`) die door alle media van het concert bladert via ‹ ›-knoppen (`viewerVorige()`/`viewerVolgende()`, met wrap-around) of de pijltjestoetsen; Ctrl+klik blijft ongewijzigd de bestaande jukebox-selectie
- Video's tonen in de viewer een poster (dezelfde thumbnail/YouTube-afbeelding als op de tegel, uit `posterMap`) met een play-knop erover — pas een klik daarop stuurt `open-video`/`open-lokaal` om af te spelen in het bestaande losse afspeelvenster; geen automatisch afspelen bij het bladeren
- `.lightbox-inhoud` heeft een vaste afmeting (`70vw` × `70vh`); foto's en video-posters passen daar via `object-fit: contain` binnen, zodat het kader nooit van grootte verspringt tussen items met verschillende beeldverhoudingen
- De bron-badge (Lokaal/YouTube) wordt ook in de viewer getoond (`.viewer-bron`), niet alleen op de grid-tegel

## Beleving/animaties
- **GSAP Flip-plugin**: naast de gewone `gsap`-import (`<script>window.gsap = require('gsap').gsap</script>` in `<head>`) laadt `index.html` de gratis `Flip`-plugin (`window.Flip = require('gsap/Flip').Flip; gsap.registerPlugin(Flip)`) in een **apart script-blok direct na de openende `<body>`-tag**, niet in `<head>` samen met de gsap-import zelf — `Flip.register()` heeft `document.body` nodig op het moment van registreren (leest `_body$1 = document.body`) om zijn interne `_toArray`-referentie te initialiseren; in `<head>` bestaat `document.body` nog niet, wat zonder foutmelding bij het laden zelf pas later crasht (`_toArray is not a function`) zodra `Flip.getState()` voor het eerst wordt aangeroepen tijdens een drag
- **Idle "ademende" kaarten**: `startKaartAdemhaling(cardEls)` (`js/index.js`) zet op elk kaartelement een oneindige yoyo-tween op `filter: brightness()` (1 → ~1.05, willekeurige duur/vertraging per kaart zodat kaarten niet synchroon pulsen). Bewust `filter` i.p.v. `opacity`/`transform`/`scale`, omdat die laatste al gebruikt worden door hover (`kaartHoverIn`/`kaartHoverUit`), de intro-stagger en drag-dimming — `filter` wordt nergens anders op `.card` aangeraakt, dus geen conflicterende tweens nodig. Gebruikt altijd `gsap.fromTo()` met een expliciete startwaarde (`brightness(1)`); een kale `gsap.to()` vanaf de ongezette CSS-startwaarde `none` interpoleert fout (dook naar bijna zwart, `brightness(0.0086)`, i.p.v. rond 1 te blijven) omdat GSAP `none` niet betrouwbaar als `brightness(1)` inleest. Aangeroepen na elke render-batch (`laadWalls()` en `toonAlleKaarten()`)
- **Vloeiende Flip-animatie bij kaarten verplaatsen**: elk kaartelement krijgt `data-flip-id="video-{id}"` (stabiel, in tegenstelling tot de wall/positie-afhankelijke `id`-attribuut) zodat Flip "voor" en "na" kan matchen, ook als de DOM-node zelf gesloopt en opnieuw opgebouwd wordt. Zelfde-wall herordenen (`kaartDrop`) en andere-wall verplaatsen (`drop()`) roepen `Flip.getState('[data-flip-id]')` vóór de bestaande DOM-mutatie/`laadWalls()`-rebuild en `Flip.from(state, {...})` erna — vervangt de instant DOM-snap resp. de volledige "flash"-rebuild door een vloeiende overgang, zonder de DB-/sorteerlogica te wijzigen. `drop()` is hiervoor `async` gemaakt (`await laadWalls()` vóór `Flip.from`)
- **Ken Burns-effect op lightbox-foto's**: `renderViewer()` (`js/concert-detail.js`) geeft foto's (niet video-posters) een eenmalige, gerandomiseerde zachte zoom/pan (`scale: 1 → ~1.08`, kleine `xPercent`/`yPercent`, ~13s, geen loop). `.lightbox-inhoud` heeft hiervoor `overflow: hidden` gekregen zodat de lichte uitzoom nooit buiten het vaste `70vw`×`70vh`-kader zichtbaar wordt, zonder de bestaande `object-fit: contain`-instelling (geen crop van de volledige foto in rust) aan te passen
- **Kaart "omdraaien" i.p.v. accordion**: de vroegere hoogte-tweende `.card-header`/`.card-body`-accordion is vervangen door een echte 3D-flip. `bouwKaartHtml()` bouwt nu `.card-flip > .card-flip-inner > .card-face.card-front` (nummer/artiest/titel/tag/chevron) + `.card-face.card-back` (verhaal) — beide gezichten delen `grid-area: 1 / 1` (CSS Grid-stacking-truc) zodat de container automatisch de hoogte van de langste kant aanneemt, zonder vaste hoogte of losse height-meting, net als de oude accordion die zich ook naar de tekstlengte voegde. `toggle(wallId, n)` (zelfde functienaam, zelfde `active[wallId]`-bijhouding voor "één tegelijk open per wall") tweent nu `rotationY` (0 ↔ 180) i.p.v. `height`/`opacity`. De thumbnail (met eigen afspeel-klik en selectie-vinkje) staat bewust buiten de flip

## Releases publiceren (GitHub)
- `package.json`'s `build.publish` wijst naar GitHub (`owner: asmraap-ship-it`, `repo: musicwall`, `releaseType: draft`) — electron-builder maakt bij publiceren een **draft**-release aan (niet meteen openbaar), zodat er nog handmatig op "Publish release" geklikt moet worden op GitHub voordat anderen hem zien
- `.github/workflows/release.yml` draait op `windows-latest` bij het pushen van een versietag (`v*`, bijv. `v1.0.1`) of handmatig via `workflow_dispatch`; installeert dependencies, draait `npm run build -- --publish always` met `GH_TOKEN` (de standaard `secrets.GITHUB_TOKEN` van Actions, met `permissions: contents: write` op workflow-niveau zodat die release-assets mag aanmaken/uploaden)
- Releaseproces: `version` in `package.json` ophogen → committen → `git tag vX.Y.Z` → `git push origin vX.Y.Z` → CI bouwt en zet de installer + blockmap als draft-release op GitHub
- **Nog geen echt code-signing-certificaat**: `signtool.exe` draait wel tijdens de build, maar zonder geconfigureerd certificaat (geen `CSC_LINK`/`CSC_KEY_PASSWORD`) is de resulterende `.exe` in werkelijkheid **niet ondertekend** (`Get-AuthenticodeSignature` geeft `NotSigned`, geverifieerd op zowel `Musicwall.exe` als de NSIS-installer) — gebruikers die de installer downloaden krijgen dus een Windows SmartScreen-waarschuwing. Pas op te lossen door een echt (OV/EV) certificaat aan te schaffen en als CI-secret toe te voegen
- **`npm ci` heeft expliciete Electron-target-vars nodig** (`npm_config_runtime`/`target`/`target_platform`/`target_arch`/`disturl` op de install-stap in `release.yml`): zonder deze probeert `better-sqlite3`'s eigen install-script een binary te bouwen voor de kale Node-runtime van de CI-runner (waar geen prebuilt voor bestaat) en valt terug op `node-gyp`, dat vastloopt omdat het de Visual Studio-installatie op `windows-latest` niet herkent. electron-builder's eigen `@electron/rebuild`-stap (later in de build) gebruikt al wél de juiste Electron-ABI en werkt zonder deze vars — vandaar dat dit lokaal nooit opviel

## Microsoft Store (MSIX/appx)
- Los van de GitHub-EXE (NSIS) kan een Store-pakket gebouwd worden met `npm run build:appx` (`electron-builder --win appx`) — bewust **niet** toegevoegd aan `win.target` in de hoofdbuild, zodat de gewone GitHub-release onveranderd blijft en dit alleen handmatig gebeurt vóór een Store-submissie
- `build.appx` in `package.json` bevat de Store-identiteit (`identityName`, `publisher`, `publisherDisplayName`) — deze drie waarden komen uit Partner Center via **Apps and games → productnaam → Product management → Product identity**, ná het aanmaken van een product van het type **"MSIX or PWA app"** (niet "MSI/EXE app" — alleen de MSIX-route laat de Store het pakket gratis signeren met een Microsoft-certificaat tijdens submissie, vandaar dat de lokale build ook terecht "AppX is not signed, reason=Windows Store only build" meldt)
- **Eigen tegel-iconen in `build/appx/`** (`Square44x44Logo.png`, `Square150x150Logo.png`, `Wide310x150Logo.png`, `StoreLogo.png`) zijn nodig omdat electron-builders eigen appx-icoongeneratie vanuit `build/icon.ico` een vrijwel volledig blanco/transparant resultaat gaf voor alle vier de tegelformaten (vermoedelijk een decodeerprobleem met het PNG-gecomprimeerde 256×256-frame in het ICO-bestand) — pas zichtbaar door de gegenereerde PNG's uit het `.appx`-bestand (een zip) te controleren, niet door de build-log, die geen fout of waarschuwing gaf. De vervangende PNG's zijn gerenderd vanuit hetzelfde `build/icon.ico` via een canvas in een kale Electron-testinstantie (browsers decoderen ICO's wél correct als `<img>`) en zijn los aangemaakte bestanden — geen wijziging aan `build/icon.ico` zelf, dat voor de NSIS-EXE gewoon goed werkte

## Performance bij grote walls
- `laadWalls()` in `js/index.js` rendert per wall maximaal `KAART_RENDER_LIMIT` (150) kaarten in één keer; bij meer video's (bijv. een wall gevuld vanuit een grote YouTube-playlist) verschijnt een **"Toon nog N video's"**-knop (`toonAlleKaarten(wallId)`) die de rest pas opbouwt/toevoegt na een klik — voorkomt dat elke tabblad-/groepwissel duizenden DOM-kaarten in één keer moet opbouwen
- `bouwKaartHtml()` is de herbruikbare kaart-HTML-builder, gebruikt door zowel `laadWalls()` als `toonAlleKaarten()`; `videoData` krijgt bij het laden altijd de volledige videolijst van elke wall (ook ongerenderde kaarten) zodat latere idx-toewijzing via `wallStartIdx` klopt
- Thumbnail-`<img>`'s in wall-kaarten hebben `loading="lazy"` — de browser laadt alleen thumbnails die in beeld komen
- De GSAP-introanimatie van kaarten schaalt de `stagger`-waarde af naarmate er meer kaarten zijn (`Math.min(0.03, 0.6 / aantalKaarten)`), zodat de totale animatieduur altijd rond de 0,6s blijft in plaats van lineair op te lopen bij grote walls

## Dialoogvensters
- Eenvoudige formuliervensters met alleen titel + invoerveld + knop + melding (`nieuwe-wall.html`, `nieuwe-wallgroep.html`, `hernoem-tab.html`, gedeelde `css/toevoegen.css`) hebben in `main.js` een vaste `BrowserWindow`-hoogte van 320px nodig — de inhoud (titel + veld + knop + meldingsruimte) heeft ongeveer 300px nodig; een kleinere hoogte laat de opslaan-knop wegvallen buiten beeld zonder scrollbalk-indicatie

## YouTube API-sleutel instellen/wijzigen
- `controleerApiSleutel()` in `main.js` draait bij elke opstart (`app.whenReady()`) en opent automatisch `api-sleutel-instellen.html` als `instellingen.json` ontbreekt of `youtubeApiKey` nog de placeholder (`VUL_HIER`) bevat — eenmalig, verschijnt niet meer zodra een echte sleutel is opgeslagen
- **Sleutel later wijzigen**: knop onderaan de YouTube-zoeken-sectie van `help.html` (`js/help.js`'s `wijzigApiSleutel()` → IPC `open-api-sleutel-instellen`) opent hetzelfde scherm, maar met `?modus=wijzig` als query-param op `api-sleutel-instellen.html` — `js/api-sleutel-instellen.js` leest dat via `URLSearchParams` en past dan titel/intro-tekst en de "Later instellen"-link (wordt "Annuleren") aan, en vult het veld alvast met de huidige sleutel uit `instellingen.json` (mits die geen placeholder is)
- Beide varianten (eerste opstart en wijzigen) delen dezelfde `openApiSleutelWindow(modus)`-functie in `main.js` en dezelfde opslaanlogica in `js/api-sleutel-instellen.js` — alleen het al dan niet meegeven van `modus` bepaalt het gedrag

## Versienummer tonen
- Een eerdere watermark rechtsonder in het hoofdscherm bleek in de praktijk bijna onzichtbaar (te laag contrast tegen de achtergrond) en is verwijderd — het versienummer staat nu in plaats daarvan in de `header` van `help.html` (`#help-versie`, naast de "Musicwall"-tekst in de `.logo`-regel, `.versie` in `css/help.css`), goed leesbaar omdat gebruikers daar bewust naartoe navigeren
- Gevuld door `js/help.js` via `require('./package.json').version` (root-relatief, net als `js/index.js`'s `require('./db/...')`) en de vertaalsleutel `help.versieLabel` (`"Versie {versie}"`/`"Version {versie}"`) — geen aparte IPC-aanroep nodig, en altijd gelijk aan de daadwerkelijk gebouwde versie

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
- `open-api-sleutel-instellen` → opent api-sleutel-instellen.html in wijzig-modus (zie `## YouTube API-sleutel instellen/wijzigen`)

## Stijlprincipes
- Donker goudkleurig palet: `--accent: #c8a87a`
- Achtergrond: gematigd donker `#2b2620` (niet bijna-zwart, zie `## Thema's`)
- Wall-headers: `linear-gradient(135deg, #3a3428 0%, #1f1a12 100%)` met clip-path
- Tabs: zelfde gradient als wall-headers, actieve tab met gouden rand
- GSAP voor alle animaties (intro, walls, cards, toggle open/dicht)
- Parallax op walls via mousemove (diepte factor 1)