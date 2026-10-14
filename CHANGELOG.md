# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Fixed
- Picking MASTER for a song that only has named arrangements (such as "Default")
  showed "ProPresenter didn't take the change; the playlist was put back as it
  was." The app now finds MASTER for such songs. If ProPresenter doesn't show it
  yet, the app asks you to pick Master once in ProPresenter and changes nothing.

### Changed
- Safer playlist editing: when a change doesn't stick, the app tells you and
  sends nothing more. It no longer writes the old playlist back by itself. It
  also saves one change at a time and waits longer for ProPresenter to answer.

## [v1.3.3] — 2026-10-14

### Fixed
- The proxy window no longer fills with an error ("'Handler' object has no
  attribute 'path'") when something connects that isn't plain HTTP, for example
  a browser trying `https://`. It now prints one line saying the request was
  ignored. Those requests never reached ProPresenter either way.

