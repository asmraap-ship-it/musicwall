# Changelog

English translation of `CHANGELOG.md`, used by the in-app "What's new" screen when the app language
is set to English. Only kept from the version where the "What's new" screen was introduced onward —
older entries are not translated (see `CLAUDE.md`'s Changelog-workflow section for why).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.2.2]
### Changed
- The standalone player window for a local music track now also shows the artist and title, and leaves less empty space around the album cover.

### Fixed
- The standalone player window for a local music track didn't follow the chosen theme and always showed a black background.

## [1.2.1]
### Fixed
- The turntable background and track name/time/progress bar in the jukebox were hardcoded black/white and unreadable in the Light theme.
- Newly opened windows (including the jukebox) sometimes still showed the minimize/maximize/close buttons in the default theme's color instead of the active theme's.

## [1.2.0]
### Added
- Previous/next buttons in the album screen to browse between albums without returning to the overview — in the same order as the albums grid, with wrap-around.

## [1.1.1]
### Fixed
- The "What's new" screen always showed the changes in Dutch, even with the app language set to English.

## [1.1.0]
### Added
- Music albums: import a folder of mp3/m4a/flac/wav files as an album, with cover art, artist and titles read automatically. Albums get their own kind of wall-group tab, with a tracklist screen to browse and play songs.
- Navigation bar while playing an album: previous/next/first/last track, with a progress bar and elapsed time/length — tracks now play right inside the album screen itself.
- New filter in the header (next to the theme picker) to choose which kind of tab you want to see: All, Concerts, Videos or Music.
- A "What's new" screen that automatically shows the highlights after an update, also reachable from Help.

### Changed
- The turntable in the jukebox has been thoroughly redesigned: a more detailed Pioneer-style drawing with a strobe-dot band, silver-plated rims and a nicer overall finish — closer to a real turntable than before.
- Playing music in the jukebox now spins a vinyl record with the cover art on it, instead of a single enlarged cover image — with a tonearm that gradually moves toward the center of the record as the track plays.
- The playing track is now easier to spot: in an album the playing row gets a pause icon, and in the jukebox playlist the playing track scrolls into view automatically.
- The jukebox now also shows elapsed time and length for music files.
- Standalone playback windows for music files are now more compact.
- The "Import folder" and "Search YouTube" buttons are hidden on an albums tab, where they wouldn't work anyway.
- The vinyl record now visibly arrives too: it glides onto the turntable right before a track starts and disappears again when stopped. Tracks from the same album leave the record in place; a different album lifts the old record off before placing the new one.
- The tonearm moves more smoothly, lands the needle neatly at the start of the record, and visibly lifts when a track ends naturally or is stopped.

### Fixed
- The window for editing an album was too small, cutting off the Save button.
- Searching from a music tab left the albums visible behind the search results.
- Manually switching to a previous or next track could leave the old track audible for a moment while the record was being swapped.
- Pressing Stop followed by Play made the jukebox display disappear and not come back.
- The tonearm's resting position was too close to the pitch fader.
- A track could become audible before the needle had visibly landed on the record.
- Browsing previous/next between music tracks could sometimes leave the new track silent at the start instead of playing.
- Pausing could leave the tonearm without returning to its resting position.
- Resuming after a pause made the sound start again before the needle had visibly landed.
- Searching YouTube could get a second, unstyled scrollbar when there were many results.
