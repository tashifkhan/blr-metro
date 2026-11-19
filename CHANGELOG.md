# Changelog

All notable changes to **Namma Metro** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-11-20

The first Android release. The same app has run at [blr-metro.tashif.codes](https://blr-metro.tashif.codes) since November. This version ships it as a signed APK on GitHub Releases and in the F-Droid repo at `tashif.codes/fdroid/repo`.

### Added

- Journey planning between any two Namma Metro stations, with least distance and minimum interchange routes. When the two routes differ, swipe sideways on the results to switch between them.
- Fares from BMRCL for each trip: token, smart card at peak and off-peak, and group ticket.
- Station search with Kannada names, a line list with each line's stations in order, and station pages.
- A network map you can pan and pinch, with station names beside the track, a sheet for the selected station, and Near me. Near me only picks a station when your position is precise to within 1 km.
- BMRCL notices. Tapping one opens its PDF.
- Saved station lists and journeys for offline use. Answers served from the cache say so on screen.
- Light, dark and Material You themes, a setting to turn off page animations, and quiet haptics that stay off routine taps.
- Shared journey links. On Android and iOS they point at `blr-metro.tashif.codes`, so someone without the app can open them in a browser.
- Download for Android buttons on the website's sidebar and in its Get the app panel, both pointing at `tashif.codes/download/blr-metro`.

### Fixed

- The website asked for Roboto Flex without loading it, so text fell back to the system font. It now loads from Google Fonts like the Delhi app.

### Known gaps

- BMRCL publishes no travel times, first or last trains, gates or platforms, so the app leaves those out rather than guess.
