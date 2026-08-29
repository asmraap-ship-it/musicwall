# Changelog

Alle noemenswaardige wijzigingen aan Musicwall worden hier bijgehouden.

Het formaat is gebaseerd op [Keep a Changelog](https://keepachangelog.com/nl/1.0.0/).

## [1.2.15]
### Changed
- Het albumscherm is herzien: de platenspeler staat nu altijd naast de tracklijst (niet meer optioneel), in een groter venster met een bredere tracklijst en grotere albumhoes. De platenspeler gebruikt zoveel mogelijk van de beschikbare ruimte, ook bij een gemaximaliseerd venster.
- "Selecteer alles" staat in het albumscherm nu naast "Album bewerken".

### Added
- Een te lange tracktitel of artiestnaam in het albumscherm schuift nu voorbij als lopende tekst zolang het nummer speelt.

### Fixed
- De voortgangsbalk in het albumscherm sprong niet terug naar 0% bij het wisselen van album of nummer tijdens het afspelen.
- Plakken van de YouTube-API-sleutel werkte niet meer na de Electron-update naar versie 44.

## [1.2.14]
### Added
- Drie nieuwe thema's: Chroom (lichtmetalig, blauw accent), Oceaan (diep marineblauw) en Radar (donker HUD-thema met cyaan gloed, geïnspireerd op sciencefiction-interfaces).

### Fixed
- De equalizer- en stroboscoopknoppen in de jukebox toonden geen duidelijke rand meer zodra ze actief waren, in elk thema.
- Het equalizer-icoon was onzichtbaar in het Chroom-thema.

## [1.2.13]
### Fixed
- Opgeslagen playlists sloegen MP3-nummers uit een geïmporteerd album niet meer op — ze werden stilzwijgend overgeslagen. Werkt nu correct, inclusief de albumhoes bij het terugladen.
- De YouTube-sleutel-wizard verscheen bij elke opstart opnieuw als je eerder op "Later instellen" had geklikt — onthoudt die keuze nu.

## [1.2.12]
### Fixed
- De stroboscoopknop en het platenspeler-formaat-schuifje in de jukebox bleven actief staan tijdens het afspelen van een video of YouTube-video, terwijl ze alleen bij de platenspeler horen — verdwijnen nu automatisch mee. Hetzelfde gold in een albumscherm bij het wisselen van de platenspeler-animatie naar de tracklijst.
- Namen en tekstvelden (walls, concertervaringen, opgeslagen playlists, het verhaal-veld bij een video) werden op een paar plekken niet overal even veilig weergegeven als ze aanhalingstekens of HTML-achtige tekens bevatten.

### Changed
- Concertervaringen met veel lokale video's laden nu merkbaar sneller: tegels verschijnen direct, thumbnails vullen zich er later bij (net als walls al sinds 1.2.4).

## [1.2.11]
### Changed
- De platenspeler heeft weer een aantal grafische verfijningen gekregen: het "Pioneer DJ"-opschrift staat nu netter uitgelijnd, de gewichtschaal-ring heeft een subtiele lichtschaduw, en de rand rond het draaipunt is verbreed en afgerond.

## [1.2.10]
### Added
- De TEMPO-schuif en TEMPO RANGE-knoppen op de platenspeler werken nu echt: ze passen de afspeelsnelheid aan, in zowel de jukebox als het albumscherm.
- De START/STOP-knop op de platenspeler is nu ook echt bedienbaar.
- Play/pauze/volgende/vorige werken nu ook via de media-toetsen van je toetsenbord, zolang de jukebox open staat.

### Fixed
- Tussen de groeven en het label op de vinylplaat ontbrak het gladde, groefloze randje dat een echte plaat daar heeft.
- De toonarm landde niet meer goed op de plaat na eerdere aanpassingen aan de headshell.

### Changed
- De toonarmbuis is opnieuw getekend voor een vloeiendere, realistischere S-vorm.
- De headshell is groter getekend, in verhouding met de rest van de toonarm.
- De platenspeler heeft nu een zachte schaduw rond de hele behuizing, en een dikkere zwarte rand met een lichte accentlijn aan de buitenkant van de plaat.

## [1.2.9]
### Changed
- De toonarm is dikker en realistischer getekend, met een nieuwe geribbelde kraag waar hij op de headshell aansluit.
- De cijferschalen en knoppen rond het draaipunt (anti-skating, gewichtschaal, LOCK) staan preciezer uitgelijnd.
- De naald landt weer op de juiste plek op de plaat: net binnen de rand bij het begin van een nummer, dichtbij het midden aan het einde.
- Nog meer onderdelen van de platenspeler hebben nu subtiele schaduw en metaalglans: de 45-toerenadapter, de pivot/anti-skating-knop en de POWER- en START/STOP-knoppen.
- De toonarmbuis bij het draaipunt is verfijnd: een duidelijker herkenbare rechte kraag die pas verderop taps toeloopt, en een net iets uitgesprokener zilverkleurige tint bovenaan de arm.

## [1.2.8]
### Changed
- De toonarmbeugel van de platenspeler heeft nu een subtiele schaduw en metaalglans, voor meer diepte in de tekening.

## [1.2.7]
### Fixed
- De stroboscooplichtjes op de platenspeler bleven draaien/vervagen terwijl de muziek gepauzeerd of gestopt was.

### Changed
- De platenspeler-tekening is verder verfijnd: de toonarmbeugel bij het draaipunt, en de gewichtschaal en toonarmbuis staan dichter bij het origineel.

## [1.2.6]
### Added
- Album-schermen: optioneel de platenspeler tonen tijdens het afspelen (💿-knop), met dezelfde draaitafel-animatie als de jukebox.

### Fixed
- Twee of meer albumschermen tegelijk konden onafhankelijk van elkaar afspelen.
- Het vorige nummer bleef soms even doorspelen tijdens het wisselen naar een volgend nummer.

## [1.2.5]
### Changed
- De platenspeler-tekening in de jukebox is verder verfijnd: een gedetailleerdere toonarmbuis, een scharnierende cueing-lift-hendel, een zichtbare signaalkabel en een strakkere behuizingsrand.
- Op Stop blijft de platenspeler nu gewoon in beeld staan (alleen de plaat verdwijnt) in plaats van het hele scherm leeg te maken.

### Fixed
- Bij het wisselen naar een nummer van een ander album via vorige/volgende bleef de toonarm soms boven de draaischijf hangen in plaats van eerst naar rust te gaan.

## [1.2.4]
### Changed
- Walls met veel lokale muziek en video's laden merkbaar sneller: kaarten verschijnen meteen, thumbnails worden daarna op de achtergrond ingevuld.

## [1.2.3]
### Added
- Muziek-albums: genre-veld met suggesties op basis van je eigen collectie.
- Muziek-albums: meerdere albums tegelijk importeren vanuit één bovenliggende map (bijv. een hele schijf met muziek).
- Muziek-albums: albums selecteren (Ctrl+klik) om ze in één keer te verwijderen of aan de jukebox-playlist toe te voegen.
- Muziek-albums: sorteerknop om albums op artiest en naam te ordenen, en een filterveld om te zoeken op artiest of naam.
- Waarschuwing bij het opnieuw importeren van een bestand, YouTube-video of album dat al op dezelfde plek staat.
- Bevestiging bij het sluiten van het hoofdscherm terwijl er nog andere vensters (zoals de jukebox) open staan.

### Changed
- Artiest en albumnaam worden bij het importeren van één album nu automatisch voorgesteld op basis van de nummers zelf.

### Fixed
- Nummers in een geïmporteerd album stonden soms in een willekeurige volgorde in plaats van de juiste tracklijst-volgorde.
- Het sluiten van het hoofdscherm liet andere open vensters (jukebox, help, etc.) onterecht open staan.
- De bevestigingsknop bij een waarschuwing over dubbele import toonde per ongeluk "Verwijderen" in plaats van een duidelijke "toch doorgaan"-tekst.
- Handmatig een los bestand toevoegen aan een wall controleerde niet op duplicaten, in tegenstelling tot de andere manieren om iets toe te voegen.

## [1.2.2]
### Changed
- Het losse afspeelvenster voor een lokaal muzieknummer toont nu ook artiest en titel, en laat minder lege ruimte rond de albumhoes over.

### Fixed
- Het losse afspeelvenster voor een lokaal muzieknummer volgde het gekozen thema niet en toonde altijd een zwarte achtergrond.

## [1.2.1]
### Fixed
- De platenspeler-achtergrond en tracknaam/tijd/voortgangsbalk in de jukebox waren hardcoded zwart/wit en onleesbaar in het Licht-thema.
- Nieuw geopende vensters (o.a. de jukebox) toonden de min/max/sluiten-knoppen soms nog in de kleur van het standaardthema in plaats van het actieve thema.

## [1.2.0]
### Added
- Vorig/volgend-knoppen in het albumscherm om tussen albums te bladeren zonder terug te hoeven naar het overzicht — in dezelfde volgorde als het albums-grid, met wrap-around.

## [1.1.1]
### Fixed
- Het "Wat is er nieuw"-scherm toonde de wijzigingen altijd in het Nederlands, ook bij een Engelse taalinstelling.

## [1.1.0]
### Added
- Muziek-albums: importeer een map met mp3/m4a/flac/wav-bestanden als album, met hoes, artiest en titels automatisch uitgelezen. Albums krijgen een eigen soort wall-groepstab, met een tracklijst-scherm om nummers te bekijken en af te spelen.
- Navigatiebalk bij het afspelen van een album: vorige/volgende/eerste/laatste nummer, met een voortgangsbalk en verstreken tijd/lengte — nummers spelen nu binnen het albumscherm zelf af.
- Nieuw filter in de header (naast de thema-keuze) om te kiezen welk soort tabblad je wilt zien: Alles, Concerten, Video's of Muziek.
- Een "Wat is er nieuw"-scherm dat na een update automatisch de belangrijkste wijzigingen laat zien, ook terug te vinden via de Help.

### Changed
- De platenspeler in de jukebox is grondig vernieuwd: een gedetailleerdere Pioneer-tekening met een stroboscoopband, verzilverde randen en een fraaiere afwerking rondom — dichter bij een echte platenspeler dan voorheen.
- Bij het afspelen van muziek in de jukebox draait nu een vinylplaat met de hoes erop, in plaats van een los, vergroot hoesplaatje — met een meebewegende pick-uparm die tijdens het nummer geleidelijk richting het midden van de plaat beweegt.
- De spelende track is nu beter te zien: in een album krijgt de spelende rij een pauze-icoon, en in de jukebox-playlist scrollt het spelende nummer automatisch in beeld.
- De jukebox toont bij muziekbestanden nu ook de verstreken tijd en lengte.
- Losse afspeelvensters voor muziekbestanden zijn nu compacter.
- De knoppen "Map importeren" en "YouTube zoeken" zijn verborgen op een albums-tabblad, waar ze toch niet werken.
- De vinylplaat komt nu zelf ook in beeld: hij zweeft aan op de draaitafel vlak voor het starten van een nummer en verdwijnt weer bij het stoppen. Bij nummers van hetzelfde album blijft de plaat gewoon liggen; bij een ander album wordt de oude plaat eerst weggehaald voordat de nieuwe wordt neergelegd.
- De pick-uparm beweegt rustiger, zet de naald bij het starten netjes aan het begin van de plaat neer, en tilt zichtbaar op als een nummer vanzelf is afgelopen of gestopt wordt.

### Fixed
- Het venster om een album te bewerken was te klein, waardoor de Opslaan-knop buiten beeld viel.
- Zoeken vanuit een muziek-tabblad liet de albums nog zichtbaar staan naast de zoekresultaten.
- Bij handmatig naar een vorig of volgend nummer schakelen bleef het oude nummer soms nog even hoorbaar doorspelen tijdens het wisselen van de plaat.
- Op Stop gevolgd door Play verdween de jukebox-weergave en kwam niet meer terug.
- De pick-uparm in rust stond nog te dicht bij de tempo-schuifknop.
- Een nummer kon al hoorbaar starten voordat de naald zichtbaar op de plaat lag.
- Vorige/volgende bladeren tussen muzieknummers liet het nieuwe nummer soms muteloos aan het begin blijven staan in plaats van af te spelen.
- Pauzeren liet de pick-uparm soms niet meer terugkeren naar de ruststand.
- Na pauzeren begon het geluid weer voordat de naald zichtbaar geland was.
- YouTube zoeken kon bij veel resultaten een tweede, ongestylede scrollbalk krijgen.
