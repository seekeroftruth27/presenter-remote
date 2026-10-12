# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Fixed
- **Adding from a library (and other playlist edits) was refused by
  ProPresenter** with "missing field `target_uuid`": the playlist was written
  back with empty fields left out, and ProPresenter requires that one on every
  item. Every field now goes back as ProPresenter gave it.

## [v1.0.0] — 2026-10-12

### Added
- **Phone remote for ProPresenter 7** (7.9+), as an iPhone app (`mobile/`) or in
  any phone browser through a small proxy (`proxy/`, built as
  `pp-remote-proxy.exe`).
- **Remote tab:** Live panel (the slide on screen, with thumbnail, position,
  group and text); preview of the live item's slides with a 1–5 column zoom that
  follows the live slide; tap a slide to show it; Prev / Next; Clear slide (tap)
  and Clear media (hold).
- **Playlist tab:** arrangements per song, start a playlist or show any item, add
  presentations from a library (with search), remove items. Each edit is
  written, read back and undone if ProPresenter didn't keep it; a refusal shows
  ProPresenter's reason and changes nothing. Planning Center playlists are
  read-only.
- **Macros tab:** macros as coloured buttons, two taps to run; Clear all (hold).
- Light on ProPresenter: once-a-second polling only while the Remote tab is
  open, lazy two-at-a-time thumbnails, a cached arrangement scan.
