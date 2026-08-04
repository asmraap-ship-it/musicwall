# Changelog

Alle noemenswaardige wijzigingen aan Musicwall worden hier bijgehouden.

Het formaat is gebaseerd op [Keep a Changelog](https://keepachangelog.com/nl/1.0.0/).

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
