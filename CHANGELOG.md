# Changelog

Alle noemenswaardige wijzigingen aan Musicwall worden hier bijgehouden.

Het formaat is gebaseerd op [Keep a Changelog](https://keepachangelog.com/nl/1.0.0/).

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
