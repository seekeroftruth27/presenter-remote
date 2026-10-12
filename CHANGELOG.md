# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Changed
- **Macros tab** shows only the stage team's macros: Speaking, Speaking without
  translation, Music and lyrics, and Kid's lyrics. Any that ProPresenter doesn't
  have are named at the top of the tab.
- **↻ (reload)** buttons are bigger.

### Removed
- **Clear media** on the Remote tab; only slides are needed. **Clear all**
  (hold) on the Macros tab still clears everything.
- **▶ Start** for a whole playlist. **▶** on each item still puts that item on
  screen.

## [v1.0.2] — 2026-10-12

### Fixed
- **Adding from a library was still refused** ("missing field
  `arrangement_name`"): the new item was built with fewer fields than
  ProPresenter requires. It's now shaped like a song already in the playlist,
  every item keeps `arrangement_name` (empty for none), and choosing **No
  arrangement** sets it empty instead of removing it.

